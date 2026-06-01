/** Supported swap tokens on Hedera testnet (defaults: USDC → HBAR). */
import { MAJOR_QUOTE_TOKENS } from "@/lib/majorQuoteTokens";
import type { SwapToken } from "@/lib/tokenTypes";

export type { SwapToken } from "@/lib/tokenTypes";

export const DEFAULT_SELL_SYMBOL = "USDC";
export const DEFAULT_BUY_SYMBOL = "HBAR";

export const SLIPPAGE_PRESETS = [0.1, 0.5, 1, 3] as const;
export const DEFAULT_SLIPPAGE_PERCENT = 0.5;
export const PROTOCOL_FEE_PERCENT = 0;

/** Live market refresh interval (DEX-style polling) */
export const QUOTE_REFRESH_MS = 12_000;

/** Hedera testnet — can sign & broadcast intents */
const HEDERA_NATIVE_TOKENS: SwapToken[] = [
  {
    symbol: "USDC",
    name: "USD Coin",
    hederaId: "0.0.429274",
    evmAddress: "0xc3ba8c19c1253c8ad43e1d3661a07efe41431ef4",
    decimals: 6,
    coingeckoId: "usd-coin",
    settlementSupported: true,
  },
  {
    symbol: "HBAR",
    name: "Hedera",
    hederaId: "0.0.15058",
    evmAddress: "0x0000000000000000000000000000000000003ad2",
    decimals: 8,
    coingeckoId: "hedera-hashgraph",
    isNativeHbar: true,
    settlementSupported: true,
  },
  {
    symbol: "SAUCE",
    name: "SaucerSwap",
    hederaId: "0.0.1183558",
    evmAddress: "0x0000000000000000000000000000000000120f46",
    decimals: 6,
    coingeckoId: "saucerswap",
  },
  {
    symbol: "XSAUCE",
    name: "Staked SAUCE",
    hederaId: "0.0.1418651",
    evmAddress: "0x000000000000000000000000000000000015a59b",
    decimals: 6,
  },
];

function mergeTokenLists(native: SwapToken[], majors: SwapToken[]): SwapToken[] {
  const bySymbol = new Map<string, SwapToken>();
  for (const t of native) bySymbol.set(t.symbol, t);
  for (const t of majors) {
    if (!bySymbol.has(t.symbol)) bySymbol.set(t.symbol, t);
  }
  const nativeSyms = new Set(native.map((t) => t.symbol));
  const orderedNative = native;
  const rest = [...bySymbol.values()]
    .filter((t) => !nativeSyms.has(t.symbol))
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
  return [...orderedNative, ...rest];
}

export const SWAP_TOKENS: SwapToken[] = mergeTokenLists(HEDERA_NATIVE_TOKENS, MAJOR_QUOTE_TOKENS);

export function tokenBySymbol(symbol: string): SwapToken | undefined {
  return SWAP_TOKENS.find((t) => t.symbol === symbol);
}

export function tokenByEvm(evm: string): SwapToken | undefined {
  const lower = evm.toLowerCase();
  return SWAP_TOKENS.find((t) => t.evmAddress.toLowerCase() === lower);
}

export function isSignablePair(sell: SwapToken, buy: SwapToken): boolean {
  if (sell.quoteOnly || buy.quoteOnly) return false;
  if (!sell.hederaId || !buy.hederaId) return false;
  return true;
}
