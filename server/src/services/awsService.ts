export {};
const { query } = require('../config/database');

const AWS_REGION_SETTING_KEY = 'aws_region';
const IMDS_BASE_URL = 'http://169.254.169.254';
const IMDS_TOKEN_TTL_SECONDS = '21600';
const IMDS_TIMEOUT_MS = 1000;

let cachedImdsRegion: string | null | undefined;

const fetchText = async (url: string, options: RequestInit = {}): Promise<string | null> => {
  try {
    const response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(IMDS_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
};

const getImdsToken = async (): Promise<string | null> => {
  return fetchText(`${IMDS_BASE_URL}/latest/api/token`, {
    method: 'PUT',
    headers: {
      'X-aws-ec2-metadata-token-ttl-seconds': IMDS_TOKEN_TTL_SECONDS,
    },
  });
};

const getRegionFromInstanceMetadata = async (): Promise<string | null> => {
  if (cachedImdsRegion !== undefined) {
    return cachedImdsRegion;
  }

  const token = await getImdsToken();
  const headers: Record<string, string> = token ? { 'X-aws-ec2-metadata-token': token } : {};

  const identityDocument = await fetchText(
    `${IMDS_BASE_URL}/latest/dynamic/instance-identity/document`,
    { headers }
  );

  if (!identityDocument) {
    cachedImdsRegion = null;
    return cachedImdsRegion;
  }

  try {
    const parsed = JSON.parse(identityDocument) as { region?: unknown };
    cachedImdsRegion = typeof parsed.region === 'string' ? parsed.region : null;
  } catch {
    cachedImdsRegion = null;
  }

  return cachedImdsRegion;
};

const getConfiguredAwsRegion = async (): Promise<string | null> => {
  const result = await query('SELECT value FROM app.settings WHERE key = $1 LIMIT 1', [
    AWS_REGION_SETTING_KEY,
  ]);
  const raw = result.rows[0]?.value;
  if (!raw) return null;
  return typeof raw === 'string' ? raw : String(raw);
};

const getAwsRegion = async (): Promise<string | null> => {
  return (
    (await getConfiguredAwsRegion()) ||
    process.env.AWS_REGION ||
    process.env.AWS_DEFAULT_REGION ||
    (await getRegionFromInstanceMetadata()) ||
    null
  );
};

const getAwsConfig = async () => {
  const region = await getAwsRegion();
  return {
    region,
    // Explicit credential injection is intentionally disabled.
    // AWS SDK/CLI must resolve credentials from the runtime provider chain
    // (instance profile, STS, SSO, etc.).
    credentials: undefined,
    hasExplicitCredentials: false,
  };
};

module.exports = {
  getAwsConfig,
  getAwsRegion,
  getConfiguredAwsRegion,
};
