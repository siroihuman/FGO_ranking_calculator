export interface FetchPageOptions {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export async function fetchPageHtml(
  url: string,
  options: FetchPageOptions = {},
): Promise<string> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (!fetchImpl) throw new Error("fetch is not available in this runtime");

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 30_000,
  );

  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "FGO-ranking-calculator/0.1",
      },
    });
    if (!response.ok) {
      throw new Error(`failed to fetch ${url}: HTTP ${response.status}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}
