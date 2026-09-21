export class AdminApiClient {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor() {
    this.baseUrl =
      process.env.SOBALUZ_API_BASE_URL ??
      process.env.API_BASE_URL ??
      "http://localhost:3000";
    this.token =
      process.env.SOBALUZ_ADMIN_TOKEN ??
      process.env.MCP_ADMIN_TOKEN ??
      process.env.ADMIN_API_TOKEN ??
      "";

    if (!this.token) {
      throw new Error(
        "Missing SOBALUZ_ADMIN_TOKEN. Set it to the same value as the API MCP_ADMIN_TOKEN/ADMIN_API_TOKEN.",
      );
    }
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "GET" });
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: "POST", body });
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: "PATCH", body });
  }

  async uploadImage(
    file: Uint8Array<ArrayBuffer>,
    contentType: string,
    category: string,
  ): Promise<unknown> {
    const form = new FormData();
    form.set("file", new Blob([file], { type: contentType }), "image");
    form.set("category", category);
    const response = await fetch(this.url("/admin/media/upload"), {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}` },
      body: form,
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok)
      throw new Error(
        `Image upload failed with ${response.status}: ${await response.text()}`,
      );
    return response.json();
  }

  private async request<T>(
    path: string,
    init: { method: string; body?: unknown },
  ): Promise<T> {
    const response = await fetch(this.url(path), {
      method: init.method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(
        `Sob a Luz API ${init.method} ${path} failed with ${response.status}: ${text}`,
      );
    }

    if (!text) {
      return null as T;
    }

    return JSON.parse(text) as T;
  }

  private url(path: string): string {
    const normalizedBaseUrl = this.baseUrl.endsWith("/")
      ? this.baseUrl
      : `${this.baseUrl}/`;
    const normalizedPath = path.startsWith("/") ? path.slice(1) : path;

    return new URL(normalizedPath, normalizedBaseUrl).toString();
  }
}

export const adminApi = new AdminApiClient();
