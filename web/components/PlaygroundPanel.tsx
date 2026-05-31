"use client";

import { useState } from "react";

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
  walletAddress: string;
  hederaAccountId: string;
  setHederaAccountId: (v: string) => void;
  nonce: string;
  setNonce: (v: string) => void;
  sellUsdcInput: string;
  buyHbarInput: string;
  onSellUsdcInput: (v: string) => void;
  onBuyHbarInput: (v: string) => void;
  limitPriceInput: string;
  onLimitPriceInput: (v: string) => void;
  onSetLimitToMarket: () => void;
  marketPriceDisplay: string;
  marketQuoteOk: boolean;
  quoteLoading: boolean;
  amountIn: string;
  minOutput: string;
  expirationMinutes: number;
  setExpirationMinutes: (v: number) => void;
  usdcBalanceDisplay: string;
  hbarBalanceDisplay: string;
  canSign: boolean;
  canBroadcast: boolean;
  onSign: () => void;
  onBroadcast: () => void;
  statusMessage: string;
  hashscanUrl: string;
  whbarTokenId: string;
  usdcTokenId: string;
};

export function PlaygroundPanel({
  orderType,
  onOrderTypeChange,
  walletAddress,
  hederaAccountId,
  setHederaAccountId,
  nonce,
  setNonce,
  sellUsdcInput,
  buyHbarInput,
  onSellUsdcInput,
  onBuyHbarInput,
  limitPriceInput,
  onLimitPriceInput,
  onSetLimitToMarket,
  marketPriceDisplay,
  marketQuoteOk,
  quoteLoading,
  amountIn,
  minOutput,
  expirationMinutes,
  setExpirationMinutes,
  usdcBalanceDisplay,
  hbarBalanceDisplay,
  canSign,
  canBroadcast,
  onSign,
  onBroadcast,
  statusMessage,
  hashscanUrl,
  whbarTokenId,
  usdcTokenId,
}: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const receiveReadOnly = orderType === "market" && marketQuoteOk;

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
            Balance: <span className="u-fg-soft">{usdcBalanceDisplay}</span> USDC
          </span>
        </div>
        <div className="xy-play__input-row">
          <input
            className="xy-play__input"
            value={sellUsdcInput}
            inputMode="decimal"
            placeholder="0"
            onChange={(e) => onSellUsdcInput(e.target.value)}
          />
          <span className="xy-play__token-pill">USDC</span>
        </div>
      </div>

      {orderType === "limit" ? (
        <div className="xy-play__box xy-play__box--compact">
          <div className="xy-play__row">
            <span className="xy-play__label">Limit price</span>
            <button type="button" className="xy-play__market-link" onClick={onSetLimitToMarket}>
              Set to market
            </button>
          </div>
          <div className="xy-play__input-row xy-play__input-row--sm">
            <input
              className="xy-play__input xy-play__input--sm"
              value={limitPriceInput}
              inputMode="decimal"
              placeholder="HBAR per USDC"
              onChange={(e) => onLimitPriceInput(e.target.value)}
            />
            <span className="xy-play__token-pill xy-play__token-pill--muted">HBAR / USDC</span>
          </div>
          {marketPriceDisplay ? (
            <p className="xy-play__hint">Market: {marketPriceDisplay}</p>
          ) : null}
        </div>
      ) : (
        <p className="xy-play__market-banner">
          {quoteLoading ? "Fetching market price…" : marketPriceDisplay || "Enter sell amount for market quote"}
        </p>
      )}

      <div className="xy-play__arrow">↓</div>

      <div className="xy-play__box">
        <div className="xy-play__row">
          <span className="xy-play__label">{orderType === "market" ? "Receive at least" : "Min receive"}</span>
          <span className="xy-play__balance">
            HBAR: <span className="u-fg-soft">{hbarBalanceDisplay}</span>
          </span>
        </div>
        <div className="xy-play__input-row">
          <input
            className="xy-play__input"
            value={buyHbarInput}
            inputMode="decimal"
            placeholder="0"
            readOnly={receiveReadOnly}
            onChange={(e) => onBuyHbarInput(e.target.value)}
          />
          <span className="xy-play__token-pill">HBAR</span>
        </div>
        {orderType === "market" ? (
          <p className="xy-play__hint">
            {marketQuoteOk
              ? "Auto-filled from SaucerSwap quote (1% slippage buffer)"
              : "Quoter offline — enter expected HBAR or switch to Limit order"}
          </p>
        ) : (
          <p className="xy-play__hint">Edit to adjust limit, or change limit price above</p>
        )}
      </div>

      <div className="xy-play__settings">
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
            On-chain: {amountIn} USDC units · min {minOutput} WHBAR units · {usdcTokenId} → {whbarTokenId}
          </p>
        </div>
      ) : null}

      <button
        type="button"
        className="button button-primary broadcast-pulse xy-play__cta"
        disabled={!canSign || amountIn === "0" || minOutput === "0"}
        onClick={canBroadcast ? onBroadcast : onSign}
      >
        {canBroadcast ? "Sign & Broadcast Intent" : "Sign Intent"}
      </button>

      <div className="xy-play__status">
        <p>
          <span className="u-fg">Status:</span> {statusMessage}
        </p>
        {hashscanUrl ? (
          <p>
            <a className="link-accent" href={hashscanUrl} target="_blank" rel="noreferrer">
              View on HashScan
            </a>
          </p>
        ) : null}
      </div>
    </article>
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
