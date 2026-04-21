export const parseJsonParam = (value: unknown, fallback: unknown, name: string) => {
  if (!value) return fallback;
  try {
    return JSON.parse(String(value));
  } catch {
    throw new Error(`Invalid JSON for ${name}`);
  }
};
