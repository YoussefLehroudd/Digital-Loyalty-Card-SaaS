function normalizeApiBaseUrl() {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (!raw) {
    return "/api";
  }

  const withoutTrailingSlash = raw.replace(/\/+$/, "");
  return /\/api$/i.test(withoutTrailingSlash)
    ? withoutTrailingSlash
    : `${withoutTrailingSlash}/api`;
}

export const API_BASE_URL = normalizeApiBaseUrl();

type ApiFetchOptions = RequestInit & {
  token?: string;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public errors?: Record<string, string[]>,
  ) {
    super(message);
  }
}

function isStateChangingMethod(method?: string) {
  if (!method) return false;
  const m = method.toUpperCase();
  return m === "POST" || m === "PATCH" || m === "PUT" || m === "DELETE";
}

export async function apiFetch<T>(
  path: string,
  { token, headers, ...options }: ApiFetchOptions = {},
): Promise<T> {
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  const method = options.method ?? "GET";

  const url = `${API_BASE_URL}${path}`;

  // Build headers first (we may add X-XSRF-TOKEN below)
  // We intentionally keep this as a string map to avoid `any` + satisfy eslint.
  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(headers as Record<string, string>),
  };

  // Safe debug logs (no token/cookie contents)
  if (typeof window !== "undefined") {
    console.log("[apiFetch]", {
      API_BASE_URL,
      path,
      url,
      method,
      tokenProvided: Boolean(token),
      authHeaderPresent: Boolean(token),
    });
  }

  let response: Response;
  try {
    response = await fetch(url, {
      // Important for Sanctum CSRF/stateful auth in production
      credentials: options.credentials ?? "include",
      ...options,
      headers: finalHeaders,
    });
  } catch (err) {
    // This is the exact "Failed to fetch" case (network/CORS/mixed-content/host mismatch)
    console.log("[apiFetch:fetch_error]", {
      url,
      method,
      tokenProvided: Boolean(token),
      errorName: err instanceof Error ? err.name : typeof err,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);

    throw new ApiError(
      payload?.message ?? `API request failed with status ${response.status}`,
      response.status,
      payload?.errors,
    );
  }

  return response.json() as Promise<T>;
}
