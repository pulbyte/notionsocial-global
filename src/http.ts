import axios, {AxiosError, isAxiosError} from "axios";
import {format as formatAxiosError} from "@redtea/format-axios-error";
import {safeStringify} from "./logging";
// Shared browser-like headers to avoid 403 errors
export const getBrowserHeaders = () => {
  // Rotate User-Agent strings to appear more human-like
  const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  ];

  const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];

  return {
    "User-Agent": randomUserAgent,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    DNT: "1",
    Connection: "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Cache-Control": "max-age=0",
    "sec-ch-ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    Referer: "https://www.google.com/",
    // Additional headers that might help bypass some restrictions
    "X-Requested-With": "XMLHttpRequest",
    "X-Forwarded-For": "127.0.0.1",
    "X-Real-IP": "127.0.0.1",
  };
};

export function logAxiosError(error: AxiosError | any, message?: string) {
  const prefix = message ? "🛑 " + message + "\n" : "";

  const log = (_: any) => console.error(prefix, _);

  if (isAxiosError(error)) {
    try {
      log(safeStringify(formatAxiosError(error)));
    } catch (e) {
      log(safeStringify(error));
    }
  } else if (error) {
    log(safeStringify(error));
  } else {
    log("Unknown error occurred");
  }
}

// Retry mechanism for HTTP requests
export const axiosWithRetry = async (config, maxRetries = 3, baseDelay = 1000) => {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await axios(config);
    } catch (error) {
      lastError = error;

      // Don't retry on 403, 404, or other client errors
      if (
        error.response?.status >= 400 &&
        error.response?.status < 500 &&
        error.response?.status !== 429
      ) {
        console.warn(`HTTP ${error.response.status} error - not retrying:`, error.message);
        throw error;
      }

      // Don't retry on network errors that aren't timeouts
      if (
        error.code &&
        !["ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "ECONNREFUSED"].includes(error.code)
      ) {
        console.warn(`Network error ${error.code} - not retrying:`, error.message);
        throw error;
      }

      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000; // Exponential backoff + random jitter
        console.warn(
          `Request failed (attempt ${attempt}/${maxRetries}), retrying in ${Math.round(
            delay
          )}ms:`,
          error.message
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        console.error(`Request failed after ${maxRetries} attempts:`, error.message);
      }
    }
  }

  throw lastError;
};

interface RequestConfig {
  url: string;
  method: string;
  headers: HeadersInit;
  body?: any;
  [key: string]: any;
}

export const axiosFetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
  const [url, options] = args;

  const requestConfig: RequestConfig = {
    url: typeof url === "string" || url instanceof URL ? url.toString() : (url as Request).url,
    method: options?.method || "GET",
    headers: options?.headers || {},
    body: options?.body,
    ...(options || {}),
  };

  const response = await fetch(...args);

  // If response is not ok, create axios-compatible error with full request config
  if (!response.ok) {
    const error = await interceptFetchError(response, requestConfig);
    throw error;
  }

  return response;
};

async function interceptFetchError(
  response: Response,
  requestConfig: RequestConfig
): Promise<axios.AxiosError> {
  const data = await getResponseData(response);

  // Create a proper axios config object
  const axiosConfig = {
    url: requestConfig.url,
    method: requestConfig.method,
    headers: requestConfig.headers as any,
    data: requestConfig.body,
    params: requestConfig.params,
    timeout: requestConfig.timeout,
    baseURL: requestConfig.baseURL,
  };

  const axiosError = new axios.AxiosError(
    `Request failed with status code ${response.status}`,
    response.status >= 400 && response.status < 500 ? "ERR_BAD_REQUEST" : "ERR_BAD_RESPONSE",
    axiosConfig,
    null, // request object (not available in fetch context)
    {
      status: response.status,
      statusText: response.statusText,
      data,
      headers: Object.fromEntries(response.headers.entries()),
      config: axiosConfig,
    }
  );

  return axiosError;
}

// Helper to get response data (reused from existing function)
async function getResponseData(response: Response) {
  try {
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return await response.json();
    } else {
      return await response.text();
    }
  } catch {
    return null;
  }
}
