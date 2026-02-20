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
  'aws_access_key_id',
  'aws_secret_access_key',
  'aws_region',
  'opencage_api_key',
  'locationiq_api_key',
  'smarty_auth_id',
  'smarty_auth_token',
  'db_admin_password',
];

// Secrets that should be auto-generated if missing from AWS SM.
// DO NOT add db_admin_password here — it must always match the PostgreSQL
// shadowcheck_admin user's actual password (set during bootstrap). Auto-generating
// it would overwrite AWS SM with a password PostgreSQL doesn't know about.
const AUTO_GEN_SECRETS = ['db_password'];

class SecretsManager {
  secrets = new Map<string, string>();
  accessLog: AccessLogEntry[] = [];
  private awsCache: Record<string, string> | null = null;
  private awsLoaded = false;
  private deferredRetryScheduled = false;

  private generatePassword(): string {
    return randomBytes(32).toString('base64').replace(/[=+/]/g, '').slice(0, 32);
  }

  private async loadAwsSecretBlob(): Promise<Record<string, string>> {
    if (this.awsLoaded) return this.awsCache || {};
    this.awsLoaded = true;
    try {
      const client = new SecretsManagerClient({ region: AWS_REGION });
      const response = await client.send(new GetSecretValueCommand({ SecretId: AWS_SECRET_NAME }));
      if (response.SecretString) {
        this.awsCache = JSON.parse(response.SecretString);
        console.log(
          `[SecretsManager] Loaded secrets from AWS Secrets Manager (${AWS_SECRET_NAME})`
        );
        return this.awsCache!;
      }
    } catch (err: any) {
      // Reset flag so next call retries (handles cold-start where IMDS isn't ready yet)
      this.awsLoaded = false;
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

  async load(): Promise<void> {
    this.secrets.clear();

    const blob = await this.loadAwsSecretBlob();
    const allSecrets = [...REQUIRED_SECRETS, ...OPTIONAL_SECRETS];
    const generated: Record<string, string> = {};

    for (const secret of allSecrets) {
      const value = blob[secret];
      if (value) {
        this.secrets.set(secret, value);
        continue;
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
        // Required but not auto-gennable — shouldn't happen since all required are in AUTO_GEN
        throw new Error(
          `Required secret '${secret}' not found in AWS Secrets Manager (${AWS_SECRET_NAME})`
        );
      }
    }

    // Persist any auto-generated secrets back to AWS SM
    if (Object.keys(generated).length > 0) {
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

    // If AWS SM wasn't reachable (cold-start), schedule a deferred retry to refresh secrets
    if (!this.awsLoaded && !this.deferredRetryScheduled) {
      this.deferredRetryScheduled = true;
      setTimeout(() => this.retryAwsLoad(), 10_000);
    }
  }

  private async retryAwsLoad(): Promise<void> {
    try {
      const blob = await this.loadAwsSecretBlob();
      if (!blob || Object.keys(blob).length === 0) return;

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
    } catch (err: any) {
      console.log(`[SecretsManager] Deferred AWS retry failed: ${err.message}`);
    }
  }

  get(secret: string): string | null {
    const key = secret.toLowerCase();
    const value = this.secrets.get(key) ?? null;
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
    return this.secrets.has(secret);
  }

  getAccessLog(): AccessLogEntry[] {
    return [...this.accessLog];
  }

  async putSecret(key: string, value: string): Promise<void> {
    const normalized = key.toLowerCase();
    this.secrets.set(normalized, value);

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
    if (!this.secrets.size) {
      await this.load();
    }
    if (this.secrets.has(normalized)) {
      return this.get(normalized);
    }
    return null;
  }
}

const secretsManager = new SecretsManager();
export default secretsManager;
