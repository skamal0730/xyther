export type SwapToken = {
  symbol: string;
  name: string;
  hederaId: string;
  evmAddress: string;
  decimals: number;
  coingeckoId?: string;
  logoURI?: string;
  isNativeHbar?: boolean;
  settlementSupported?: boolean;
  quoteOnly?: boolean;
};
