type ApiRequestError = {
  status?: number;
  message?: string;
  data?: unknown;
};

function getResponseMessage(data: unknown): string | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return null;
  }

  const errorBody = data as { error?: unknown; message?: unknown };
  const errorMessage =
    errorBody.error && typeof errorBody.error === 'object'
      ? (errorBody.error as { message?: unknown }).message
      : errorBody.error;

  if (typeof errorMessage === 'string') {
    return errorMessage;
  }
  return typeof errorBody.message === 'string' ? errorBody.message : null;
}

export function getNetworkSearchErrorMessage(
  error: ApiRequestError,
  radiusEnabled: boolean = false
): string {
  const responseMessage = getResponseMessage(error.data);

  if (error.status === 504) {
    if (radiusEnabled) {
      return 'Search timed out; narrow the radius and try again.';
    }
    return responseMessage || 'Search timed out. Please try again.';
  }
  if (error.status === 502 || error.status === 503) {
    return responseMessage || 'Network search is temporarily unavailable. Please try again.';
  }
  if (responseMessage) {
    return responseMessage;
  }

  if (typeof error.status === 'number' && error.status >= 500) {
    return `Network search failed (HTTP ${error.status}). Please try again.`;
  }
  if (error.message && !/<\s*(?:!doctype|html)\b/i.test(error.message)) {
    return error.message;
  }
  return typeof error.status === 'number' && error.status === 429
    ? 'Too many search requests. Please wait and try again.'
    : 'Network search failed. Please try again.';
}
