function normalizeApiBaseUrl() {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (!raw) {
    return "http://127.0.0.1:8000/api";
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

function getCookie(name: string) {
  if (typeof window === "undefined") return null;

  const cookieStr = window.document.cookie ?? "";
  const parts = cookieStr.split(";").map((p) => p.trim());
  for (const part of parts) {
    if (part.startsWith(`${name}=`)) {
      return decodeURIComponent(part.slice(name.length + 1));
    }
  }
  return null;
}

function getSanctumCsrfCookieUrl() {
  // API_BASE_URL is typically ".../api"
  // Sanctum route is ".../sanctum/csrf-cookie"
  return `${API_BASE_URL.replace(/\/api\/?$/, "")}/sanctum/csrf-cookie`;
}

async function primeSanctumCsrf() {
  // Prime Sanctum CSRF cookie for state-changing requests.
  // Laravel returns 419 if the XSRF-TOKEN cookie/header pair don't match.
  const csrfResponse = await fetch(getSanctumCsrfCookieUrl(), {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
  });

  if (!csrfResponse.ok) {
    // Let the original request fail with its own response details if priming fails
    return;
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
  const stateChanging = isStateChangingMethod(method);

  // Build headers first (we may add X-XSRF-TOKEN below)
  // We intentionally keep this as a string map to avoid `any` + satisfy eslint.
  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(headers as Record<string, string>),
  };

  // For Sanctum CSRF protection, ensure X-XSRF-TOKEN header matches XSRF-TOKEN cookie.
  // This fixes production 419 when cookies are sent but header is missing.
  if (stateChanging) {
    await primeSanctumCsrf();
    const cookieStr = typeof window !== "undefined" ? window.document.cookie : "";
    const xsrfToken = getCookie("XSRF-TOKEN");
    const hasXsrf = Boolean(xsrfToken);

    // Ensure we set it AFTER headers merge.
    if (hasXsrf) {
      finalHeaders["X-XSRF-TOKEN"] = xsrfToken as string;
    }

    // Temporary CSRF verification (remove later if needed)
    console.log({
      url: `${API_BASE_URL}${path}`,
      method,
      xsrfExists: hasXsrf,
      cookieContainsXsrfToken: cookieStr.includes("XSRF-TOKEN="),
      cookieStr,
      finalHeaders,
    });
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    // Important for Sanctum CSRF/stateful auth in production
    credentials: options.credentials ?? "include",
    ...options,
    headers: finalHeaders,
  });

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
