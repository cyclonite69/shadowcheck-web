import { randomBytes } from 'crypto';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
  PutSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

export {};

const AWS_SECRET_NAME = process.env.SHADOWCHECK_AWS_SECRET || 'shadowcheck/config';
const AWS_REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';

type AccessLogEntry = {
  secret: string;
  found: boolean;
  timestamp: string;
};

const REQUIRED_SECRETS = ['db_password'];
const OPTIONAL_SECRETS = [
  'mapbox_token',
  'wigle_api_name',
  'wigle_api_token',
  'wigle_api_encoded',
  'google_maps_api_key',
  'mapbox_unlimited_api_key',
  'opencage_api_key',
  'locationiq_api_key',
  'smarty_auth_id',
  'smarty_auth_token',
  'db_admin_password',
];

// Credential keys: AWS Secrets Manager is the sole source of truth.
// Environment variables must NEVER override these — secrets are never written to disk.
const CREDENTIAL_SECRETS = new Set(['db_password', 'db_admin_password']);

// Secrets that should be auto-generated if missing from AWS SM.
// DO NOT add db_password or db_admin_password here — they must always match
// the PostgreSQL actual passwords (set during bootstrap). Auto-generating
// them would overwrite AWS SM with a password PostgreSQL doesn't know about.
const AUTO_GEN_SECRETS: string[] = [];

class SecretsManager {
  secrets = new Map<string, string>();
  accessLog: AccessLogEntry[] = [];
  private awsCache: Record<string, string> | null = null;
  private awsLoaded = false;
  private deferredRetryScheduled = false;

  /** Exposed to health check — describes why SM is unreachable (if it is). */
  smLastError: string | null = null;
  /** True once SM has been successfully contacted at least once. */
  smReachable = false;

  private generatePassword(): string {
    return randomBytes(32).toString('base64').replace(/[=+/]/g, '').slice(0, 32);
  }

  private async loadAwsSecretBlob(): Promise<Record<string, string>> {
    if (this.awsLoaded) return this.awsCache || {};
    // Skip AWS SM entirely in test environment unless explicitly requested
    if (process.env.NODE_ENV === 'test' && !process.env.FORCE_AWS_SM) {
      this.awsLoaded = true;
      return {};
    }
    this.awsLoaded = true;
    try {
      const client = new SecretsManagerClient({ region: AWS_REGION });
      const response = await client.send(new GetSecretValueCommand({ SecretId: AWS_SECRET_NAME }));
      if (response.SecretString) {
        this.awsCache = JSON.parse(response.SecretString);
        this.smReachable = true;
        this.smLastError = null;
        console.log(
          `[SecretsManager] Loaded secrets from AWS Secrets Manager (${AWS_SECRET_NAME})`
        );
        return this.awsCache!;
      }
    } catch (err: any) {
      // Reset flag so next call retries (handles cold-start where IMDS isn't ready yet)
      this.awsLoaded = false;
      this.smReachable = false;
      this.smLastError = err.name || err.message || 'Unknown error';
      if (err.name !== 'ResourceNotFoundException') {
        console.log(`[SecretsManager] AWS Secrets Manager unavailable: ${err.name || err.message}`);
      }
    }
    return {};
  }

  private logAccess(secret: string, found: boolean): void {
    this.accessLog.push({
      secret,
      found,
      timestamp: new Date().toISOString(),
    });
  }

  private getEnvOverride(secret: string): string | null {
    const envKey = secret.toUpperCase();
    const value = process.env[envKey];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
    return null;
  }

  async load(): Promise<void> {
    this.secrets.clear();

    const blob = await this.loadAwsSecretBlob();
    const allSecrets = [...REQUIRED_SECRETS, ...OPTIONAL_SECRETS];
    const generated: Record<string, string> = {};

    for (const secret of allSecrets) {
      // For credential keys, AWS SM is the primary source of truth.
      // If SM was unreachable OR the secret is missing from the SM blob,
      // fall back to env vars so local dev and tests still work.
      if (CREDENTIAL_SECRETS.has(secret)) {
        const smValue = blob[secret];
        if (smValue) {
          this.secrets.set(secret, smValue);
          continue;
        }

        // SM didn't have it (or was unreachable) — try env fallback
        const envFallback = this.getEnvOverride(secret);
        if (envFallback) {
          this.secrets.set(secret, envFallback);
          continue;
        }

        // Fall through to auto-gen or error below
      } else {
        // Non-credential keys: env override is fine
        const envOverride = this.getEnvOverride(secret);
        if (envOverride) {
          this.secrets.set(secret, envOverride);
          continue;
        }

        const value = blob[secret];
        if (value) {
          this.secrets.set(secret, value);
          continue;
        }
      }

      // Auto-generate missing secrets that support it
      if (AUTO_GEN_SECRETS.includes(secret)) {
        const newPassword = this.generatePassword();
        this.secrets.set(secret, newPassword);
        generated[secret] = newPassword;
        console.log(`[SecretsManager] Auto-generated '${secret}' (will persist to AWS SM)`);
        continue;
      }

      if (REQUIRED_SECRETS.includes(secret)) {
        // Required but not auto-gennable
        throw new Error(
          `Required secret '${secret}' not found in AWS Secrets Manager (${AWS_SECRET_NAME}) and no environment fallback found.`
        );
      }
    }

    // Persist any auto-generated secrets back to AWS SM (never in test mode)
    if (Object.keys(generated).length > 0 && process.env.NODE_ENV !== 'test') {
      try {
        await this.putSecrets(generated);
        console.log(
          `[SecretsManager] Persisted ${Object.keys(generated).length} auto-generated secret(s) to AWS SM`
        );
      } catch (err: any) {
        console.warn(
          `[SecretsManager] Could not persist auto-generated secrets to AWS SM: ${err.message}`
        );
        console.warn('[SecretsManager] Secrets are in-memory only — they will be lost on restart!');
      }
    }

    const mapboxToken = this.secrets.get('mapbox_token');
    if (mapboxToken && !mapboxToken.startsWith('pk.')) {
      console.warn('[SecretsManager] MAPBOX_TOKEN should start with "pk."');
    }

    // If AWS SM wasn't reachable (cold-start or expired creds), schedule periodic
    // retries so the app self-heals when credentials are refreshed (e.g. aws sso login).
    // Never schedule retries in test environment.
    if (!this.awsLoaded && !this.deferredRetryScheduled && process.env.NODE_ENV !== 'test') {
      this.deferredRetryScheduled = true;
      this.scheduleRetry();
    }
  }

  private scheduleRetry(delayMs = 10_000): void {
    const MAX_RETRY_INTERVAL = 5 * 60_000; // cap at 5 minutes
    if (process.env.NODE_ENV === 'test') return;

    setTimeout(async () => {
      const success = await this.retryAwsLoad();
      if (!success) {
        // Exponential backoff, capped
        const nextDelay = Math.min(delayMs * 2, MAX_RETRY_INTERVAL);
        this.scheduleRetry(nextDelay);
      } else {
        this.deferredRetryScheduled = false; // allow future retry cycles if SM goes away again
      }
    }, delayMs);
  }

  private async retryAwsLoad(): Promise<boolean> {
    if (process.env.NODE_ENV === 'test') return false;
    try {
      const blob = await this.loadAwsSecretBlob();
      if (!blob || Object.keys(blob).length === 0) return false;

      let updated = 0;
      for (const [key, value] of Object.entries(blob)) {
        const current = this.secrets.get(key);
        if (current !== value) {
          this.secrets.set(key, value);
          updated++;
        }
      }
      if (updated > 0) {
        console.log(`[SecretsManager] Deferred AWS retry: refreshed ${updated} secret(s)`);
      }
      return true;
    } catch (err: any) {
      console.log(`[SecretsManager] Deferred AWS retry failed: ${err.message}`);
      return false;
    }
  }

  get(secret: string): string | null {
    const key = secret.toLowerCase();
    // Credential keys: SM is source of truth when reachable and secret is present in SM.
    // If secret is missing from SM or SM is unreachable, use env/cache.
    const value = this.secrets.get(key) ?? this.getEnvOverride(key) ?? null;
    this.logAccess(key, Boolean(value));
    return value;
  }

  getOrThrow(secret: string): string {
    const value = this.get(secret);
    if (!value) {
      throw new Error(`Secret '${secret}' is required but not available`);
    }
    return value;
  }

  has(secret: string): boolean {
    const key = secret.toLowerCase();
    return Boolean(this.secrets.has(key) || this.getEnvOverride(key));
  }

  getAccessLog(): AccessLogEntry[] {
    return [...this.accessLog];
  }

  async putSecret(key: string, value: string): Promise<void> {
    const normalized = key.toLowerCase();
    this.secrets.set(normalized, value);

    if (process.env.NODE_ENV === 'test') return;

    try {
      const client = new SecretsManagerClient({ region: AWS_REGION });
      const current = await client.send(new GetSecretValueCommand({ SecretId: AWS_SECRET_NAME }));
      const blob: Record<string, string> = current.SecretString
        ? JSON.parse(current.SecretString)
        : {};
      blob[normalized] = value;
      await client.send(
        new PutSecretValueCommand({
          SecretId: AWS_SECRET_NAME,
          SecretString: JSON.stringify(blob),
        })
      );
      // Update local cache
      this.awsCache = blob;
      console.log(`[SecretsManager] Persisted '${normalized}' to AWS Secrets Manager`);
    } catch (err: any) {
      console.warn(`[SecretsManager] Failed to write '${normalized}' to AWS SM: ${err.message}`);
    }
  }

  async putSecrets(updates: Record<string, string>): Promise<void> {
    // Update in-memory cache
    for (const [key, value] of Object.entries(updates)) {
      const normalized = key.toLowerCase();
      this.secrets.set(normalized, value);
    }

    if (process.env.NODE_ENV === 'test') return;

    try {
      const client = new SecretsManagerClient({ region: AWS_REGION });
      const current = await client.send(new GetSecretValueCommand({ SecretId: AWS_SECRET_NAME }));
      const blob: Record<string, string> = current.SecretString
        ? JSON.parse(current.SecretString)
        : {};
      for (const [key, value] of Object.entries(updates)) {
        blob[key.toLowerCase()] = value;
      }
      await client.send(
        new PutSecretValueCommand({
          SecretId: AWS_SECRET_NAME,
          SecretString: JSON.stringify(blob),
        })
      );
      this.awsCache = blob;
      console.log(
        `[SecretsManager] Persisted ${Object.keys(updates).length} secret(s) to AWS Secrets Manager`
      );
    } catch (err: any) {
      const errorMsg = `Failed to write secrets to AWS SM: ${err.message}`;
      console.error(`[SecretsManager] ${errorMsg}`);
      throw new Error(errorMsg);
    }
  }

  async deleteSecret(key: string): Promise<void> {
    const normalized = key.toLowerCase();
    this.secrets.delete(normalized);

    try {
      const client = new SecretsManagerClient({ region: AWS_REGION });
      const current = await client.send(new GetSecretValueCommand({ SecretId: AWS_SECRET_NAME }));
      const blob: Record<string, string> = current.SecretString
        ? JSON.parse(current.SecretString)
        : {};
      delete blob[normalized];
      await client.send(
        new PutSecretValueCommand({
          SecretId: AWS_SECRET_NAME,
          SecretString: JSON.stringify(blob),
        })
      );
      this.awsCache = blob;
      console.log(`[SecretsManager] Deleted '${normalized}' from AWS Secrets Manager`);
    } catch (err: any) {
      console.warn(`[SecretsManager] Failed to delete '${normalized}' from AWS SM: ${err.message}`);
    }
  }

  async getSecret(name: string): Promise<string | null> {
    const normalized = name.toLowerCase();
    if (!this.secrets.size || !this.secrets.has(normalized)) {
      await this.load();
    }
    return this.get(normalized);
  }
}

const secretsManager = new SecretsManager();
export default secretsManager;
