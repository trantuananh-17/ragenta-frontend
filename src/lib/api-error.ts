import { HTTPError } from "ky";

/**
 * Both backends answer failures with the same body:
 * `{ error: { code, message, details? }, requestId }`. Everything a mutation
 * shows a user comes through here, so a toast quotes the server's own words
 * rather than "Request failed with status code 422".
 */
interface ApiErrorBody {
  error?: { code?: string; message?: string; details?: unknown };
  requestId?: string;
}

export async function errorMessage(
  error: unknown,
  fallback = "Something went wrong.",
): Promise<string> {
  if (error instanceof HTTPError) {
    try {
      const body = (await error.response.json()) as ApiErrorBody;
      if (body?.error?.message) return body.error.message;
    } catch {
      // A non-JSON body (a proxy 502, say) has nothing useful to quote.
    }
    return `${error.response.status} ${error.response.statusText}`.trim();
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
