export {};
/**
 * Bedrock Service
 *
 * Wraps AWS Bedrock Runtime to invoke Claude for network analysis.
 * Uses the Messages API (anthropic_version: bedrock-2023-05-31).
 * Credentials are resolved automatically by the AWS SDK via IAM role,
 * environment variables, or ~/.aws/credentials — in that order.
 */

const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const secretsManager = require('./secretsManager').default;
const logger = require('../logging/logger');

const DEFAULT_REGION = 'us-east-1';
const MODEL_ID = 'us.anthropic.claude-3-5-haiku-20241022-v1:0';
const MAX_TOKENS = 2048;

function getRegion(): string {
  return secretsManager.get('aws_region') || process.env.AWS_REGION || DEFAULT_REGION;
}

function buildClient(): InstanceType<typeof BedrockRuntimeClient> {
  return new BedrockRuntimeClient({ region: getRegion() });
}

interface NetworkSummary {
  bssid?: string;
  ssid?: string | null;
  type?: string;
  threat_score?: number;
  observation_count?: number;
  unique_days?: number;
  seen_at_home?: boolean;
  seen_away?: boolean;
  [key: string]: unknown;
}

interface AnalysisResult {
  analysis: string;
  suggestions: string[];
}

/**
 * Summarize networks into a compact string for the prompt.
 * Caps at 50 networks to avoid exceeding token limits.
 */
function summarizeNetworks(networks: NetworkSummary[]): string {
  const sample = networks.slice(0, 50);
  return sample
    .map((n, i) => {
      const parts: string[] = [`${i + 1}.`];
      if (n.bssid) parts.push(`BSSID=${n.bssid}`);
      if (n.ssid) parts.push(`SSID="${n.ssid}"`);
      if (n.type) parts.push(`type=${n.type}`);
      if (n.threat_score !== undefined) parts.push(`score=${n.threat_score}`);
      if (n.observation_count !== undefined) parts.push(`obs=${n.observation_count}`);
      if (n.unique_days !== undefined) parts.push(`days=${n.unique_days}`);
      if (n.seen_at_home) parts.push('seen@home');
      if (n.seen_away) parts.push('seen@away');
      return parts.join(' ');
    })
    .join('\n');
}

/**
 * Parse structured suggestions from the model response.
 * Looks for numbered/bulleted list items after a "Suggestions:" header.
 */
function parseSuggestions(text: string): string[] {
  const suggestions: string[] = [];

  // Try to find a suggestions block
  const suggBlock = text.match(/suggestions?:?([\s\S]*?)(?:\n\n|\n(?=[A-Z#])|$)/i);
  const source = suggBlock ? suggBlock[1] : text;

  const lines = source.split('\n');
  for (const line of lines) {
    const cleaned = line.replace(/^[\s\-\*\d\.]+/, '').trim();
    if (cleaned.length > 10) {
      suggestions.push(cleaned);
    }
  }

  return suggestions.slice(0, 10);
}

/**
 * Analyze a set of networks with an optional user question.
 * Sends context to Claude via Bedrock and returns structured analysis.
 */
async function analyzeNetworks(
  networks: NetworkSummary[],
  userQuestion: string
): Promise<AnalysisResult> {
  const client = buildClient();

  const networkSummary = summarizeNetworks(networks);
  const totalCount = networks.length;
  const cappedNote = totalCount > 50 ? ` (showing first 50 of ${totalCount})` : '';

  const prompt = `You are a wireless network security analyst for a SIGINT forensics platform called ShadowCheck. You analyze WiFi, Bluetooth, and cellular observations to detect potential surveillance devices.

Network observations${cappedNote}:
${networkSummary}

Question: ${userQuestion}

Provide a concise security analysis followed by a numbered list of actionable suggestions.
Format your response as:
Analysis: <your analysis>
Suggestions:
1. <first suggestion>
2. <second suggestion>
...`;

  const requestBody = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: MAX_TOKENS,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  };

  logger.info(`[Bedrock] Invoking ${MODEL_ID} in ${getRegion()} with ${networks.length} networks`);

  const command = new InvokeModelCommand({
    modelId: MODEL_ID,
    body: JSON.stringify(requestBody),
    contentType: 'application/json',
    accept: 'application/json',
  });

  const response = await client.send(command);
  const responseBody = JSON.parse(Buffer.from(response.body).toString('utf-8'));

  const text: string = responseBody?.content?.[0]?.text ?? '';

  if (!text) {
    throw new Error('Empty response from Bedrock');
  }

  // Extract the analysis section (everything before Suggestions:)
  const analysisMatch = text.match(/analysis:\s*([\s\S]*?)(?:\nsuggestions?:|$)/i);
  const analysis = analysisMatch ? analysisMatch[1].trim() : text.trim();
  const suggestions = parseSuggestions(text);

  logger.info(`[Bedrock] Analysis complete. ${suggestions.length} suggestions returned.`);

  return { analysis, suggestions };
}

/**
 * Verify that the Bedrock endpoint is reachable by sending a minimal prompt.
 * Returns true on success, false if Bedrock is unavailable.
 */
async function testConnection(): Promise<boolean> {
  try {
    const client = buildClient();

    const requestBody = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 16,
      messages: [{ role: 'user', content: 'Reply with: OK' }],
    };

    const command = new InvokeModelCommand({
      modelId: MODEL_ID,
      body: JSON.stringify(requestBody),
      contentType: 'application/json',
      accept: 'application/json',
    });

    await client.send(command);
    logger.info('[Bedrock] Connection test passed');
    return true;
  } catch (err: any) {
    logger.warn(`[Bedrock] Connection test failed: ${err.message}`);
    return false;
  }
}

module.exports = { analyzeNetworks, testConnection };
