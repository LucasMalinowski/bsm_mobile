import { tokenStorage } from "../auth/tokenStorage";

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:3000";

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// Keep track of refresh state to avoid parallel refresh requests
let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

const processQueue = (token: string | null) => {
  refreshQueue.forEach((cb) => cb(token));
  refreshQueue = [];
};

type ApiFetchOptions = Omit<RequestInit, "body"> & { body?: Record<string, unknown> | BodyInit | null };

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const url = `${BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;

  // 1. Resolve Authorization Header from storage
  const session = await tokenStorage.loadSession();
  const headers = new Headers(options.headers || {});

  if (session.accessToken) {
    headers.set("Authorization", `Bearer ${session.accessToken}`);
  }
  
  headers.set("Accept", "application/json");

  // 2. Setup Body serialization
  let body: BodyInit | null | undefined;
  if (options.body && typeof options.body === "object" && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  } else {
    body = options.body as BodyInit | null | undefined;
  }

  const { body: _body, ...restOptions } = options;
  const finalOptions: RequestInit = {
    ...restOptions,
    headers,
    body,
  };

  // 3. Perform Fetch
  let response: Response;
  try {
    response = await fetch(url, finalOptions);
  } catch (error) {
    throw new ApiError(0, "Erro de conexão com o servidor. Verifique sua rede.");
  }

  // 4. Handle Unauthorized response (401)
  if (response.status === 401 && !path.includes("/api/auth/login") && !path.includes("/api/auth/refresh")) {
    if (isRefreshing) {
      // Queue this request's execution until the active refresh completes
      return new Promise<T>((resolve, reject) => {
        refreshQueue.push((newToken) => {
          if (newToken) {
            const retryHeaders = new Headers(finalOptions.headers || {});
            retryHeaders.set("Authorization", `Bearer ${newToken}`);
            fetch(url, { ...finalOptions, headers: retryHeaders })
              .then(async (res) => {
                if (!res.ok) {
                  const errJson = await res.json().catch(() => ({}));
                  reject(new ApiError(res.status, errJson.error || "Operação não autorizada após reautenticação", errJson.code, errJson.details));
                } else {
                  const resJson = await res.json().catch(() => ({}));
                  resolve(resJson as T);
                }
              })
              .catch((err) => reject(new ApiError(0, err.message || "Falha na requisição de repetição")));
          } else {
            reject(new ApiError(401, "Sessão expirada. Faça login novamente."));
          }
        });
      });
    }

    isRefreshing = true;

    // Trigger Token Refresh
    try {
      const refreshedSession = await tokenStorage.loadSession();
      if (!refreshedSession.refreshToken) {
        throw new Error("No refresh token stored");
      }

      const refreshResponse = await fetch(`${BASE_URL}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ refresh_token: refreshedSession.refreshToken }),
      });

      if (!refreshResponse.ok) {
        throw new Error("Refresh request failed on backend");
      }

      const refreshJson = await refreshResponse.json();
      const { user, session: newSession } = refreshJson.data;

      // Save refreshed session
      await tokenStorage.saveSession(newSession, user);

      // Release lock and process queue
      isRefreshing = false;
      processQueue(newSession.access_token);

      // Retry original request
      const retryHeaders = new Headers(finalOptions.headers || {});
      retryHeaders.set("Authorization", `Bearer ${newSession.access_token}`);
      const retryRes = await fetch(url, { ...finalOptions, headers: retryHeaders });

      if (!retryRes.ok) {
        const errJson = await retryRes.json().catch(() => ({}));
        throw new ApiError(retryRes.status, errJson.error || "Erro de servidor após reautenticação", errJson.code, errJson.details);
      }

      return (await retryRes.json()) as T;
    } catch (refreshErr) {
      isRefreshing = false;
      processQueue(null);
      // Clean up session since refresh failed
      await tokenStorage.clearSession();
      throw new ApiError(401, "Sessão expirada. Faça login novamente.");
    }
  }

  // 5. Normal error parsing
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error || `Erro de servidor (${response.status})`;
    throw new ApiError(response.status, message, errorData.code, errorData.details);
  }

  // 6. JSON Parse
  return (await response.json().catch(() => ({}))) as T;
}
