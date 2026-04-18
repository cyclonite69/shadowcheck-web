export {};

function envFlag(value: unknown, defaultValue = false): boolean {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  return String(value).toLowerCase() === 'true';
}

module.exports = {
  envFlag,
};
