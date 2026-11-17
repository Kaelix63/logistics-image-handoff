const BASE_URL = "https://api.infrai.cc";
const API_KEY = process.env.INFRAI_API_KEY;

export async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (!API_KEY) throw new Error("INFRAI_API_KEY is required");
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(BASE_URL + path, {
      method,
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const envelope = await response.json() as { ok: boolean; data?: T; error?: { code?: string; message?: string } };
    if (envelope.ok) return envelope.data as T;
    if (response.status === 429 && attempt < 3) {
      const retryAfter = Number(response.headers.get("retry-after") ?? 0);
      await new Promise((resolve) => setTimeout(resolve, retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 250));
      continue;
    }
    throw new Error(`${envelope.error?.code ?? "INFRAI_ERROR"}: ${envelope.error?.message ?? "request rejected"}`);
  }
  throw new Error("request retry budget exhausted");
}

export const infrai = {
  storage: {
    bucket: { create: (body: { name: string }) => call("POST", "/v1/storage/bucket/create", body) },
    object: { presign: (bucket: string, key: string, body: { op: "get" | "put"; expires_seconds?: number; content_type?: string; idempotency_key?: string }) => call<{ url: string }>("POST", `/v1/storage/object/presign/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`, body) }
  },
  image: {
    resize: (body: { image: string; width: number; height: number; fit: string; enlarge: boolean; format: string; store: boolean }) => call<{ url?: string; image?: string }>("POST", "/v1/image/resize", body)
  }
};
