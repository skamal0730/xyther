"use client";

import { motion } from "framer-motion";

export function Hero() {
  return (
    <motion.header
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="xy-hero"
    >
      <h1 className="xy-hero__h1">Astrix Protocol</h1>
      <h3 className="xy-hero__h3">The Intent-Centric Execution Layer</h3>
      <p className="xy-hero__title">Swap with Intent</p>
      <p className="xy-hero__lead">The first intent-centric liquidity layer on Hedera.</p>
      <p className="xy-hero__body">
        Sign off-chain, settle on-chain. <span className="xy-accent-cyan">Transparent ordering</span> via{" "}
        <span className="xy-accent-cyan">HCS</span> and <span className="xy-accent-gold">atomic settlement</span> via HTS.
      </p>
    </motion.header>
  );
}
