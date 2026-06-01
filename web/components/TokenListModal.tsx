"use client";

import { useMemo, useState } from "react";
import { SWAP_TOKENS } from "@/lib/tokens";
import type { SwapToken } from "@/lib/tokenTypes";

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (token: SwapToken) => void;
  excludeSymbol?: string;
  title?: string;
};

export function TokenListModal({ open, onClose, onSelect, excludeSymbol, title = "Select a token" }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SWAP_TOKENS.filter((t) => {
      if (t.symbol === excludeSymbol) return false;
      if (!q) return true;
      return (
        t.symbol.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.hederaId.includes(q)
      );
    });
  }, [excludeSymbol, query]);

  if (!open) return null;

  return (
    <div className="xy-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="xy-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="xy-modal__header">
          <h3 className="xy-modal__title">{title}</h3>
          <button type="button" className="xy-modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <input
          className="xy-modal__search"
          placeholder="Search name or symbol"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <ul className="xy-modal__list">
          {filtered.map((token) => (
            <li key={token.symbol}>
              <button
                type="button"
                className="xy-modal__item"
                onClick={() => {
                  onSelect(token);
                  setQuery("");
                  onClose();
                }}
              >
                <span className="xy-modal__symbol">{token.symbol}</span>
                <span className="xy-modal__name">{token.name}</span>
                {token.quoteOnly ? (
                  <span className="xy-modal__tag">Reference price</span>
                ) : token.settlementSupported ? (
                  <span className="xy-modal__tag xy-modal__tag--ok">Settles</span>
                ) : null}
              </button>
            </li>
          ))}
          {filtered.length === 0 ? <li className="xy-modal__empty">No tokens match your search.</li> : null}
        </ul>
      </div>
    </div>
  );
}
