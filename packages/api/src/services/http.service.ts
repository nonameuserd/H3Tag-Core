import axios, { AxiosRequestConfig } from 'axios';

/**
 * Validates the given URL against a strict whitelist.
 * Customize the allowed protocols and hosts according to your security policy.
 * In this example, only HTTPS URLs for specific domains are allowed.
 */
function isUrlAllowed(requestUrl: string): boolean {
  try {
    const parsedUrl = new URL(requestUrl);
    const allowedProtocols = ['https:'];
    const allowedHosts = ['api.h3tag.com', 'blockchain.h3tag.com'];

    if (!allowedProtocols.includes(parsedUrl.protocol)) {
      console.error('Disallowed protocol:', parsedUrl.protocol);
      return false;
    }

    if (!allowedHosts.includes(parsedUrl.hostname)) {
      console.error('Disallowed host:', parsedUrl.hostname);
      return false;
    }

    return true;
  } catch (e) {
    console.error('Invalid URL:', e);
    return false;
  }
}

/**
 * Performs a GET request only if the URL passes validation.
 * Disables automatic redirects (maxRedirects: 0) to avoid cross-protocol bypass.
 */
export async function safeGet(
  url: string,
  config?: AxiosRequestConfig
): Promise<any> {
  if (!isUrlAllowed(url)) {
    throw new Error(`URL is not allowed: ${url}`);
  }

  // Merge config options – disable automatic redirects to prevent SSRF bypass via redirects.
  const newConfig: AxiosRequestConfig = {
    ...config,
    maxRedirects: 0,
  };

  const response = await axios.get(url, newConfig);
  return response.data;
} 