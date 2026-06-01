import { ethers } from "ethers";
import { NextResponse } from "next/server";
import { formatRateLabel, indicativeRate } from "@/lib/indicativePrice";
import { SWAP_TOKENS, tokenByEvm, type SwapToken } from "@/lib/tokens";
import { getTestnetConfig } from "@/lib/testnet";

const QUOTER_V2_ABI = [
  "function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut,uint160 sqrtPriceX96After,uint32 initializedTicksCrossed,uint256 gasEstimate)",
];

const FEE_TIERS = [500, 3000, 10000];

function resolveToken(symbolOrEvm: string | null, fallback: SwapToken): SwapToken {
  if (!symbolOrEvm) return fallback;
  const bySym = SWAP_TOKENS.find((t) => t.symbol.toLowerCase() === symbolOrEvm.toLowerCase());
  if (bySym) return bySym;
  return tokenByEvm(symbolOrEvm) ?? fallback;
}

async function quoteOnChain(
  provider: ethers.JsonRpcProvider,
  quoter: string,
  tokenIn: SwapToken,
  tokenOut: SwapToken,
  amountIn: bigint,
  defaultFee: number,
): Promise<{ amountOut: bigint; fee: number } | null> {
  const contract = new ethers.Contract(quoter, QUOTER_V2_ABI, provider);
  const fees = [defaultFee, ...FEE_TIERS.filter((f) => f !== defaultFee)];

  for (const fee of fees) {
    try {
      const result = await contract.quoteExactInputSingle.staticCall({
        tokenIn: tokenIn.evmAddress,
        tokenOut: tokenOut.evmAddress,
        amountIn,
        fee,
        sqrtPriceLimitX96: BigInt(0),
      });
      const amountOut = Array.isArray(result) ? (result[0] as bigint) : (result as { amountOut: bigint }).amountOut;
      if (amountOut > BigInt(0)) return { amountOut, fee };
    } catch {
      // try next fee tier
    }
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const amountIn = searchParams.get("amountIn") || "0";
  const forceFresh = searchParams.get("fresh") === "1";
  const tokenInParam = searchParams.get("tokenIn");
  const tokenOutParam = searchParams.get("tokenOut");
  /** @deprecated use tokenIn/tokenOut */
  const sellTokenLegacy = searchParams.get("sellToken");

  const defaultIn = SWAP_TOKENS[0];
  const defaultOut = SWAP_TOKENS[1];

  let tokenIn: SwapToken;
  let tokenOut: SwapToken;

  if (tokenInParam && tokenOutParam) {
    tokenIn = resolveToken(tokenInParam, defaultIn);
    tokenOut = resolveToken(tokenOutParam, defaultOut);
  } else if (sellTokenLegacy === "hbar") {
    tokenIn = SWAP_TOKENS[1];
    tokenOut = SWAP_TOKENS[0];
  } else {
    tokenIn = defaultIn;
    tokenOut = defaultOut;
  }

  if (tokenIn.symbol === tokenOut.symbol) {
    return NextResponse.json({
      ok: false,
      amountOut: null,
      price: null,
      base: tokenIn.symbol,
      quote: tokenOut.symbol,
      priceLabel: "Select different tokens",
      source: "none",
    });
  }

  let amountInBn: bigint;
  try {
    amountInBn = BigInt(amountIn);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid amountIn" }, { status: 400 });
  }

  if (amountInBn <= BigInt(0)) {
    return NextResponse.json({
      ok: false,
      amountOut: null,
      price: null,
      base: tokenIn.symbol,
      quote: tokenOut.symbol,
      priceLabel: "",
      source: "none",
    });
  }

  const testnet = getTestnetConfig();
  const rpc =
    process.env.HEDERA_RPC_URL ||
    process.env.NEXT_PUBLIC_HEDERA_RPC_URL ||
    "https://testnet.hashio.io/api";
  const quoter = process.env.SAUCERSWAP_QUOTER_V2 || testnet.saucerswap.quoter;
  const fee = Number(process.env.POOL_FEE || testnet.saucerswap.poolFee);

  try {
    const provider = new ethers.JsonRpcProvider(rpc, 296, { staticNetwork: true });
    const onChain = await quoteOnChain(provider, quoter, tokenIn, tokenOut, amountInBn, fee);

    if (onChain) {
      const inHuman = Number(amountInBn) / 10 ** tokenIn.decimals;
      const outHuman = Number(onChain.amountOut) / 10 ** tokenOut.decimals;
      const rate = inHuman > 0 ? outHuman / inHuman : null;
      const priceLabel =
        rate && rate > 0 ? `${formatRateLabel(tokenIn, tokenOut, rate)} (SaucerSwap)` : "Market rate";

      return NextResponse.json({
        ok: true,
        amountOut: onChain.amountOut.toString(),
        priceLabel,
        price: rate,
        base: tokenIn.symbol,
        quote: tokenOut.symbol,
        source: "saucerswap",
        poolFee: onChain.fee,
        quotedAt: Date.now(),
      });
    }
  } catch {
    // fall through to indicative pricing
  }

  const rate = await indicativeRate(tokenIn, tokenOut, forceFresh);
  if (rate && rate > 0) {
    const inHuman = Number(amountInBn) / 10 ** tokenIn.decimals;
    const outHuman = inHuman * rate;
    const outUnits = ethers.parseUnits(outHuman.toFixed(tokenOut.decimals), tokenOut.decimals);

    return NextResponse.json({
      ok: true,
      amountOut: outUnits.toString(),
      price: rate,
      priceLabel: `${formatRateLabel(tokenIn, tokenOut, rate)} (reference)`,
      base: tokenIn.symbol,
      quote: tokenOut.symbol,
      source: "reference",
      quotedAt: Date.now(),
    });
  }

  return NextResponse.json({
    ok: false,
    amountOut: null,
    price: null,
    base: tokenIn.symbol,
    quote: tokenOut.symbol,
    priceLabel: "",
    source: "none",
    quotedAt: Date.now(),
  });
}
