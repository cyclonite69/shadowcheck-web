import { promises as fs } from 'fs';
import path from 'path';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
  PutSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

export {};

const AWS_SECRET_NAME = process.env.SHADOWCHECK_AWS_SECRET || 'shadowcheck/config';
const AWS_REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';

type SecretSource = 'aws' | 'local' | 'env';

type AccessLogEntry = {
  secret: string;
  found: boolean;
  source?: SecretSource;
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

const ENV_KEY_ALIASES: Record<string, string[]> = {
  db_password: ['DB_PASSWORD'],
  db_admin_password: ['DB_ADMIN_PASSWORD'],
  mapbox_token: ['MAPBOX_TOKEN'],
  wigle_api_name: ['WIGLE_API_NAME', 'WIGLE_API_KEY'],
  wigle_api_token: ['WIGLE_API_TOKEN'],
  wigle_api_encoded: ['WIGLE_API_ENCODED'],
  google_maps_api_key: ['GOOGLE_MAPS_API_KEY'],
  mapbox_unlimited_api_key: ['MAPBOX_UNLIMITED_API_KEY', 'MAPBOX_GEOCODING_KEY'],
  aws_access_key_id: ['AWS_ACCESS_KEY_ID'],
  aws_secret_access_key: ['AWS_SECRET_ACCESS_KEY'],
  aws_region: ['AWS_REGION', 'AWS_DEFAULT_REGION'],
  opencage_api_key: ['OPENCAGE_API_KEY'],
  locationiq_api_key: ['LOCATIONIQ_API_KEY'],
  smarty_auth_id: ['SMARTY_AUTH_ID'],
  smarty_auth_token: ['SMARTY_AUTH_TOKEN'],
};

const LOCAL_SECRETS_DIR = path.resolve(process.cwd(), 'secrets');

class SecretsManager {
  secrets = new Map<string, string>();
  sources = new Map<string, SecretSource>();
  accessLog: AccessLogEntry[] = [];
  private awsCache: Record<string, string> | null = null;
  private awsLoaded = false;
  private deferredRetryScheduled = false;

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

  private async loadFromAws(secret: string): Promise<string | null> {
    const blob = await this.loadAwsSecretBlob();
    return blob[secret] || null;
  }

  private logAccess(secret: string, found: boolean, source?: SecretSource): void {
    this.accessLog.push({
      secret,
      found,
      source,
      timestamp: new Date().toISOString(),
    });
  }

  private async loadFromLocal(secret: string): Promise<string | null> {
    const filePath = path.join(LOCAL_SECRETS_DIR, secret);
    try {
      const value = await fs.readFile(filePath, 'utf8');
      return value.trim();
    } catch {
      return null;
    }
  }

  private async resolveSecret(
    secret: string
  ): Promise<{ value: string | null; source?: SecretSource }> {
    const awsValue = await this.loadFromAws(secret);
    if (awsValue) {
      return { value: awsValue, source: 'aws' };
    }

    const localValue = await this.loadFromLocal(secret);
    if (localValue) {
      return { value: localValue, source: 'local' };
    }

    const envValue = this.loadFromEnv(secret);
    if (envValue) {
      return { value: envValue, source: 'env' };
    }

    return { value: null };
  }

  private loadFromEnv(secret: string): string | null {
    const aliases = ENV_KEY_ALIASES[secret] || [secret.toUpperCase()];
    for (const key of aliases) {
      const value = process.env[key];
      if (value) {
        return value;
      }
    }
    return null;
  }

  private register(secret: string, value: string, source: SecretSource): void {
    this.secrets.set(secret, value);
    this.sources.set(secret, source);
  }

  async load(): Promise<void> {
    this.secrets.clear();
    this.sources.clear();

    const allSecrets = [...REQUIRED_SECRETS, ...OPTIONAL_SECRETS];
    let usedEnvInProduction = false;

    for (const secret of allSecrets) {
      const resolved = await this.resolveSecret(secret);
      if (resolved.value && resolved.source) {
        this.register(secret, resolved.value, resolved.source);
        if (resolved.source === 'env' && process.env.NODE_ENV === 'production') {
          usedEnvInProduction = true;
        }
        continue;
      }

      if (!REQUIRED_SECRETS.includes(secret)) {
        console.log(`[SecretsManager] ${secret} not found (optional)`);
      }
    }

    if (usedEnvInProduction) {
      console.warn(
        '[SecretsManager] Warning: one or more secrets loaded from env vars in production'
      );
    }

    const missingRequired = REQUIRED_SECRETS.filter((secret) => !this.secrets.has(secret));
    if (missingRequired.length > 0) {
      const missing = missingRequired[0];
      const message = [
        `Required secret '${missing}' not found`,
        'Tried AWS Secrets Manager, local secrets (./secrets), Environment',
        'Hint: store in AWS Secrets Manager (shadowcheck/config) or set via environment variable',
      ].join('. ');
      throw new Error(message);
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
          this.register(key, value, 'aws');
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
    this.logAccess(key, Boolean(value), this.sources.get(key));
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

  getSource(secret: string): SecretSource | undefined {
    return this.sources.get(secret);
  }

  getAccessLog(): AccessLogEntry[] {
    return [...this.accessLog];
  }

  async putSecret(key: string, value: string): Promise<void> {
    const normalized = key.toLowerCase();
    this.secrets.set(normalized, value);
    this.sources.set(normalized, 'aws');

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
      this.sources.set(normalized, 'aws');
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
      console.warn(`[SecretsManager] Failed to write secrets to AWS SM: ${err.message}`);
    }
  }

  async deleteSecret(key: string): Promise<void> {
    const normalized = key.toLowerCase();
    this.secrets.delete(normalized);
    this.sources.delete(normalized);

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

    const resolved = await this.resolveSecret(normalized);
    if (resolved.value && resolved.source) {
      this.register(normalized, resolved.value, resolved.source);
      return resolved.value;
    }

    return null;
  }
}

const secretsManager = new SecretsManager();
export default secretsManager;
