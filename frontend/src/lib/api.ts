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

export async function apiFetch<T>(
  path: string,
  { token, headers, ...options }: ApiFetchOptions = {},
): Promise<T> {
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
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
