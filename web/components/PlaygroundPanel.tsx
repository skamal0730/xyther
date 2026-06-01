"use client";

import { useState } from "react";
import { TokenListModal } from "@/components/TokenListModal";
import {
  PROTOCOL_FEE_PERCENT,
  QUOTE_REFRESH_MS,
  SLIPPAGE_PRESETS,
  type SwapToken,
} from "@/lib/tokens";

const EXPIRATION_OPTIONS = [
  { label: "5 Minutes", value: 5 },
  { label: "10 Minutes", value: 10 },
  { label: "20 Minutes", value: 20 },
  { label: "30 Minutes", value: 30 },
  { label: "60 Minutes", value: 60 },
];

export type OrderType = "market" | "limit";

type Props = {
  orderType: OrderType;
  onOrderTypeChange: (t: OrderType) => void;
  sellToken: SwapToken;
  buyToken: SwapToken;
  onSellTokenChange: (symbol: string) => void;
  onBuyTokenChange: (symbol: string) => void;
  walletAddress: string;
  hederaAccountId: string;
  setHederaAccountId: (v: string) => void;
  nonce: string;
  setNonce: (v: string) => void;
  sellAmountInput: string;
  buyAmountInput: string;
  onSellAmountInput: (v: string) => void;
  onBuyAmountInput: (v: string) => void;
  limitPriceInput: string;
  onLimitPriceInput: (v: string) => void;
  onSetLimitToMarket: () => void;
  marketPriceDisplay: string;
  canSetLimitToMarket: boolean;
  marketQuoteOk: boolean;
  quoteLoading: boolean;
  sameTokenPair: boolean;
  pairSignable: boolean;
  slippagePercent: number;
  onSlippageChange: (v: number) => void;
  onSwapTokens: () => void;
  amountIn: string;
  minOutput: string;
  expirationMinutes: number;
  setExpirationMinutes: (v: number) => void;
  sellBalanceDisplay: string;
  buyBalanceDisplay: string;
  canSign: boolean;
  canBroadcast: boolean;
  onSign: () => void;
  onBroadcast: () => void;
  quoteLiveLabel: string;
};

export function PlaygroundPanel({
  orderType,
  onOrderTypeChange,
  sellToken,
  buyToken,
  onSellTokenChange,
  onBuyTokenChange,
  walletAddress,
  hederaAccountId,
  setHederaAccountId,
  nonce,
  setNonce,
  sellAmountInput,
  buyAmountInput,
  onSellAmountInput,
  onBuyAmountInput,
  limitPriceInput,
  onLimitPriceInput,
  onSetLimitToMarket,
  marketPriceDisplay,
  canSetLimitToMarket,
  marketQuoteOk,
  quoteLoading,
  sameTokenPair,
  pairSignable,
  slippagePercent,
  onSlippageChange,
  onSwapTokens,
  amountIn,
  minOutput,
  expirationMinutes,
  setExpirationMinutes,
  sellBalanceDisplay,
  buyBalanceDisplay,
  canSign,
  canBroadcast,
  onSign,
  onBroadcast,
  quoteLiveLabel,
}: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [tokenModal, setTokenModal] = useState<"sell" | "buy" | null>(null);
  const receiveReadOnly = orderType === "market" && marketQuoteOk && !sameTokenPair;
  const limitPriceUnit = `${buyToken.symbol} / ${sellToken.symbol}`;
  const quoteOnlyPair = sellToken.quoteOnly || buyToken.quoteOnly;

  return (
    <article id="swap" className="glass-strong xy-play xy-scroll-target">
      <h2 className="xy-play__h2">Astrix Swap</h2>
      <p className="xy-play__sub">Sign an intent, broadcast to HCS, solvers compete to fill.</p>

      <div className="xy-play__tabs" role="tablist" aria-label="Order type">
        <button
          type="button"
          role="tab"
          aria-selected={orderType === "market"}
          className={orderType === "market" ? "xy-play__tab xy-play__tab--active" : "xy-play__tab"}
          onClick={() => onOrderTypeChange("market")}
        >
          Market Order
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={orderType === "limit"}
          className={orderType === "limit" ? "xy-play__tab xy-play__tab--active" : "xy-play__tab"}
          onClick={() => onOrderTypeChange("limit")}
        >
          Limit Order
        </button>
      </div>

      <div className="xy-play__box">
        <div className="xy-play__row">
          <span className="xy-play__label">Sell amount</span>
          <span className="xy-play__balance">
            Balance: <span className="u-fg-soft">{sellBalanceDisplay}</span>
          </span>
        </div>
        <div className="xy-play__input-row">
          <input
            className="xy-play__input"
            value={sellAmountInput}
            inputMode="decimal"
            placeholder="0"
            onChange={(e) => onSellAmountInput(e.target.value)}
          />
          <TokenPickerButton symbol={sellToken.symbol} onClick={() => setTokenModal("sell")} />
        </div>
      </div>

      {orderType === "limit" ? (
        <div className="xy-play__box xy-play__box--compact">
          <div className="xy-play__row">
            <span className="xy-play__label">Limit price</span>
            <button
              type="button"
              className="xy-play__market-link"
              onClick={onSetLimitToMarket}
              disabled={!canSetLimitToMarket}
            >
              Set to market
            </button>
          </div>
          <div className="xy-play__input-row xy-play__input-row--sm">
            <input
              className="xy-play__input xy-play__input--sm"
              value={limitPriceInput}
              inputMode="decimal"
              placeholder={`${buyToken.symbol} per ${sellToken.symbol}`}
              onChange={(e) => onLimitPriceInput(e.target.value)}
            />
            <span className="xy-play__token-pill xy-play__token-pill--muted">{limitPriceUnit}</span>
          </div>
          {marketPriceDisplay ? (
            <p className="xy-play__hint">Market: {marketPriceDisplay}</p>
          ) : null}
        </div>
      ) : marketPriceDisplay || quoteLoading ? (
        <p className="xy-play__market-banner">
          {quoteLoading ? "Fetching market rate…" : marketPriceDisplay}
        </p>
      ) : null}

      <div className="xy-play__swap-row">
        <button type="button" className="xy-play__arrow" onClick={onSwapTokens} aria-label="Swap sell and buy tokens">
          ↕
        </button>
      </div>

      <div className="xy-play__box">
        <div className="xy-play__row">
          <span className="xy-play__label">{orderType === "market" ? "Receive at least" : "Min receive"}</span>
          <span className="xy-play__balance">
            Balance: <span className="u-fg-soft">{buyBalanceDisplay}</span>
          </span>
        </div>
        <div className="xy-play__input-row">
          <input
            className="xy-play__input"
            value={buyAmountInput}
            inputMode="decimal"
            placeholder="0"
            readOnly={receiveReadOnly}
            onChange={(e) => onBuyAmountInput(e.target.value)}
          />
          <TokenPickerButton symbol={buyToken.symbol} onClick={() => setTokenModal("buy")} />
        </div>
        {sameTokenPair ? (
          <p className="xy-play__hint xy-play__hint--warn">Choose two different tokens to swap.</p>
        ) : quoteOnlyPair ? (
          <p className="xy-play__hint xy-play__hint--warn">
            Live rate shown for {sellToken.symbol}/{buyToken.symbol}. To sign &amp; broadcast on Hedera, pick USDC,
            HBAR, SAUCE, or XSAUCE.
          </p>
        ) : orderType === "market" ? (
          <p className="xy-play__hint">
            {marketQuoteOk
              ? `Estimated rate with ${slippagePercent}% max slippage`
              : "Enter expected receive amount, or switch to Limit order"}
          </p>
        ) : (
          <p className="xy-play__hint">Adjust receive amount or limit price above</p>
        )}
      </div>

      <div className="xy-play__trade-info">
        {quoteLiveLabel ? (
          <p className="xy-play__trade-info-line xy-play__trade-info-line--live">
            <span className="xy-play__live-dot" aria-hidden />
            {quoteLiveLabel}
          </p>
        ) : null}
        <p className="xy-play__trade-info-line xy-play__trade-info-line--muted">
          Rates refresh every {QUOTE_REFRESH_MS / 1000}s
        </p>
        <p className="xy-play__trade-info-line">
          Slippage: <strong>{slippagePercent}%</strong>
          <span className="xy-play__sep">·</span>
          Fee: <strong>{PROTOCOL_FEE_PERCENT}%</strong> (alpha)
        </p>
      </div>

      <div className="xy-play__settings">
        <label className="xy-play__field-label">
          <span>Max slippage</span>
          <div className="xy-play__slippage-row">
            {SLIPPAGE_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                className={slippagePercent === p ? "xy-play__slip xy-play__slip--active" : "xy-play__slip"}
                onClick={() => onSlippageChange(p)}
              >
                {p}%
              </button>
            ))}
          </div>
        </label>
        <label className="xy-play__field-label">
          <span>Expiry</span>
          <select
            className="xy-play__select"
            value={expirationMinutes}
            onChange={(e) => setExpirationMinutes(Number(e.target.value))}
          >
            {EXPIRATION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        type="button"
        className="xy-play__advanced-toggle"
        onClick={() => setShowAdvanced((v) => !v)}
      >
        {showAdvanced ? "Hide" : "Show"} advanced
      </button>

      {showAdvanced ? (
        <div className="xy-play__advanced">
          <Field label="Hedera account ID (balances)" value={hederaAccountId} onChange={setHederaAccountId} placeholder="0.0.xxxxx" />
          <div className="xy-play__grid2">
            <Field
              label="Wallet"
              value={walletAddress ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}` : "—"}
              readOnly
            />
            <Field label="Nonce" value={nonce} onChange={setNonce} />
          </div>
          <p className="xy-play__hint">
            On-chain: {amountIn} {sellToken.symbol} units → min {minOutput} {buyToken.symbol} units
          </p>
        </div>
      ) : null}

      <button
        type="button"
        className="button button-primary broadcast-pulse xy-play__cta"
        disabled={!canSign || sameTokenPair || !pairSignable || amountIn === "0" || minOutput === "0"}
        onClick={canBroadcast ? onBroadcast : onSign}
      >
        {canBroadcast ? "Sign & Broadcast Intent" : "Sign Intent"}
      </button>

      <TokenListModal
        open={tokenModal === "sell"}
        onClose={() => setTokenModal(null)}
        excludeSymbol={buyToken.symbol}
        title="Select token to sell"
        onSelect={(t) => onSellTokenChange(t.symbol)}
      />
      <TokenListModal
        open={tokenModal === "buy"}
        onClose={() => setTokenModal(null)}
        excludeSymbol={sellToken.symbol}
        title="Select token to buy"
        onSelect={(t) => onBuyTokenChange(t.symbol)}
      />
    </article>
  );
}

function TokenPickerButton({ symbol, onClick }: { symbol: string; onClick: () => void }) {
  return (
    <button type="button" className="xy-play__token-pill xy-play__token-pill--btn" onClick={onClick}>
      {symbol}
      <span className="xy-play__chev" aria-hidden>
        ▾
      </span>
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
}) {
  return (
    <label className="xy-play__mini-label">
      <div>{label}</div>
      <input
        className="xy-play__mini-input"
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </label>
  );
}
