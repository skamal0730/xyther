import { NextResponse } from "next/server";
import { tokenBySymbol } from "@/lib/tokens";

function backendBaseUrl() {
  return process.env.BACKEND_API_URL || "http://localhost:3001";
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const sellToken = searchParams.get("sellToken") || "USDC";
    if (!accountId) {
      return NextResponse.json({ error: "accountId is required" }, { status: 400 });
    }

    const token = tokenBySymbol(sellToken);
    const mirrorBase = process.env.MIRROR_NODE_URL || "https://testnet.mirrornode.hedera.com/api/v1";

    const [backendRes, tokenResp] = await Promise.all([
      fetch(`${backendBaseUrl()}/api/balances/${accountId}`, { cache: "no-store" }),
      token
        ? fetch(`${mirrorBase}/accounts/${accountId}/tokens?token.id=${token.hederaId}`, { cache: "no-store" })
        : Promise.resolve(null),
    ]);

    const backendData = await backendRes.json();
    if (!backendRes.ok) {
      return NextResponse.json(backendData, { status: backendRes.status });
    }

    let sellTokenUnits = backendData.usdcUnits ?? "0";
    if (token && token.symbol !== "USDC" && tokenResp?.ok) {
      const tokenJson = await tokenResp.json();
      sellTokenUnits = String(tokenJson.tokens?.[0]?.balance ?? 0);
    }

    return NextResponse.json({
      ...backendData,
      sellTokenSymbol: token?.symbol ?? sellToken,
      sellTokenUnits,
      sellTokenDecimals: token?.decimals ?? 6,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Balance fetch failed" },
      { status: 500 },
    );
  }
}
