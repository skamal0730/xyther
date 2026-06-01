"use client";

import { useEffect, useState } from "react";

type Props = {
  message: string;
  hashscanUrl?: string;
  /** Bump when message changes to replay show animation */
  version?: number;
};

export function StatusToast({ message, hashscanUrl, version = 0 }: Props) {
  const [visible, setVisible] = useState(false);
  const isIdle = message === "Ready" || message === "Disconnected.";

  useEffect(() => {
    if (isIdle && !hashscanUrl) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const hide =
      hashscanUrl || message.toLowerCase().includes("fail") || message.toLowerCase().includes("missing")
        ? null
        : window.setTimeout(() => setVisible(false), 6000);
    return () => {
      if (hide) window.clearTimeout(hide);
    };
  }, [message, hashscanUrl, isIdle, version]);

  if (!visible) return null;

  const isError =
    message.toLowerCase().includes("fail") ||
    message.toLowerCase().includes("missing") ||
    message.toLowerCase().includes("pick") ||
    message.toLowerCase().includes("reference-price");

  return (
    <div className={`xy-toast ${isError ? "xy-toast--error" : "xy-toast--info"}`} role="status" aria-live="polite">
      <p className="xy-toast__msg">{message}</p>
      {hashscanUrl ? (
        <a className="xy-toast__link" href={hashscanUrl} target="_blank" rel="noreferrer">
          View on HashScan →
        </a>
      ) : null}
      <button type="button" className="xy-toast__close" onClick={() => setVisible(false)} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}
