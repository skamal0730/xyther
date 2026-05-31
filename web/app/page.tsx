"use client";

import { ethers } from "ethers";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActiveIntentStream } from "@/components/ActiveIntentStream";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { Navbar } from "@/components/Navbar";
import { PlaygroundPanel, type OrderType } from "@/components/PlaygroundPanel";
import { TechnicalDeepDive } from "@/components/TechnicalDeepDive";

const CHAIN_ID = 296;
const WHBAR_TOKEN_ID = "0.0.15058";
const USDC_TOKEN_ID = "0.0.429274";
const WHBAR_EVM = process.env.NEXT_PUBLIC_WHBAR_EVM || "0x0000000000000000000000000000000000003ad2";
const USDC_EVM = process.env.NEXT_PUBLIC_USDC_EVM || "0xc3ba8c19c1253c8ad43e1d3661a07efe41431ef4";
const VERIFYING_CONTRACT =
  process.env.NEXT_PUBLIC_SETTLEMENT_CONTRACT || "0x597d420DaB6A4f6E04b446D7ee9c6F938d6Bf4F7";
const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";

type IntentPayload = {
  requestId: string;
  intent: {
    intentId: number;
    signer: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    minAmountOut: string;
    deadline: string;
    nonce: string;
    receiver: string;
    chainId: string;
    signature: string;
  };
};

export default function Home() {
  type QuoteDirection = "usdcToHbar" | "hbarToUsdc" | "limitPrice";
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [hederaAccountId, setHederaAccountId] = useState("");
  const [signature, setSignature] = useState("");
  const [requestId, setRequestId] = useState("");
  const [statusMessage, setStatusMessage] = useState("Ready");
  const [hashscanUrl, setHashscanUrl] = useState("");
  /** amountIn: USDC smallest units (6 decimals) when selling USDC */
  const [amountIn, setAmountIn] = useState("10000000");
  /** minOutput: WHBAR smallest units (8 decimals / tinybar-style) */
  const [minOutput, setMinOutput] = useState("0");
  const [sellUsdcInput, setSellUsdcInput] = useState("10");
  const [buyHbarInput, setBuyHbarInput] = useState("");
  const [quoteDirection, setQuoteDirection] = useState<QuoteDirection>("usdcToHbar");
  const [nonce, setNonce] = useState(String(Date.now()));
  const [balances, setBalances] = useState<{ hbarTinybar: string; usdcUnits: string } | null>(null);
  const [expirationMinutes, setExpirationMinutes] = useState(20);
  const [limitPriceInput, setLimitPriceInput] = useState("");
  const [marketPrice, setMarketPrice] = useState<number | null>(null);
  const [marketPriceDisplay, setMarketPriceDisplay] = useState("");
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [marketQuoteOk, setMarketQuoteOk] = useState(false);
  const signedDeadlineRef = useRef(0);
  const wcRef = useRef<{ connector: any; signer: any } | null>(null);

  const canSign = Boolean(walletAddress);
  const canBroadcast = Boolean(signature && walletAddress);

  const invalidateIntent = useCallback(() => {
    setSignature("");
    setRequestId("");
    setHashscanUrl("");
    signedDeadlineRef.current = 0;
  }, []);

  const setAmountInSafe = useCallback(
    (v: string) => {
      setAmountIn(v);
      invalidateIntent();
    },
    [invalidateIntent],
  );

  const setMinOutputSafe = useCallback(
    (v: string) => {
      setMinOutput(v);
      invalidateIntent();
    },
    [invalidateIntent],
  );

  const setExpirationSafe = useCallback(
    (v: number) => {
      setExpirationMinutes(v);
      invalidateIntent();
    },
    [invalidateIntent],
  );

  const setNonceSafe = useCallback(
    (v: string) => {
      setNonce(v);
      invalidateIntent();
    },
    [invalidateIntent],
  );

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      const x = (event.clientX / window.innerWidth) * 100;
      const y = (event.clientY / window.innerHeight) * 100;
      document.documentElement.style.setProperty("--mesh-x", `${x}%`);
      document.documentElement.style.setProperty("--mesh-y", `${y}%`);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  useEffect(() => {
    if (!requestId) return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/status/${requestId}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.hashscanUrl) setHashscanUrl(data.hashscanUrl);
      if (data.settlementHashscanUrl) setHashscanUrl(data.settlementHashscanUrl);
      setStatusMessage(data.stage || "awaiting_solver_execution");
    }, 2500);
    return () => clearInterval(interval);
  }, [requestId]);

  const parseUnitsSafe = useCallback((value: string, decimals: number): string | null => {
    const raw = value.trim();
    if (!raw) return "0";
    if (!/^\d*\.?\d*$/.test(raw)) return null;
    if (raw === ".") return "0";
    try {
      return ethers.parseUnits(raw, decimals).toString();
    } catch {
      return null;
    }
  }, []);

  const sanitizeDecimalInput = useCallback((value: string): string => {
    const clean = value.replace(/[^0-9.]/g, "");
    const firstDot = clean.indexOf(".");
    if (firstDot === -1) return clean;
    return `${clean.slice(0, firstDot + 1)}${clean.slice(firstDot + 1).replace(/\./g, "")}`;
  }, []);

  const formatHuman = useCallback((units: string, decimals: number, precision = 6): string => {
    const human = Number(ethers.formatUnits(BigInt(units || "0"), decimals));
    if (!Number.isFinite(human)) return "";
    return human.toFixed(precision).replace(/\.?0+$/, "");
  }, []);

  const applyLimitFromSellAndPrice = useCallback(
    (sellRaw: string, priceRaw: string) => {
      const usdcUnits = parseUnitsSafe(sellRaw, 6);
      const price = Number(priceRaw);
      if (usdcUnits === null || !priceRaw.trim() || !Number.isFinite(price) || price <= 0) return;
      if (usdcUnits === "0") {
        setAmountInSafe("0");
        setMinOutputSafe("0");
        setBuyHbarInput("");
        return;
      }
      const usdcHuman = Number(ethers.formatUnits(BigInt(usdcUnits), 6));
      const hbarHuman = usdcHuman * price;
      const hbarUnits = parseUnitsSafe(hbarHuman.toFixed(8), 8);
      if (!hbarUnits) return;
      setAmountInSafe(usdcUnits);
      setMinOutputSafe(hbarUnits);
      setBuyHbarInput(formatHuman(hbarUnits, 8, 8));
    },
    [formatHuman, parseUnitsSafe, setAmountInSafe, setMinOutputSafe],
  );

  const setLimitToMarket = useCallback(() => {
    if (marketPrice !== null && marketPrice > 0) {
      setLimitPriceInput(marketPrice.toFixed(6));
      setQuoteDirection("limitPrice");
      applyLimitFromSellAndPrice(sellUsdcInput, marketPrice.toFixed(6));
      invalidateIntent();
    }
  }, [applyLimitFromSellAndPrice, invalidateIntent, marketPrice, sellUsdcInput]);

  const handleOrderTypeChange = useCallback(
    (next: OrderType) => {
      setOrderType(next);
      invalidateIntent();
      if (next === "market") {
        setQuoteDirection("usdcToHbar");
      } else if (marketPrice !== null && marketPrice > 0 && !limitPriceInput.trim()) {
        setLimitPriceInput(marketPrice.toFixed(6));
        applyLimitFromSellAndPrice(sellUsdcInput, marketPrice.toFixed(6));
      } else if (limitPriceInput.trim()) {
        applyLimitFromSellAndPrice(sellUsdcInput, limitPriceInput);
      }
    },
    [applyLimitFromSellAndPrice, invalidateIntent, limitPriceInput, marketPrice, sellUsdcInput],
  );

  // Fetch market spot quote when selling USDC (market tab or for "Set to market").
  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(async () => {
      const inUnits = parseUnitsSafe(sellUsdcInput, 6);
      if (inUnits === null) return;
      if (inUnits === "0") {
        setMarketPrice(null);
        setMarketPriceDisplay("");
        if (orderType === "market") {
          setAmountInSafe("0");
          setMinOutputSafe("0");
          setBuyHbarInput("");
        }
        return;
      }

      setQuoteLoading(true);
      const res = await fetch(`/api/spot-quote?amountIn=${encodeURIComponent(inUnits)}&sellToken=usdc`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (cancelled) return;
      setQuoteLoading(false);

      const quoteOk = Boolean(data.ok && data.amountOut);
      setMarketQuoteOk(quoteOk);

      if (typeof data.price === "number" && Number.isFinite(data.price) && data.price > 0) {
        setMarketPrice(data.price);
        const unit = data.quote && data.base ? `${data.quote}/${data.base}` : "HBAR/USDC";
        setMarketPriceDisplay(`${data.price.toFixed(6)} ${unit}`);
      } else {
        setMarketPrice(null);
        setMarketPriceDisplay(data.priceLabel || "Market quote unavailable — use Limit or enter HBAR below");
      }

      if (orderType !== "market") return;

      if (quoteDirection === "hbarToUsdc" && !quoteOk) {
        const hbarUnits = parseUnitsSafe(buyHbarInput, 8);
        const usdcUnits = parseUnitsSafe(sellUsdcInput, 6);
        if (hbarUnits === null || usdcUnits === null || usdcUnits === "0" || hbarUnits === "0") return;
        const withSlippage = (BigInt(hbarUnits) * BigInt(99)) / BigInt(100);
        setAmountInSafe(usdcUnits);
        setMinOutputSafe(withSlippage.toString());
        return;
      }

      if (quoteDirection !== "usdcToHbar") return;

      if (!quoteOk) {
        const usdcHuman = Number(sellUsdcInput || "0");
        const hbarHuman = Number(buyHbarInput || "0");
        if (usdcHuman > 0 && hbarHuman > 0) {
          const withSlippage = hbarHuman * 0.99;
          const hbarUnits = parseUnitsSafe(withSlippage.toFixed(8), 8);
          if (hbarUnits) {
            setAmountInSafe(inUnits);
            setMinOutputSafe(hbarUnits);
          }
        }
        return;
      }

      const withSlippage = (BigInt(data.amountOut) * BigInt(99)) / BigInt(100);
      setAmountInSafe(inUnits);
      setMinOutputSafe(withSlippage.toString());
      setBuyHbarInput(formatHuman(withSlippage.toString(), 8, 8));
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [
    buyHbarInput,
    formatHuman,
    orderType,
    parseUnitsSafe,
    quoteDirection,
    sellUsdcInput,
    setAmountInSafe,
    setMinOutputSafe,
  ]);

  // Limit order: derive amounts from sell + limit price, or back-solve price from min receive.
  useEffect(() => {
    if (orderType !== "limit") return;
    let cancelled = false;
    const timeout = setTimeout(async () => {
      if (cancelled) return;

      if (quoteDirection === "hbarToUsdc") {
        const hbarUnits = parseUnitsSafe(buyHbarInput, 8);
        const usdcUnits = parseUnitsSafe(sellUsdcInput, 6);
        if (hbarUnits === null || usdcUnits === null || usdcUnits === "0" || hbarUnits === "0") return;
        const usdcHuman = Number(ethers.formatUnits(BigInt(usdcUnits), 6));
        const hbarHuman = Number(ethers.formatUnits(BigInt(hbarUnits), 8));
        if (usdcHuman > 0 && hbarHuman > 0) {
          setLimitPriceInput((hbarHuman / usdcHuman).toFixed(6));
          setAmountInSafe(usdcUnits);
          setMinOutputSafe(hbarUnits);
        }
        return;
      }

      if (quoteDirection === "limitPrice" || quoteDirection === "usdcToHbar") {
        applyLimitFromSellAndPrice(sellUsdcInput, limitPriceInput);
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [
    applyLimitFromSellAndPrice,
    buyHbarInput,
    limitPriceInput,
    orderType,
    parseUnitsSafe,
    quoteDirection,
    sellUsdcInput,
    setAmountInSafe,
    setMinOutputSafe,
  ]);

  useEffect(() => {
    if (!/^\d+\.\d+\.\d+$/.test(hederaAccountId.trim())) {
      setBalances(null);
      return;
    }
    const t = window.setTimeout(async () => {
      const res = await fetch(`/api/balances?accountId=${encodeURIComponent(hederaAccountId.trim())}`);
      const data = await res.json();
      if (!res.ok) return;
      setBalances(data);
    }, 450);
    return () => window.clearTimeout(t);
  }, [hederaAccountId]);

  const hbarBalanceDisplay = balances ? (Number(balances.hbarTinybar) / 1e8).toFixed(2) : "0.00";
  const usdcBalanceDisplay = balances ? (Number(balances.usdcUnits) / 1e6).toFixed(2) : "0.00";

  async function connectWallet() {
    try {
      if (!WALLETCONNECT_PROJECT_ID) {
        setStatusMessage("Missing WalletConnect project id.");
        return;
      }

      // Lazy-load to avoid SSR touching localStorage (WalletConnect libs are browser-only).
      const [{ LedgerId }, hederaWc] = await Promise.all([
        import("@hiero-ledger/sdk"),
        import("@hashgraph/hedera-wallet-connect"),
      ]);
      const { DAppConnector, HederaChainId, HederaJsonRpcMethod, HederaSessionEvent } = hederaWc as any;

      const metadata = {
        name: "Astrix",
        description: "Astrix on Hedera",
        url: typeof window !== "undefined" ? window.location.origin : "https://astrix.app",
        icons: [`${typeof window !== "undefined" ? window.location.origin : ""}/logo-astrix.png`],
      };

      const connector = new DAppConnector(
        metadata,
        LedgerId.TESTNET,
        WALLETCONNECT_PROJECT_ID,
        Object.values(HederaJsonRpcMethod),
        [HederaSessionEvent.ChainChanged, HederaSessionEvent.AccountsChanged],
        [HederaChainId.Testnet],
      );

      setStatusMessage("Opening HashPack / Hedera WalletConnect…");
      await connector.init({ logger: "error" });
      await connector.openModal();

      const signer = connector.signers?.[0];
      if (!signer) {
        setStatusMessage("No Hedera wallet account selected.");
        return;
      }

      // Ensure EVM chain is Hedera Testnet (296 / 0x128).
      const chainHex = (await signer.request({ method: "eth_chainId", params: [] })) as string;
      const chainId = Number.parseInt(chainHex, 16);
      if (chainId !== CHAIN_ID) {
        setStatusMessage("Switch wallet to Hedera Testnet (chain 296).");
        return;
      }

      const accounts = (await signer.request({ method: "eth_accounts", params: [] })) as string[];
      const evmAddress = accounts?.[0] || "";
      if (!evmAddress) {
        setStatusMessage("Wallet did not return an EVM address.");
        return;
      }

      wcRef.current = { connector, signer };
      setWalletAddress(evmAddress);
      try {
        setHederaAccountId(signer.getAccountId().toString());
      } catch {
        // optional
      }
      setStatusMessage("Wallet connected (Hedera Testnet).");
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Wallet connect failed.");
    }
  }

  function disconnectWallet() {
    setWalletAddress("");
    wcRef.current?.connector.disconnectAll().catch(() => {});
    wcRef.current = null;
    invalidateIntent();
    setStatusMessage("Disconnected.");
  }

  async function signIntent() {
    const wc = wcRef.current;
    if (!wc?.signer || !walletAddress) {
      setStatusMessage("Connect HashPack to sign.");
      return;
    }
    const domain = {
      name: "AstrixIntentSettlement",
      version: "1",
      chainId: CHAIN_ID,
      verifyingContract: VERIFYING_CONTRACT,
    };

    const types = {
      SwapIntent: [
        { name: "user", type: "address" },
        { name: "inputToken", type: "address" },
        { name: "outputToken", type: "address" },
        { name: "amount", type: "uint256" },
        { name: "minOutput", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
        { name: "chainId", type: "uint256" },
      ],
    };

    const deadline = Math.floor(Date.now() / 1000) + 60 * expirationMinutes;
    signedDeadlineRef.current = deadline;

    const value = {
      user: walletAddress,
      inputToken: USDC_EVM,
      outputToken: WHBAR_EVM,
      amount: amountIn,
      minOutput,
      nonce,
      deadline,
      chainId: CHAIN_ID,
    };

    const typedData = {
      types: {
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "version", type: "string" },
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" },
        ],
        SwapIntent: types.SwapIntent,
      },
      primaryType: "SwapIntent",
      domain,
      message: value,
    };

    const signed = (await wc.signer.request({
      method: "eth_signTypedData_v4",
      params: [walletAddress, JSON.stringify(typedData)],
    })) as string;

    setSignature(signed || "");
    setStatusMessage("Intent signed. Ready to broadcast.");
  }

  async function broadcastIntent() {
    if (!canBroadcast) return;
    const id = `intent-${Date.now()}`;
    const deadline = signedDeadlineRef.current || Math.floor(Date.now() / 1000) + 60 * expirationMinutes;

    const payload: IntentPayload = {
      requestId: id,
      intent: {
        intentId: Date.now(),
        signer: walletAddress,
        tokenIn: USDC_EVM,
        tokenOut: WHBAR_EVM,
        amountIn,
        minAmountOut: minOutput,
        deadline: String(deadline),
        nonce: String(nonce),
        receiver: walletAddress,
        chainId: String(CHAIN_ID),
        signature,
      },
    };

    const res = await fetch("/api/broadcast", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setStatusMessage(data.error || "Broadcast failed");
      return;
    }
    setRequestId(data.requestId);
    setHashscanUrl(data.hashscanUrl || "");
    setStatusMessage("Broadcasted to HCS.");
  }

  return (
    <div className="xy-page">
      <Navbar onConnectWallet={connectWallet} onDisconnect={disconnectWallet} walletAddress={walletAddress} />

      <main className="xy-main">
        <Hero />
        <PlaygroundPanel
          orderType={orderType}
          onOrderTypeChange={handleOrderTypeChange}
          walletAddress={walletAddress}
          hederaAccountId={hederaAccountId}
          setHederaAccountId={setHederaAccountId}
          nonce={nonce}
          setNonce={setNonceSafe}
          sellUsdcInput={sellUsdcInput}
          buyHbarInput={buyHbarInput}
          onSellUsdcInput={(v) => {
            setQuoteDirection("usdcToHbar");
            setSellUsdcInput(sanitizeDecimalInput(v));
            invalidateIntent();
          }}
          onBuyHbarInput={(v) => {
            if (orderType === "limit" || !marketQuoteOk) {
              setQuoteDirection("hbarToUsdc");
              setBuyHbarInput(sanitizeDecimalInput(v));
              invalidateIntent();
            }
          }}
          limitPriceInput={limitPriceInput}
          onLimitPriceInput={(v) => {
            setQuoteDirection("limitPrice");
            setLimitPriceInput(sanitizeDecimalInput(v));
            invalidateIntent();
          }}
          onSetLimitToMarket={setLimitToMarket}
          marketPriceDisplay={marketPriceDisplay}
          marketQuoteOk={marketQuoteOk}
          quoteLoading={quoteLoading}
          amountIn={amountIn}
          minOutput={minOutput}
          expirationMinutes={expirationMinutes}
          setExpirationMinutes={setExpirationSafe}
          usdcBalanceDisplay={usdcBalanceDisplay}
          hbarBalanceDisplay={hbarBalanceDisplay}
          canSign={canSign}
          canBroadcast={canBroadcast}
          onSign={signIntent}
          onBroadcast={broadcastIntent}
          statusMessage={statusMessage}
          hashscanUrl={hashscanUrl}
          whbarTokenId={WHBAR_TOKEN_ID}
          usdcTokenId={USDC_TOKEN_ID}
        />

        <div className="xy-stream-wrap">
          <ActiveIntentStream />
        </div>

        <TechnicalDeepDive />
      </main>

      <Footer />
    </div>
  );
}
