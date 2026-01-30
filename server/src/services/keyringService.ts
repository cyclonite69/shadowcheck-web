import { randomBytes, scryptSync, createCipheriv, createDecipheriv } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { hostname, userInfo } from 'os';

// Use XDG_DATA_HOME or fallback to ~/.local/share
const DATA_DIR = process.env.XDG_DATA_HOME
  ? join(process.env.XDG_DATA_HOME, 'shadowcheck')
  : join(homedir(), '.local', 'share', 'shadowcheck');

const KEYRING_FILE = join(DATA_DIR, 'keyring.enc');

interface WigleCredentials {
  apiName: string;
  apiToken: string;
  encoded: string;
}

interface WigleTestResult {
  success: boolean;
  error?: string;
  user?: unknown;
}

interface MapboxTokenInfo {
  label: string;
  isPrimary: boolean;
}

interface KeyringData {
  [key: string]: string;
}

// Derive encryption key from machine-specific data
function getMachineKey(): Buffer {
  const machineId = hostname() + userInfo().username;
  return scryptSync(machineId, 'shadowcheck-salt', 32);
}

/**
 * File-based encrypted keyring service
 * Stores credentials in an encrypted file at ~/.local/share/shadowcheck/keyring.enc
 */
class FileKeyringService {
  private cache: KeyringData | null = null;

  async ensureDataDir(): Promise<void> {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true, mode: 0o700 });
    } catch (err: any) {
      if (err.code !== 'EEXIST') {
        throw err;
      }
    }
  }

  async loadKeyring(): Promise<KeyringData> {
    if (this.cache) {
      return this.cache;
    }

    try {
      const encrypted = await fs.readFile(KEYRING_FILE, 'utf8');
      const [ivHex, encryptedData] = encrypted.split(':');

      const key = getMachineKey();
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = createDecipheriv('aes-256-gcm', key, iv);

      // Extract auth tag (last 16 bytes)
      const encBuffer = Buffer.from(encryptedData, 'hex');
      const authTag = encBuffer.slice(-16);
      const ciphertext = encBuffer.slice(0, -16);

      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(ciphertext);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      this.cache = JSON.parse(decrypted.toString('utf8'));
      return this.cache;
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        this.cache = {} as KeyringData;
        return this.cache;
      }
      throw err;
    }
  }

  async saveKeyring(data: KeyringData): Promise<void> {
    await this.ensureDataDir();

    const key = getMachineKey();
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(JSON.stringify(data), 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    const authTag = cipher.getAuthTag();
    const combined = Buffer.concat([encrypted, authTag]);

    const output = `${iv.toString('hex')}:${combined.toString('hex')}`;

    await fs.writeFile(KEYRING_FILE, output, { mode: 0o600 });
    this.cache = data;
  }

  async setCredential(key: string, value: string): Promise<void> {
    const keyring = await this.loadKeyring();
    keyring[key] = value;
    await this.saveKeyring(keyring);
  }

  async getCredential(key: string): Promise<string | null> {
    const keyring = await this.loadKeyring();
    return keyring[key] || null;
  }

  async deleteCredential(key: string): Promise<boolean> {
    const keyring = await this.loadKeyring();
    delete keyring[key];
    await this.saveKeyring(keyring);
    return true;
  }

  async listCredentials(): Promise<string[]> {
    const keyring = await this.loadKeyring();
    return Object.keys(keyring);
  }

  // WiGLE API specific
  async setWigleCredentials(apiName: string, apiToken: string): Promise<void> {
    await this.setCredential('wigle_api_name', apiName);
    await this.setCredential('wigle_api_token', apiToken);
    const encoded = Buffer.from(`${apiName}:${apiToken}`).toString('base64');
    await this.setCredential('wigle_api_encoded', encoded);
  }

  async getWigleCredentials(): Promise<WigleCredentials | null> {
    const apiName = await this.getCredential('wigle_api_name');
    const apiToken = await this.getCredential('wigle_api_token');
    const encoded = await this.getCredential('wigle_api_encoded');

    if (!apiName || !apiToken) {
      return null;
    }

    return { apiName, apiToken, encoded: encoded || '' };
  }

  async testWigleCredentials(): Promise<WigleTestResult> {
    const creds = await this.getWigleCredentials();
    if (!creds) {
      return { success: false, error: 'No credentials stored' };
    }

    try {
      const response = await fetch('https://api.wigle.net/api/v2/profile/user', {
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${creds.encoded}`,
        },
      });

      if (response.ok) {
        const data = (await response.json()) as any; // API response shape is unknown
        return { success: true, user: data.user };
      } else {
        return { success: false, error: `HTTP ${response.status}` };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Mapbox tokens (supports multiple with labels)
  async setMapboxToken(token: string, label: string = 'default'): Promise<void> {
    const key = `mapbox_token_${label}`;
    await this.setCredential(key, token);
    const primary = await this.getCredential('mapbox_primary');
    if (!primary) {
      await this.setCredential('mapbox_primary', label);
    }
  }

  async getMapboxToken(label?: string): Promise<string | null> {
    if (!label) {
      label = (await this.getCredential('mapbox_primary')) || 'default';
    }
    const token = await this.getCredential(`mapbox_token_${label}`);

    // Fallback to environment variable
    if (
      !token &&
      label === 'default' &&
      process.env.MAPBOX_TOKEN &&
      process.env.MAPBOX_TOKEN !== 'your-mapbox-token-here'
    ) {
      return process.env.MAPBOX_TOKEN;
    }

    return token;
  }

  async listMapboxTokens(): Promise<MapboxTokenInfo[]> {
    const all = await this.listCredentials();
    const tokens = all.filter((k) => k.startsWith('mapbox_token_'));
    const primary = await this.getCredential('mapbox_primary');
    return tokens.map((k) => ({
      label: k.replace('mapbox_token_', ''),
      isPrimary: k.replace('mapbox_token_', '') === primary,
    }));
  }

  async setPrimaryMapboxToken(label: string): Promise<void> {
    await this.setCredential('mapbox_primary', label);
  }

  async deleteMapboxToken(label: string): Promise<void> {
    await this.deleteCredential(`mapbox_token_${label}`);
  }
}

export default new FileKeyringService();
