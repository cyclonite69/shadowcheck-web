const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Use XDG_DATA_HOME or fallback to ~/.local/share
const DATA_DIR = process.env.XDG_DATA_HOME
  ? path.join(process.env.XDG_DATA_HOME, 'shadowcheck')
  : path.join(os.homedir(), '.local', 'share', 'shadowcheck');

const KEYRING_FILE = path.join(DATA_DIR, 'keyring.enc');
const SERVICE_NAME = 'shadowcheck';

// Derive encryption key from machine-specific data
function getMachineKey() {
  const machineId = os.hostname() + os.userInfo().username;
  return crypto.scryptSync(machineId, 'shadowcheck-salt', 32);
}

/**
 * File-based encrypted keyring service
 * Stores credentials in an encrypted file at ~/.local/share/shadowcheck/keyring.enc
 */
class FileKeyringService {
  constructor() {
    this.cache = null;
  }

  async ensureDataDir() {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true, mode: 0o700 });
    } catch (err) {
      if (err.code !== 'EEXIST') {throw err;}
    }
  }

  async loadKeyring() {
    if (this.cache) {return this.cache;}

    try {
      const encrypted = await fs.readFile(KEYRING_FILE, 'utf8');
      const [ivHex, encryptedData] = encrypted.split(':');

      const key = getMachineKey();
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);

      // Extract auth tag (last 16 bytes)
      const encBuffer = Buffer.from(encryptedData, 'hex');
      const authTag = encBuffer.slice(-16);
      const ciphertext = encBuffer.slice(0, -16);

      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(ciphertext);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      this.cache = JSON.parse(decrypted.toString('utf8'));
      return this.cache;
    } catch (err) {
      if (err.code === 'ENOENT') {
        this.cache = {};
        return this.cache;
      }
      throw err;
    }
  }

  async saveKeyring(data) {
    await this.ensureDataDir();

    const key = getMachineKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(JSON.stringify(data), 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    const authTag = cipher.getAuthTag();
    const combined = Buffer.concat([encrypted, authTag]);

    const output = `${iv.toString('hex')}:${combined.toString('hex')}`;

    await fs.writeFile(KEYRING_FILE, output, { mode: 0o600 });
    this.cache = data;
  }

  async setCredential(key, value) {
    const keyring = await this.loadKeyring();
    keyring[key] = value;
    await this.saveKeyring(keyring);
  }

  async getCredential(key) {
    const keyring = await this.loadKeyring();
    return keyring[key] || null;
  }

  async deleteCredential(key) {
    const keyring = await this.loadKeyring();
    delete keyring[key];
    await this.saveKeyring(keyring);
    return true;
  }

  async listCredentials() {
    const keyring = await this.loadKeyring();
    return Object.keys(keyring);
  }

  // WiGLE API specific
  async setWigleCredentials(apiName, apiToken) {
    await this.setCredential('wigle_api_name', apiName);
    await this.setCredential('wigle_api_token', apiToken);
    const encoded = Buffer.from(`${apiName}:${apiToken}`).toString('base64');
    await this.setCredential('wigle_api_encoded', encoded);
  }

  async getWigleCredentials() {
    const apiName = await this.getCredential('wigle_api_name');
    const apiToken = await this.getCredential('wigle_api_token');
    const encoded = await this.getCredential('wigle_api_encoded');

    if (!apiName || !apiToken) {return null;}

    return { apiName, apiToken, encoded };
  }

  async testWigleCredentials() {
    const creds = await this.getWigleCredentials();
    if (!creds) {return { success: false, error: 'No credentials stored' };}

    try {
      const response = await fetch('https://api.wigle.net/api/v2/profile/user', {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Basic ${creds.encoded}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return { success: true, user: data.user };
      } else {
        return { success: false, error: `HTTP ${response.status}` };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Mapbox tokens (supports multiple with labels)
  async setMapboxToken(token, label = 'default') {
    const key = `mapbox_token_${label}`;
    await this.setCredential(key, token);
    const primary = await this.getCredential('mapbox_primary');
    if (!primary) {
      await this.setCredential('mapbox_primary', label);
    }
  }

  async getMapboxToken(label = null) {
    if (!label) {
      label = await this.getCredential('mapbox_primary') || 'default';
    }
    const token = await this.getCredential(`mapbox_token_${label}`);

    // Fallback to environment variable
    if (!token && label === 'default' && process.env.MAPBOX_TOKEN && process.env.MAPBOX_TOKEN !== 'your-mapbox-token-here') {
      return process.env.MAPBOX_TOKEN;
    }

    return token;
  }

  async listMapboxTokens() {
    const all = await this.listCredentials();
    const tokens = all.filter(k => k.startsWith('mapbox_token_'));
    const primary = await this.getCredential('mapbox_primary');
    return tokens.map(k => ({
      label: k.replace('mapbox_token_', ''),
      isPrimary: k.replace('mapbox_token_', '') === primary,
    }));
  }

  async setPrimaryMapboxToken(label) {
    await this.setCredential('mapbox_primary', label);
  }

  async deleteMapboxToken(label) {
    await this.deleteCredential(`mapbox_token_${label}`);
  }
}

module.exports = new FileKeyringService();
