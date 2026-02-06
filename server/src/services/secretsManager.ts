import { promises as fs } from 'fs';

const keyringService = require('./keyringService').default;

export {};

type SecretSource = 'docker' | 'keyring' | 'env';

type AccessLogEntry = {
  secret: string;
  found: boolean;
  source?: SecretSource;
  timestamp: string;
};

const REQUIRED_SECRETS = ['db_password', 'mapbox_token'];
const OPTIONAL_SECRETS = [
  'api_key',
  'wigle_api_name',
  'wigle_api_token',
  'wigle_api_encoded',
  'google_maps_api_key',
  'aws_access_key_id',
  'aws_secret_access_key',
  'aws_session_token',
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
  api_key: ['API_KEY'],
  wigle_api_name: ['WIGLE_API_NAME', 'WIGLE_API_KEY'],
  wigle_api_token: ['WIGLE_API_TOKEN'],
  wigle_api_encoded: ['WIGLE_API_ENCODED'],
  google_maps_api_key: ['GOOGLE_MAPS_API_KEY'],
  aws_access_key_id: ['AWS_ACCESS_KEY_ID'],
  aws_secret_access_key: ['AWS_SECRET_ACCESS_KEY'],
  aws_session_token: ['AWS_SESSION_TOKEN'],
  aws_region: ['AWS_REGION', 'AWS_DEFAULT_REGION'],
  opencage_api_key: ['OPENCAGE_API_KEY'],
  locationiq_api_key: ['LOCATIONIQ_API_KEY'],
  smarty_auth_id: ['SMARTY_AUTH_ID'],
  smarty_auth_token: ['SMARTY_AUTH_TOKEN'],
};

const DOCKER_SECRETS_DIR = '/run/secrets';

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

  private async loadFromDocker(secret: string): Promise<string | null> {
    const filePath = `${DOCKER_SECRETS_DIR}/${secret}`;
    try {
      const value = await fs.readFile(filePath, 'utf8');
      return value.trim();
    } catch {
      return null;
    }
  }

  private async loadFromKeyring(secret: string): Promise<string | null> {
    try {
      return await keyringService.getCredential(secret);
    } catch {
      return null;
    }
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
      const keyringValue = await this.loadFromKeyring(secret);
      if (keyringValue) {
        this.register(secret, keyringValue, 'keyring');
        continue;
      }

      const dockerValue = await this.loadFromDocker(secret);
      if (dockerValue) {
        this.register(secret, dockerValue, 'docker');
        continue;
      }

      const envValue = this.loadFromEnv(secret);
      if (envValue) {
        this.register(secret, envValue, 'env');
        if (process.env.NODE_ENV === 'production') {
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
        'Tried Docker secrets (/run/secrets), Keyring, Environment',
        'Hint: use scripts/keyring-cli.js set <secret_name> to store secrets locally',
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

    const envAliases = ENV_KEY_ALIASES[normalized] || [name.toUpperCase()];
    for (const alias of envAliases) {
      const value = process.env[alias];
      if (value) {
        return value;
      }
    }

    return null;
  }
}

module.exports = new SecretsManager();
