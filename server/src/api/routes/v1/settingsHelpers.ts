export {};

const { validateString } = require('../../../validation/schemas');
const { getConfiguredAwsRegion } = require('../../../services/awsService');

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const getIncomingValue = (
  body: Record<string, unknown>,
  primaryKey: string,
  fallbackKey = 'value'
) => body[primaryKey] ?? body[fallbackKey];

function validateMapboxToken(value: unknown) {
  const validation = validateString(String(value || ''), 'token');
  if (!validation.valid) {
    return validation;
  }

  const token = String(value).trim();
  if (!token.startsWith('pk.') && !token.startsWith('sk.')) {
    return { valid: false, error: 'token must start with pk. or sk.' };
  }

  return { valid: true, value: token };
}

function validateLabel(value: unknown) {
  const validation = validateString(String(value || ''), 'label');
  if (!validation.valid) {
    return validation;
  }
  return { valid: true, value: String(value).trim() };
}

function validateGoogleMapsKey(value: unknown) {
  const validation = validateString(String(value || ''), 'google_maps_api_key');
  if (!validation.valid) {
    return validation;
  }
  return { valid: true, value: String(value).trim() };
}

function validateGenericKey(value: unknown, field: string) {
  const validation = validateString(String(value || ''), field);
  if (!validation.valid) {
    return validation;
  }
  return { valid: true, value: String(value).trim() };
}

function validateAwsRegion(value: unknown) {
  const validation = validateString(String(value || ''), 'aws_region');
  if (!validation.valid) {
    return validation;
  }
  return { valid: true, value: String(value).trim() };
}

module.exports = {
  getConfiguredAwsRegion,
  getErrorMessage,
  getIncomingValue,
  validateAwsRegion,
  validateGenericKey,
  validateGoogleMapsKey,
  validateLabel,
  validateMapboxToken,
  validateString,
};
