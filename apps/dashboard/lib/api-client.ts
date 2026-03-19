const API_BASE = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { params, ...fetchOptions } = options;

  let url = `${API_BASE}/api/v1${path}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.set(key, String(value));
      }
    });
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  const token = getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
  });

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  const json = await response.json();

  if (!response.ok) {
    throw new ApiError(
      json.error ?? "Request failed",
      json.code ?? "UNKNOWN_ERROR",
      response.status,
      json.details
    );
  }

  return json as T;
}

export async function apiUpload<T>(
  path: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<T> {
  const token = getAccessToken();
  const url = `${API_BASE}/api/v1${path}`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);

    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    }

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      try {
        const json = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(json as T);
        } else {
          reject(
            new ApiError(
              json.error ?? "Upload failed",
              json.code ?? "UPLOAD_ERROR",
              xhr.status,
              json.details
            )
          );
        }
      } catch {
        reject(new ApiError("Upload failed", "UPLOAD_ERROR", xhr.status));
      }
    });

    xhr.addEventListener("error", () => {
      reject(new ApiError("Network error during upload", "NETWORK_ERROR", 0));
    });

    const formData = new FormData();
    formData.append("file", file);
    xhr.send(formData);
  });
}

// Typed convenience methods
export const api = {
  get<T>(path: string, params?: RequestOptions["params"]): Promise<T> {
    return apiRequest<T>(path, { method: "GET", params });
  },

  post<T>(path: string, body?: unknown): Promise<T> {
    return apiRequest<T>(path, {
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  patch<T>(path: string, body?: unknown): Promise<T> {
    return apiRequest<T>(path, {
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  delete<T = void>(path: string): Promise<T> {
    return apiRequest<T>(path, { method: "DELETE" });
  },
};
