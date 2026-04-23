import axios from 'axios';

const BASE_URL = 'https://www.fbi.gov';
const JINA_PREFIX = 'https://r.jina.ai/';
const USE_JINA = process.env.FBI_USE_JINA !== 'false';

export const fetchPage = async (url: string): Promise<string> => {
  const targetUrl = USE_JINA ? `${JINA_PREFIX}${url}` : url;
  try {
    const response = await axios.get(targetUrl, {
      timeout: 10000,
    });
    return response.data;
  } catch (error) {
    throw new Error(`Failed to fetch ${url}: ${(error as Error).message}`);
  }
};

export const getFieldOfficesIndex = async (): Promise<string[]> => {
  const html = await fetchPage(`${BASE_URL}/contact-us/field-offices/field-offices`);
  // Simple regex or DOM parser to find office links would go here.
  // Returning dummy array for structure demonstration:
  return ['/contact-us/field-offices/albany', '/contact-us/field-offices/atlanta'];
};
