"use client";

import { ethers } from "ethers";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActiveIntentStream } from "@/components/ActiveIntentStream";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { Navbar } from "@/components/Navbar";
import { PlaygroundPanel, type OrderType } from "@/components/PlaygroundPanel";
import { StatusToast } from "@/components/StatusToast";
import { TechnicalDeepDive } from "@/components/TechnicalDeepDive";
import {
  DEFAULT_BUY_SYMBOL,
  DEFAULT_SELL_SYMBOL,
  DEFAULT_SLIPPAGE_PERCENT,
  isSignablePair,
  QUOTE_REFRESH_MS,
  tokenBySymbol,
  type SwapToken,
} from "@/lib/tokens";

const CHAIN_ID = 296;
const VERIFYING_CONTRACT =
  process.env.NEXT_PUBLIC_SETTLEMENT_CONTRACT || "0x597d420DaB6A4f6E04b446D7ee9c6F938d6Bf4F7";
const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";

type QuoteDirection = "sellAmount" | "buyAmount" | "limitPrice";

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

function formatRateDisplay(base: string, quote: string, price: number): string {
  return `1 ${base} ≈ ${price.toFixed(6)} ${quote}`;
}

/** Basis-point multiplier for min receive: 10000 = 100%, 9950 = 0.5% slippage */
function slippageFactorBps(slippagePercent: number): bigint {
  const bps = Math.round(slippagePercent * 100);
  return BigInt(10000 - Math.min(Math.max(bps, 1), 5000));
}

export default function Home() {
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [sellSymbol, setSellSymbol] = useState(DEFAULT_SELL_SYMBOL);
  const [buySymbol, setBuySymbol] = useState(DEFAULT_BUY_SYMBOL);
  const sellToken = useMemo(() => tokenBySymbol(sellSymbol)!, [sellSymbol]);
  const buyToken = useMemo(() => tokenBySymbol(buySymbol)!, [buySymbol]);
  const sameTokenPair = sellSymbol === buySymbol;
  const pairSignable = isSignablePair(sellToken, buyToken);
  const [slippagePercent, setSlippagePercent] = useState(DEFAULT_SLIPPAGE_PERCENT);
  const slippageFactor = useMemo(() => slippageFactorBps(slippagePercent), [slippagePercent]);

  const [walletAddress, setWalletAddress] = useState<string>("");
  const [hederaAccountId, setHederaAccountId] = useState("");
  const [signature, setSignature] = useState("");
  const [requestId, setRequestId] = useState("");
  const [statusMessage, setStatusMessage] = useState("Ready");
  const [hashscanUrl, setHashscanUrl] = useState("");
  const [amountIn, setAmountIn] = useState("10000000");
  const [minOutput, setMinOutput] = useState("0");
  const [sellAmountInput, setSellAmountInput] = useState("10");
  const [buyAmountInput, setBuyAmountInput] = useState("");
  const [quoteDirection, setQuoteDirection] = useState<QuoteDirection>("sellAmount");
  const [nonce, setNonce] = useState(String(Date.now()));
  const [sellBalanceDisplay, setSellBalanceDisplay] = useState("0.00");
  const [buyBalanceDisplay, setBuyBalanceDisplay] = useState("0.00");
  const [expirationMinutes, setExpirationMinutes] = useState(20);
  const [limitPriceInput, setLimitPriceInput] = useState("");
  const [marketPrice, setMarketPrice] = useState<number | null>(null);
  const [marketPriceDisplay, setMarketPriceDisplay] = useState("");
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [marketQuoteOk, setMarketQuoteOk] = useState(false);
  const [quoteTick, setQuoteTick] = useState(0);
  const [quoteUpdatedAt, setQuoteUpdatedAt] = useState<number | null>(null);
  const [statusVersion, setStatusVersion] = useState(0);
  const signedDeadlineRef = useRef(0);
  const limitPriceManualRef = useRef(false);
  const wcRef = useRef<{ connector: any; signer: any } | null>(null);

  const pushStatus = useCallback((msg: string) => {
    setStatusMessage(msg);
    setStatusVersion((v) => v + 1);
  }, []);

  const canSign = Boolean(walletAddress);
  const canBroadcast = Boolean(signature && walletAddress);
  const canSetLimitToMarket = marketPrice !== null && marketPrice > 0 && !sameTokenPair;

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

  const formatHuman = useCallback((units: string, decimals: number, precision?: number): string => {
    const p = precision ?? Math.min(decimals, 8);
    const human = Number(ethers.formatUnits(BigInt(units || "0"), decimals));
    if (!Number.isFinite(human)) return "";
    return human.toFixed(p).replace(/\.?0+$/, "");
  }, []);

  const applyLimitFromSellAndPrice = useCallback(
    (sellRaw: string, priceRaw: string, sell: SwapToken, buy: SwapToken) => {
      const sellUnits = parseUnitsSafe(sellRaw, sell.decimals);
      const price = Number(priceRaw);
      if (sellUnits === null || !priceRaw.trim() || !Number.isFinite(price) || price <= 0) return;
      if (sellUnits === "0") {
        setAmountInSafe("0");
        setMinOutputSafe("0");
        setBuyAmountInput("");
        return;
      }
      const sellHuman = Number(ethers.formatUnits(BigInt(sellUnits), sell.decimals));
      const buyHuman = sellHuman * price;
      const buyUnits = parseUnitsSafe(buyHuman.toFixed(buy.decimals), buy.decimals);
      if (!buyUnits) return;
      setAmountInSafe(sellUnits);
      setMinOutputSafe(buyUnits);
      setBuyAmountInput(formatHuman(buyUnits, buy.decimals, buy.decimals));
    },
    [formatHuman, parseUnitsSafe, setAmountInSafe, setMinOutputSafe],
  );

  const applyQuoteResponse = useCallback(
    (data: { ok?: boolean; amountOut?: string; price?: number; base?: string; quote?: string }) => {
      const quoteOk = Boolean(data.ok && data.amountOut);
      setMarketQuoteOk(quoteOk);

      if (typeof data.price === "number" && Number.isFinite(data.price) && data.price > 0 && data.base && data.quote) {
        setMarketPrice(data.price);
        setMarketPriceDisplay(formatRateDisplay(data.base, data.quote, data.price));
      } else {
        setMarketPrice(null);
        setMarketPriceDisplay("");
      }
      return quoteOk;
    },
    [],
  );

  const setLimitToMarket = useCallback(() => {
    if (marketPrice !== null && marketPrice > 0) {
      limitPriceManualRef.current = false;
      setLimitPriceInput(marketPrice.toFixed(6));
      setQuoteDirection("limitPrice");
      applyLimitFromSellAndPrice(sellAmountInput, marketPrice.toFixed(6), sellToken, buyToken);
      invalidateIntent();
    }
  }, [applyLimitFromSellAndPrice, buyToken, invalidateIntent, marketPrice, sellAmountInput, sellToken]);

  const handleOrderTypeChange = useCallback(
    (next: OrderType) => {
      setOrderType(next);
      invalidateIntent();
      if (next === "market") {
        setQuoteDirection("sellAmount");
      } else if (marketPrice !== null && marketPrice > 0 && !limitPriceInput.trim()) {
        setLimitPriceInput(marketPrice.toFixed(6));
        applyLimitFromSellAndPrice(sellAmountInput, marketPrice.toFixed(6), sellToken, buyToken);
      } else if (limitPriceInput.trim()) {
        applyLimitFromSellAndPrice(sellAmountInput, limitPriceInput, sellToken, buyToken);
      }
    },
    [
      applyLimitFromSellAndPrice,
      buyToken,
      invalidateIntent,
      limitPriceInput,
      marketPrice,
      sellAmountInput,
      sellToken,
    ],
  );

  const handleSellTokenChange = useCallback(
    (symbol: string) => {
      limitPriceManualRef.current = false;
      setSellSymbol(symbol);
      if (symbol === buySymbol) {
        const fallback = symbol === DEFAULT_BUY_SYMBOL ? DEFAULT_SELL_SYMBOL : DEFAULT_BUY_SYMBOL;
        setBuySymbol(fallback);
      }
      setQuoteDirection("sellAmount");
      invalidateIntent();
    },
    [buySymbol, invalidateIntent],
  );

  const handleBuyTokenChange = useCallback(
    (symbol: string) => {
      limitPriceManualRef.current = false;
      setBuySymbol(symbol);
      if (symbol === sellSymbol) {
        const fallback = symbol === DEFAULT_SELL_SYMBOL ? DEFAULT_BUY_SYMBOL : DEFAULT_SELL_SYMBOL;
        setSellSymbol(fallback);
      }
      setQuoteDirection("sellAmount");
      invalidateIntent();
    },
    [sellSymbol, invalidateIntent],
  );

  const quoteLiveLabel = useMemo(() => {
    if (sameTokenPair) return "";
    if (quoteLoading && !marketPriceDisplay) return "Fetching live market rate…";
    if (!marketPriceDisplay) return "";
    const ageSec =
      quoteUpdatedAt != null ? Math.max(0, Math.floor((Date.now() - quoteUpdatedAt) / 1000)) : null;
    const ageLabel =
      ageSec == null ? "" : ageSec < 5 ? " · just now" : ageSec < 60 ? ` · ${ageSec}s ago` : ` · ${Math.floor(ageSec / 60)}m ago`;
    const suffix = quoteLoading ? " · updating…" : ageLabel;
    return `${marketPriceDisplay}${suffix}`;
  }, [marketPriceDisplay, quoteLoading, quoteUpdatedAt, quoteTick, sameTokenPair]);

  const handleSwapTokens = useCallback(() => {
    setSellSymbol(buySymbol);
    setBuySymbol(sellSymbol);
    const sellAmt = sellAmountInput;
    setSellAmountInput(buyAmountInput);
    setBuyAmountInput(sellAmt);
    setQuoteDirection("sellAmount");
    invalidateIntent();
  }, [buyAmountInput, buySymbol, invalidateIntent, sellAmountInput, sellSymbol]);

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
      const stage = data.stage || "awaiting_solver_execution";
      pushStatus(stage.replaceAll("_", " "));
    }, 2500);
    return () => clearInterval(interval);
  }, [pushStatus, requestId]);

  const refreshLiveQuote = useCallback(async () => {
    if (sameTokenPair) {
      setMarketPrice(null);
      setMarketPriceDisplay("");
      setMarketQuoteOk(false);
      return;
    }

    const inUnits = parseUnitsSafe(sellAmountInput, sellToken.decimals);
    if (inUnits === null) return;
    if (inUnits === "0") {
      setMarketPrice(null);
      setMarketPriceDisplay("");
      setMarketQuoteOk(false);
      if (orderType === "market") {
        setAmountInSafe("0");
        setMinOutputSafe("0");
        setBuyAmountInput("");
      }
      return;
    }

    setQuoteLoading(true);
    try {
      const res = await fetch(
        `/api/spot-quote?amountIn=${encodeURIComponent(inUnits)}&tokenIn=${encodeURIComponent(sellToken.symbol)}&tokenOut=${encodeURIComponent(buyToken.symbol)}&fresh=1`,
        { cache: "no-store" },
      );
      const data = await res.json();
      if (typeof data.quotedAt === "number") setQuoteUpdatedAt(data.quotedAt);

      const quoteOk = applyQuoteResponse(data);

      if (orderType === "limit" && quoteOk && data.amountOut) {
        const rate = typeof data.price === "number" && data.price > 0 ? data.price : undefined;
        if (rate && !limitPriceManualRef.current) {
          setLimitPriceInput(rate.toFixed(6));
        }
        const priceStr = limitPriceManualRef.current
          ? limitPriceInput.trim()
          : limitPriceInput.trim() || (rate ? rate.toFixed(6) : "");
        if (priceStr) {
          applyLimitFromSellAndPrice(sellAmountInput, priceStr, sellToken, buyToken);
        }
        return;
      }

      if (orderType !== "market") return;

      if (quoteDirection === "buyAmount" && !quoteOk) {
        const buyUnits = parseUnitsSafe(buyAmountInput, buyToken.decimals);
        const sellUnits = parseUnitsSafe(sellAmountInput, sellToken.decimals);
        if (buyUnits === null || sellUnits === null || sellUnits === "0" || buyUnits === "0") return;
        const withSlippage = (BigInt(buyUnits) * slippageFactor) / BigInt(10000);
        setAmountInSafe(sellUnits);
        setMinOutputSafe(withSlippage.toString());
        return;
      }

      if (quoteDirection !== "sellAmount") return;

      if (!quoteOk) {
        const sellHuman = Number(sellAmountInput || "0");
        const buyHuman = Number(buyAmountInput || "0");
        if (sellHuman > 0 && buyHuman > 0) {
          const withSlippage = buyHuman * (Number(slippageFactor) / 10000);
          const buyUnits = parseUnitsSafe(withSlippage.toFixed(buyToken.decimals), buyToken.decimals);
          if (buyUnits) {
            setAmountInSafe(inUnits);
            setMinOutputSafe(buyUnits);
          }
        }
        return;
      }

      const withSlippage = (BigInt(data.amountOut) * slippageFactor) / BigInt(10000);
      setAmountInSafe(inUnits);
      setMinOutputSafe(withSlippage.toString());
      setBuyAmountInput(formatHuman(withSlippage.toString(), buyToken.decimals, buyToken.decimals));
    } finally {
      setQuoteLoading(false);
    }
  }, [
    applyLimitFromSellAndPrice,
    applyQuoteResponse,
    buyAmountInput,
    buyToken,
    formatHuman,
    limitPriceInput,
    orderType,
    parseUnitsSafe,
    quoteDirection,
    sameTokenPair,
    sellAmountInput,
    sellToken,
    setAmountInSafe,
    setMinOutputSafe,
    slippageFactor,
  ]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void refreshLiveQuote();
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [refreshLiveQuote, quoteTick]);

  useEffect(() => {
    if (sameTokenPair) return;
    const id = window.setInterval(() => setQuoteTick((t) => t + 1), QUOTE_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [sameTokenPair]);

  useEffect(() => {
    if (orderType !== "limit" || sameTokenPair) return;
    let cancelled = false;
    const timeout = setTimeout(async () => {
      if (cancelled) return;

      if (quoteDirection === "buyAmount") {
        const buyUnits = parseUnitsSafe(buyAmountInput, buyToken.decimals);
        const sellUnits = parseUnitsSafe(sellAmountInput, sellToken.decimals);
        if (buyUnits === null || sellUnits === null || sellUnits === "0" || buyUnits === "0") return;
        const sellHuman = Number(ethers.formatUnits(BigInt(sellUnits), sellToken.decimals));
        const buyHuman = Number(ethers.formatUnits(BigInt(buyUnits), buyToken.decimals));
        if (sellHuman > 0 && buyHuman > 0) {
          setLimitPriceInput((buyHuman / sellHuman).toFixed(6));
          setAmountInSafe(sellUnits);
          setMinOutputSafe(buyUnits);
        }
        return;
      }

      if (quoteDirection === "limitPrice" || quoteDirection === "sellAmount") {
        applyLimitFromSellAndPrice(sellAmountInput, limitPriceInput, sellToken, buyToken);
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [
    applyLimitFromSellAndPrice,
    buyAmountInput,
    buyToken,
    limitPriceInput,
    orderType,
    parseUnitsSafe,
    quoteDirection,
    sameTokenPair,
    sellAmountInput,
    sellToken,
    setAmountInSafe,
    setMinOutputSafe,
  ]);

  useEffect(() => {
    if (!/^\d+\.\d+\.\d+$/.test(hederaAccountId.trim())) {
      setSellBalanceDisplay("0.00");
      setBuyBalanceDisplay("0.00");
      return;
    }
    const account = hederaAccountId.trim();
    const t = window.setTimeout(async () => {
      const [sellRes, buyRes, hbarRes] = await Promise.all([
        fetch(`/api/balances?accountId=${encodeURIComponent(account)}&sellToken=${sellToken.symbol}`),
        fetch(`/api/balances?accountId=${encodeURIComponent(account)}&sellToken=${buyToken.symbol}`),
        fetch(`/api/balances?accountId=${encodeURIComponent(account)}&sellToken=USDC`),
      ]);
      if (sellRes.ok) {
        const d = await sellRes.json();
        const dec = d.sellTokenDecimals ?? sellToken.decimals;
        setSellBalanceDisplay((Number(d.sellTokenUnits ?? d.usdcUnits ?? 0) / 10 ** dec).toFixed(2));
      }
      if (buyRes.ok) {
        const d = await buyRes.json();
        const dec = d.sellTokenDecimals ?? buyToken.decimals;
        if (buyToken.isNativeHbar) {
          if (hbarRes.ok) {
            const h = await hbarRes.json();
            setBuyBalanceDisplay((Number(h.hbarTinybar ?? 0) / 1e8).toFixed(2));
          }
        } else {
          setBuyBalanceDisplay((Number(d.sellTokenUnits ?? 0) / 10 ** dec).toFixed(2));
        }
      }
    }, 450);
    return () => window.clearTimeout(t);
  }, [buyToken, hederaAccountId, sellToken]);

  async function connectWallet() {
    try {
      if (!WALLETCONNECT_PROJECT_ID) {
        pushStatus("WalletConnect is not configured for this deployment.");
        return;
      }

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

      pushStatus("Opening HashPack…");
      await connector.init({ logger: "error" });
      await connector.openModal();

      const signer = connector.signers?.[0];
      if (!signer) {
        pushStatus("No wallet account selected.");
        return;
      }

      const chainHex = (await signer.request({ method: "eth_chainId", params: [] })) as string;
      const chainId = Number.parseInt(chainHex, 16);
      if (chainId !== CHAIN_ID) {
        pushStatus("Switch your wallet to Hedera Testnet.");
        return;
      }

      const accounts = (await signer.request({ method: "eth_accounts", params: [] })) as string[];
      const evmAddress = accounts?.[0] || "";
      if (!evmAddress) {
        pushStatus("Wallet did not return an address.");
        return;
      }

      wcRef.current = { connector, signer };
      setWalletAddress(evmAddress);
      try {
        setHederaAccountId(signer.getAccountId().toString());
      } catch {
        // optional
      }
      pushStatus("Wallet connected.");
    } catch (err) {
      pushStatus(err instanceof Error ? err.message : "Could not connect wallet.");
    }
  }

  function disconnectWallet() {
    setWalletAddress("");
    wcRef.current?.connector.disconnectAll().catch(() => {});
    wcRef.current = null;
    invalidateIntent();
    pushStatus("Disconnected.");
  }

  async function signIntent() {
    const wc = wcRef.current;
    if (!wc?.signer || !walletAddress) {
      pushStatus("Connect your wallet to sign.");
      return;
    }
    if (sameTokenPair) {
      pushStatus("Pick two different tokens.");
      return;
    }
    if (!pairSignable) {
      pushStatus("Reference price only — sign with USDC, HBAR, SAUCE, or XSAUCE on Hedera testnet.");
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
      inputToken: sellToken.evmAddress,
      outputToken: buyToken.evmAddress,
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
    pushStatus("Intent signed. Ready to broadcast.");
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
        tokenIn: sellToken.evmAddress,
        tokenOut: buyToken.evmAddress,
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
      pushStatus(data.error || "Broadcast failed. Try again.");
      return;
    }
    setRequestId(data.requestId);
    setHashscanUrl(data.hashscanUrl || "");
    pushStatus("Broadcasted to HCS.");
  }

  return (
    <div className="xy-page">
      <StatusToast message={statusMessage} hashscanUrl={hashscanUrl} version={statusVersion} />
      <Navbar onConnectWallet={connectWallet} onDisconnect={disconnectWallet} walletAddress={walletAddress} />

      <main className="xy-main">
        <Hero />
        <PlaygroundPanel
          orderType={orderType}
          onOrderTypeChange={handleOrderTypeChange}
          sellToken={sellToken}
          buyToken={buyToken}
          onSellTokenChange={handleSellTokenChange}
          onBuyTokenChange={handleBuyTokenChange}
          walletAddress={walletAddress}
          hederaAccountId={hederaAccountId}
          setHederaAccountId={setHederaAccountId}
          nonce={nonce}
          setNonce={setNonceSafe}
          sellAmountInput={sellAmountInput}
          buyAmountInput={buyAmountInput}
          onSellAmountInput={(v) => {
            setQuoteDirection("sellAmount");
            setSellAmountInput(sanitizeDecimalInput(v));
            invalidateIntent();
          }}
          onBuyAmountInput={(v) => {
            if (orderType === "limit" || !marketQuoteOk) {
              setQuoteDirection("buyAmount");
              setBuyAmountInput(sanitizeDecimalInput(v));
              invalidateIntent();
            }
          }}
          limitPriceInput={limitPriceInput}
          onLimitPriceInput={(v) => {
            limitPriceManualRef.current = true;
            setQuoteDirection("limitPrice");
            setLimitPriceInput(sanitizeDecimalInput(v));
            invalidateIntent();
          }}
          onSetLimitToMarket={setLimitToMarket}
          onSwapTokens={handleSwapTokens}
          marketPriceDisplay={marketPriceDisplay}
          canSetLimitToMarket={canSetLimitToMarket}
          marketQuoteOk={marketQuoteOk}
          quoteLoading={quoteLoading}
          sameTokenPair={sameTokenPair}
          pairSignable={pairSignable}
          slippagePercent={slippagePercent}
          onSlippageChange={(v) => {
            setSlippagePercent(v);
            invalidateIntent();
          }}
          amountIn={amountIn}
          minOutput={minOutput}
          expirationMinutes={expirationMinutes}
          setExpirationMinutes={setExpirationSafe}
          sellBalanceDisplay={sellBalanceDisplay}
          buyBalanceDisplay={buyBalanceDisplay}
          canSign={canSign}
          canBroadcast={canBroadcast}
          onSign={signIntent}
          onBroadcast={broadcastIntent}
          quoteLiveLabel={quoteLiveLabel}
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
