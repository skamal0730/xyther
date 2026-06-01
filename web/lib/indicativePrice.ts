import type { SwapToken } from "@/lib/tokenTypes";

type PriceCache = { usd: Record<string, number>; fetchedAt: number };
let cache: PriceCache | null = null;
/** Short TTL so live rates update frequently */
const CACHE_MS = 8_000;

async function fetchUsdPrices(coingeckoIds: string[], forceFresh: boolean): Promise<Record<string, number>> {
  const unique = [...new Set(coingeckoIds.filter(Boolean))];
  if (unique.length === 0) return {};

  const now = Date.now();
  if (!forceFresh && cache && now - cache.fetchedAt < CACHE_MS) {
    const hit = unique.every((id) => (cache!.usd[id] ?? 0) > 0);
    if (hit) return cache.usd;
  }

  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(unique.join(","))}&vs_currencies=usd`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return cache?.usd ?? {};

  const json = (await res.json()) as Record<string, { usd?: number }>;
  const usd: Record<string, number> = forceFresh ? {} : { ...(cache?.usd ?? {}) };
  for (const id of unique) {
    const p = json[id]?.usd;
    if (typeof p === "number" && p > 0) usd[id] = p;
  }
  cache = { usd, fetchedAt: now };
  return usd;
}

export async function indicativeRate(
  tokenIn: SwapToken,
  tokenOut: SwapToken,
  forceFresh = false,
): Promise<number | null> {
  if (tokenIn.symbol === tokenOut.symbol) return 1;
  const ids = [tokenIn.coingeckoId, tokenOut.coingeckoId].filter(Boolean) as string[];
  if (ids.length < 2) return null;

  const usd = await fetchUsdPrices(ids, forceFresh);
  const inUsd = tokenIn.coingeckoId ? usd[tokenIn.coingeckoId] : undefined;
  const outUsd = tokenOut.coingeckoId ? usd[tokenOut.coingeckoId] : undefined;
  if (!inUsd || !outUsd || inUsd <= 0 || outUsd <= 0) return null;

  return inUsd / outUsd;
}

export function formatRateLabel(tokenIn: SwapToken, tokenOut: SwapToken, rate: number): string {
  return `1 ${tokenIn.symbol} ≈ ${rate.toFixed(6)} ${tokenOut.symbol}`;
}
