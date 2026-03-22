# Phase 1 – Independent Atomic Analysis  
*(Each atom is solved in isolation; no cross-contamination of reasoning.)*

## ATOM 1 – NEPSE Baseline Reality  
- **Liquidity**: Average daily turnover ≈ NPR 10–14 billion—tiny compared with regional exchanges.  
- **Investor mix**: ~6½–7 million DEMAT accounts (≈ 24 % of Nepal’s population); vast majority retail, < 9 000 institutional.  
- **Regulatory plumbing**  
  - T + 2 cash & securities settlement (CDSC); chronic settlement delays.  
  - Price-limit regime: ± 10 % per stock per day; index-wide circuit breakers at **4 %, 5 %, 6 %** with staged halts.  
  - No listed derivatives or market-wide IV gauge; SEBON has not approved derivatives trading.  
- **Technology**: Single matching engine (TMS) prone to outages; broker-concentration data EOD only.  
- **Micro-structure**: Tick-size NPR 0.1 (< Rs 100) or NPR 1 (≥ Rs 100); lot-size 10; short-selling & margin finance tightly capped by NRB.

---

## ATOM 2 – Pure Local Price-Action Signals Correlating with Business Growth  
1. **Persistent volume anomalies**: Sector bull phases (e.g., 2024–25 hydropower) preceded by **2 ×** volume spikes 7–10 sessions before lift-off.  
2. **NEPSE breakout recipe**: Resistance breach + 2–3 × avg volume + catalyst news ⇒ **10–30 %** follow-through.  
3. **Turnover breadth**: 5-day rising turnover + improving A/D ratio reliably precede index expansions.  
4. **Seasonality**: Fiscal year-end (mid-July) liquidity injections & post-Tihar earnings windows create repeatable bullish mini-cycles.  
5. **Sector rotation**: Banking → Hydropower → Insurance → Micro-finance observed in 4 of last 6 bull waves.

---

## ATOM 3 – Global Quantitative Forecasting Models (vacuum definition)  
A1. **Long Short-Term Memory (LSTM)** networks – learn sequential dependencies in price/volume series.  
A2. **Transformer-based price models** – self-attention captures long-range context; often fused with order-book depth.  
A3. **Hybrid ARIMA-GARCH** – AR component + conditional heteroskedasticity for clustered volatility.  
A4. **Monte-Carlo regime-switch simulations** – Markov-state drift/vol paths.  
A5. **Real-time NLP sentiment engines** – convert news / social chatter into factor scores.

---

## ATOM 4 – Fundamental–Technical Intersection Prior to NEPSE Breakouts  
- **EPS & BV acceleration** → Ascending-triangle inside 50-/200-day golden-cross zone.  
- **Dividend consistency** (3-yr uninterrupted) → 15–20 % pre-record-date run-ups on 2 × volume, then flag consolidation.  
- **P/E ≤ sector median** while sector index rising → Cup-and-handle completion and multi-week rally.  
- Panel regression (2007–2023, 16 banks): EPS & P/E significantly explain price (p < 0.05).  
- **Case study**: SCB vs Nabil – rising DPS/EPS aligned with significant price appreciation.

---

## ATOM 5 – The “Noise” Factor: Indicators That Misfire in NEPSE  
1. **Implied-vol / options metrics** – impossible; no derivatives.  
2. **HFT order-book imbalance signals** – granularity & latency make them useless.  
3. **Single-candle oscillators (RSI, MACD)** – spoofed by “broker-pressure candles.”  
4. **Global fear/greed gauges (VIX, MOVE)** – negligible transmission to closed capital account.  
5. **Intraday VWAP reversals** – distorted by circuit-halt-truncated sessions.

---

# Phase 2 – Synthesis & Contraction  
*(Atoms merged into an actionable research blueprint.)*

## 1  Adapting Global Models (Atom 3) to NEPSE Constraints (Atom 1)  
| Constraint | Required Adaptation |
|------------|--------------------|
| Low liquidity & sparse ticks | Re-sample to daily/weekly; apply volume-weighted masking so LSTM/Transformer ignores zero-volume intervals. |
| Circuit breakers | Add “halt-flag” feature; during halts set return = NA; let ARIMA-GARCH with dummy absorb structural gap. |
| T + 2 settlement drag | Lag explanatory variables by 2 trading days in Monte-Carlo & ML models to avoid look-ahead bias. |
| Retail-sentiment overshoot | Enrich NLP sentiment with Google-Trends keywords + **MeroShare** login counts (retail proxy). |
| No derivatives | Substitute implied-vol factor with **turnover-volatility proxy** (σ of log-turnover). |
| Small sample (≈ 6 k daily obs) | Use Bayesian shrinkage / dropout-regularised LSTMs; expanding-window cross-validation. |

---

## 2  NEPSE “Growth Checklist” (Atoms 2 + 4)  
A stock qualifies only if **all** boxes are ticked:  

| Category | Threshold |
|----------|-----------|
| Fundamentals | EPS CAGR ≥ 15 % (3 yrs) **AND** ROE ≥ 12 % |
| Valuation | Fwd P/E ≤ sector median × 1.2; P/B ≤ 2.5 (banks) or ≤ 4 (others) |
| Dividend Policy | ≥ 3 consecutive FYs of cash/bonus ≥ 15 % combined |
| Technical Base | 12-week ascending-triangle **OR** cup-and-handle; price between 50-dma & 200-dma with imminent golden-cross |
| Volume Signature | 5-day avg volume ≥ 200 % of 30-day avg **without** single-bar spikes |
| Sector Tail-wind | A/D > 1 **and** turnover rising 5 straight sessions |
| Catalyst Pipeline | Dividend/bonus, hydropower COD, or NRB directive expected ≤ 30 days |

---

## 3  Warning Guide – Filtering the Noise (Atom 5)  
- **Ignore** strategies requiring options Greeks, IV, VIX analogues—non-existent.  
- **Treat RSI/MACD** crossovers as *minor*; act only if volume continuity & broker concentration confirm.  
- **Discard VWAP reversals** after any circuit halt—the session’s price-discovery is broken.  
- **Reject millisecond order-book signals**—NEPSE feed latency > 500 ms.  
- **Prefer NRB liquidity reports & remittance flows** over global fear gauges.

---

## 4  Execution Road-map for Researchers  
1. **Collect** 2000-2026 daily OHLCV, corporate actions, NRB liquidity stats, remittance flows.  
2. **Engineer features** per Growth Checklist; tag historical “growth winners” (≥ 50 % 12 m price gain + EPS CAGR ≥ 15 %).  
3. **Train** Bayesian-dropout LSTM with halt-flag & turnover-vol proxies; validate on 2022-25 OOS.  
4. **Overlay checklist filters** live; trade only names passing all fundamental & price-action gates.  
5. **Audit false signals** continuously; update Noise Guide when new manipulation patterns surface.

> This blueprint fuses global quantitative methods with NEPSE’s unique micro-structure, maximises signal-to-noise, and grounds every forecast in both price behaviour **and** tangible business-growth metrics.