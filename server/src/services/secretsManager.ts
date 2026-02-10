import { promises as fs } from 'fs';
import path from 'path';

const keyringService = require('./keyringService').default;

export {};

type SecretSource = 'keyring' | 'local' | 'env';

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

  private async loadFromKeyring(secret: string): Promise<string | null> {
    try {
      if (secret === 'mapbox_token') {
        const envBackup = process.env.MAPBOX_TOKEN;
        if (envBackup !== undefined) {
          delete process.env.MAPBOX_TOKEN;
        }
        try {
          return await keyringService.getMapboxToken();
        } finally {
          if (envBackup !== undefined) {
            process.env.MAPBOX_TOKEN = envBackup;
          }
        }
      }
      return await keyringService.getCredential(secret);
    } catch {
      return null;
    }
  }

  private async resolveSecret(
    secret: string
  ): Promise<{ value: string | null; source?: SecretSource }> {
    const keyringValue = await this.loadFromKeyring(secret);
    if (keyringValue) {
      return { value: keyringValue, source: 'keyring' };
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
        'Tried Keyring, local secrets (./secrets), Environment',
        'Hint: use npx tsx scripts/set-secret.ts <secret_name> to store secrets in the keyring',
      ].join('. ');
      throw new Error(message);
    }

    const mapboxToken = this.secrets.get('mapbox_token');
    if (mapboxToken && !mapboxToken.startsWith('pk.')) {
      console.warn('[SecretsManager] MAPBOX_TOKEN should start with "pk."');
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
