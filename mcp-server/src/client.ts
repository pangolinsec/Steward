import { ALMANAC_URL, DEFAULT_CAMPAIGN_ID } from "./constants.js";

export class AlmanacError extends Error {
  constructor(
    public status: number,
    public body: string,
    public url: string,
  ) {
    super(`Almanac API error ${status}: ${body}`);
    this.name = "AlmanacError";
  }
}

export async function almanacFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const url = `${ALMANAC_URL}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...options?.headers,
      },
    });
  } catch (err) {
    throw new Error(
      `Cannot reach Almanac at ${ALMANAC_URL}. Is the server running? (${err instanceof Error ? err.message : err})`,
    );
  }
  if (!res.ok) {
    const body = await res.text();
    throw new AlmanacError(res.status, body, url);
  }
  return res.json() as Promise<T>;
}

export function get<T>(path: string): Promise<T> {
  return almanacFetch<T>(path);
}

export function post<T>(path: string, data?: unknown): Promise<T> {
  return almanacFetch<T>(path, {
    method: "POST",
    body: data !== undefined ? JSON.stringify(data) : undefined,
  });
}

export function put<T>(path: string, data: unknown): Promise<T> {
  return almanacFetch<T>(path, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function patch<T>(path: string, data?: unknown): Promise<T> {
  return almanacFetch<T>(path, {
    method: "PATCH",
    body: data !== undefined ? JSON.stringify(data) : undefined,
  });
}

export function del<T>(path: string): Promise<T> {
  return almanacFetch<T>(path, { method: "DELETE" });
}

/** Resolve campaign ID from param or env default, throw with helpful message if missing. */
export function campaignId(id?: number): number {
  const resolved = id ?? DEFAULT_CAMPAIGN_ID;
  if (!resolved) {
    throw new Error(
      "No campaign specified. Set ALMANAC_CAMPAIGN_ID env var or pass campaign_id. Use almanac_list_campaigns to see available campaigns.",
    );
  }
  return resolved;
}

/** Campaign-scoped path helper */
export function c(cId: number, path: string): string {
  return `/campaigns/${cId}${path}`;
}

export function handleError(error: unknown): string {
  if (error instanceof AlmanacError) {
    if (error.status === 404) {
      return `Not found. ${error.body}`;
    }
    return `Almanac API error (${error.status}): ${error.body}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
