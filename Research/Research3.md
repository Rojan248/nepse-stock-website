# 📊 NEPSE Growth Forecasting Research Report

## *Atom of Thoughts Framework — Quantitative Analysis for Nepal Stock Exchange*

---

# Phase 1: Independent Atomic Analysis

---

## Atom 1: The NEPSE Baseline Reality — Structural Constraints

### 1.1 Monopolistic Exchange Structure

The Nepal Stock Exchange (NEPSE) is the sole stock exchange located in Kathmandu, Nepal. The absence of competitive pressure has not necessarily driven innovation or rapid development within NEPSE. Instead, it may have contributed to complacency or a slower pace of modernization. While a single exchange could theoretically centralize liquidity, in Nepal's context, it appears to have inadvertently fostered an environment that struggles with efficiency and growth.

### 1.2 Market Scale & Capitalization

As of July 2025, the Market Capitalization of the companies listed on NEPSE totaled रू465,698.5 crore (US\$34 billion). The number of listed companies stood at 410 as of May 2025. For context, this is approximately 0.03% of the NYSE's market cap — a genuine **frontier market** by any institutional classification.

### 1.3 Trading Window Compression

At three hours per day, NEPSE has one of the shortest trading windows among major stock exchanges. This concentrates trading volume and liquidity into a relatively tight window, which can mean faster price movements and higher volatility — especially around the opening minutes of the session. This is a **critical structural constraint** that fundamentally alters how any quantitative model must treat intraday data.

### 1.4 Circuit Breaker Architecture

The index-based circuit breaker system applies at 3 stages of the NEPSE index movement of 4%, 5%, and 6%. These circuit breakers, when triggered, bring about a trading halt in all securities. The circuit breaker for individual securities applies at 10% price movement on either side (positive or negative). The stock cannot trade at a price higher or lower than 10% of the last traded price.

**Critically**, SEBON officials acknowledged that circuit breakers in Nepal have been triggered far more frequently than international norms. Following the Falgun 21 election results, the market opened strongly but was forced to close after only three minutes of trading due to circuit breaker triggers. SEBON is now actively exploring relaxation: One proposal involves expanding circuit breaker thresholds to 4%, 6%, and 8%, giving the market greater flexibility before trading is halted.

### 1.5 Ownership & Regulatory Structure

The significant ownership stake held by the Government of Nepal and other state-owned entities like Nepal Rastra Bank and Employees Provident Fund positions the government as a dominant force within NEPSE. This strong public-sector control, when viewed alongside the market's "infant stage" and persistent challenges such as limited diversification and price manipulation, suggests a direct link between government policy, administrative capacity, and market maturity.

It opened in 1994 and is regulated by the Securities Board of Nepal. The introduction of a weighted average closing price calculation in the final 15 minutes of trading aims to reduce price manipulation and increase transparency.

### 1.6 Retail Dominance & Manipulation Risk

In NEPSE, where retail power dominates, brokers play a huge role in shaping price action. Some scripts, traded among a tight group, 15–20 times within a day — massive turnover, but no long-term investor behind it — price pushed up, momentum created, retailers lured.

### 1.7 Settlement & Infrastructure

NEPSE is reportedly exploring faster settlement options in the future to improve market liquidity, but T+2 remains the current standard. NEPSE operates through a network of 92 registered brokers and 41 Remote Work Stations (RWS) across 21 cities.

### Atom 1 Conclusion Table

| Constraint | Quantitative Parameter | Impact Rating |
| --- | --- | --- |
| Monopoly Exchange | 1 exchange, ~410 listed companies | HIGH |
| Trading Window | 3 hours/day (11 AM – 2 PM) | CRITICAL |
| Index Circuit Breaker | 4%/5%/6% tiered halts | HIGH |
| Individual Stock Circuit | ±10% daily price limit | HIGH |
| Settlement | T+2 | MODERATE |
| Retail Dominance | >90% estimated retail participation | CRITICAL |
| Political Sensitivity | Frequent market halts on political events | HIGH |

---

## Atom 2: Pure Local Price Action — NEPSE-Specific Patterns

### 2.1 Volume as the Primary Signal (and Primary Trap)

NEPSE live trading volume is often more important than price movement. However, this requires extreme caution: Some scripts, traded among a tight group, 15–20 times within a day — massive turnover, but no long-term investor behind it — price pushed up, momentum created, retailers lured in — exit happens within hours — volume dies, price crashes.

**Actionable volume-price correlation framework for NEPSE:**

| Signal | Volume | Price | Interpretation |
| --- | --- | --- | --- |
| Genuine Accumulation | Rising, broad broker participation | Gradual increase | **STRONG BUY SIGNAL** |
| Pump Trap | Rising, concentrated in 1–2 brokers | Sharp spike | **DANGER — False signal** |
| Distribution | Declining from peak | Flat or rising | **SELL/EXIT SIGNAL** |
| Capitulation | Extreme spike | Sharp decline | **Potential reversal zone** |

### 2.2 Broker Concentration Analysis (NEPSE-Unique Metric)

When a small number of brokers handle most of a stock's volume — Example: If 2 brokers account for 60%+ of daily trades in one stock — Can be a sign of big money moves or manipulative coordination. High concentration = price moves may not reflect real demand.

**Quantitative Rule:** Avoid stocks where top 2 brokers > 50% of trades.

### 2.3 Volume Profile in Liquid Sectors

In NEPSE, the Volume Profile is particularly effective in liquid sectors like banking, hydropower, and insurance, where institutional traders dominate. By analyzing where high volume is clustered, traders can identify accumulation ranges before major rallies or distribution areas before declines.

### 2.4 Candlestick & Market Phase Recognition

In NEPSE, long lower wicks often mark accumulation, while long upper wicks show distribution. Chart patterns like Double Tops, Head and Shoulders, and Triangle Breakouts form the backbone of Technical Analysis in NEPSE. They help traders anticipate reversals, continuations, and breakout zones before the crowd reacts.

### 2.5 Sector-Specific Patterns

- Strong dividend announcements often push bank stocks to daily upper circuits.
- Microfinance rallies: Often broker-driven, later trapped retail.
- Hydropower IPO hype: Few brokers concentrated buying → sharp corrections.
- Insurance sector: Dividend rumors inflated prices with broker dominance.

### 2.6 Political Event Override

Political developments can override technical analysis in minutes. The September 2025 events showed us that within two minutes of opening after the protests, the NEPSE index dropped 4 percent.

---

## Atom 3: Pure Global Forecasting Models (Defined in Vacuum)

### Model 1: LSTM (Long Short-Term Memory) Networks

Recurrent neural networks (RNN) are designed to perform sequential tasks. The RNN architecture consists of loops, allowing relevant information to persist over time. Information is being passed from one timestep to the next internally within the network. Therefore, the RNN is more suitable for sequential data modeling and time series applications such as stock market predictions.

An LSTM module (or cell) has 5 essential components, which allow it to model both long-term and short-term data:

- **Cell state (ct)** — Represents the internal memory of the cell, which stores both short-term memory and long-term memories.
- **Hidden state (ht)** — This is output state information calculated w.r.t. current input, previous hidden state, and current cell input, which you eventually use to predict the future stock market prices. Additionally, the hidden state can decide to only retrieve short- or long-term memories or both types of memory stored in the cell state to make the next prediction.

**Key Limitation:** The LSTM framework has certain limitations. It struggles to adapt to sudden and drastic market changes caused by unforeseen macroeconomic or geopolitical events.

### Model 2: Sentiment-Augmented Deep Learning

To enhance the model's predictive performance with qualitative market signals, sentiment analysis is integrated into the input pipeline. Financial news articles and headlines are sourced from reputed platforms such as Bloomberg and Reuters.

### Model 3: VMD-LSTM Hybrid (Signal Decomposition + Deep Learning)

This model proposes a novel stock price forecasting approach — the Variational Mode Decomposition–Triangulated Maximally Filtered Graph–Long Short-Term Memory (VMD–TMFG–LSTM) combined model — aimed at improving prediction accuracy, stability, and computational efficiency.

The proposed model first employs Variational Mode Decomposition (VMD) to decompose the stock price time series into multiple smooth intrinsic mode functions (IMFs), reducing data complexity and mitigating noise interference. Subsequently, the TMFG algorithm is utilized for feature selection, simplifying the input data and accelerating the iterative convergence process.

### Model 4: Technical Indicator Ensemble (RSI, MACD, Bollinger Bands)

RSI is a recognized technical indicator in stock price prediction. It is an oscillating indicator constructed to measure the stock's momentum to provide bullish and bearish price signals. Investors use this indicator to identify security overbought or oversold. RSI may be helpful to determine potential entry and exit trading signals as well.

### Model 5: Multi-Model Comparison (DNN/RNN/LSTM/Bi-LSTM/GRU/CNN)

This approach extensively explores the ability of deep learning models to predict out-of-sample the daily prices of global stock indices over a long term, up to a year. The performance of six models — DNN, RNN, LSTM, Bi-LSTM, GRU, and CNN — are compared using Root Mean Squared Error (RMSE) and Mean Absolute Percentage Error (MAPE).

**Critical Global Caveat:** LSTM models cannot guarantee accurate predictions because the stock market is highly volatile and influenced by factors beyond historical data. LSTMs can help identify trends and patterns but should not be solely relied upon for financial decisions.

---

## Atom 4: Fundamental-Technical Intersection

### 4.1 EPS and P/E as Primary Drivers in NEPSE

Earning price per share and P/E Ratio has positive and significant impact on MPS (Market Price per Share). The empirical results showed that there was a positive correlation between independent variables (DPS, EPS, size, P/E ratio, and book value per share) and dependent variable (market price of share).

### 4.2 P/E Ratio Sectoral Benchmarks

In NEPSE, P/E ratios vary widely across sectors. Commercial banks often trade at moderate P/Es (10–20 range) due to stable earnings, while insurance and hydropower stocks may have higher or more volatile P/Es due to growth expectations or inconsistent profits.

### 4.3 PEG Ratio for Growth-Adjusted Valuation

The PEG Ratio helps investors balance growth potential with valuation — preventing them from overpaying for fast-growing companies or ignoring steady, undervalued firms. The PEG Ratio is especially valuable in the fundamental analysis of long-term investments, as it aligns valuation with growth sustainability.

For Nepali investors, understanding PEG helps distinguish between "cheap" stocks that deserve to be cheap and genuine opportunities where future growth isn't yet priced in.

### 4.4 Sector-Specific Growth Patterns

In NEPSE, banking, insurance, hydropower, and manufacturing companies each show different growth patterns. For example, banks may have stable but moderate growth, while hydropower companies may have fluctuating profits during early project phases and rising earnings post-generation.

### 4.5 Dividend Signaling in Nepal

The Nepali market is also influenced by factors such as dividend expectations, government policies, and liquidity conditions, all of which can affect how investors value stocks. For long-term investors, the PE ratio works best when combined with other tools like EPS trends, dividend payout history, and sector analysis.

### 4.6 The Pre-Breakout Fundamental-Technical Convergence Pattern

Based on the empirical evidence from NEPSE research, the **pre-breakout pattern** in NEPSE stocks typically manifests as:

| Phase | Fundamental Signal | Technical Signal | Time Horizon |
| --- | --- | --- | --- |
| **Phase 1: Stealth** | Rising EPS (2+ consecutive quarters) | Price base forming, low volume | 2–4 months |
| **Phase 2: Awareness** | Positive quarterly report, dividend announcement | Volume uptick, breakout from base | 1–2 months |
| **Phase 3: Mania** | P/E expansion beyond sector norm | Upper circuits, extreme volume | 2–6 weeks |
| **Phase 4: Blow-off** | P/E > 2× sector average, PEG > 2.0 | Topping patterns, broker concentration | 1–3 weeks |

---

## Atom 5: The "Noise" Factor — Failed Indicators in NEPSE

### 5.1 Volume Without Broker Context = Noise

These operators trade among themselves, inflating volume. Once the volume reaches critical mass, retail psychology does the rest. People think, "Volume is strong — someone knows something." They're entering at the end of a loop, not the beginning of a trend.

### 5.2 Social Media "Breakout" Signals

Telegram/Facebook/Insta/YouTube/TikTok channels echo: "Target 15%, breakout confirmed." You panic. You chase. And you buy… someone else's exit.

### 5.3 RSI / Overbought-Oversold in Circuit-Limited Market

In a market with ±10% daily limits, RSI is **structurally distorted**. A stock hitting upper circuit for 3 consecutive days will show RSI > 90, but this is merely an artifact of the circuit breaker preventing natural price discovery. The "overbought" signal is **meaningless** when supply-demand imbalance is artificially capped.

### 5.4 Low-P/E "Value Trap" in Nepal

While stocks with lower P/E ratios may present opportunities for value-oriented investors seeking undervalued assets, their salability in the Nepalese stock market can be limited due to perceived risks, market sentiment, liquidity concerns, and investor behavior influenced by regulatory factors and market dynamics. Smaller companies or those with lower P/E ratios may lack visibility or analyst coverage in the Nepalese market. This can result in reduced investor interest and reluctance to invest in stocks that are not widely researched or recommended by financial experts.

### 5.5 Political Event Blindness of ALL Technical Models

The Nepal Stock Exchange fell sharply, dropping 160.33 points with trading halted after the index tumbled six percent to close at 2,511.91 points. Three consecutive negative circuit breakers were triggered by post-protest selloffs, with the first circuit breaker activated just two minutes after the market opened. No technical indicator — moving averages, RSI, MACD, Bollinger Bands — can predict a political crisis. Every model is **blind** to this risk class.

### 5.6 DPS (Dividend Per Share) as Price Predictor

There is negative and insignificant impact of DPS and BVPS on the market price of share. Despite the Nepali market's obsession with dividends, empirical research shows DPS alone is a statistically **unreliable** price predictor.

---

# Phase 2: Synthesis & Contraction

---

## Section A: Adapting Global Models to NEPSE (Atom 1 × Atom 3)

### A.1 LSTM Adaptation for NEPSE — Mandatory Modifications

| Global LSTM Default | NEPSE-Required Modification | Rationale |
| --- | --- | --- |
| **Training data:** Years of continuous 6.5-hr/day trading (e.g., NYSE) | Must train on **3-hr/day windows only**; exclude non-trading gaps | NEPSE has one of the shortest trading windows among major stock exchanges. Treating overnight gaps as continuous data introduces catastrophic noise. |
| **Lookback window:** 60 days typical | Reduce to **20–30 trading days** maximum | With only ~220 trading days/year and frequent holiday closures, 60-day lookbacks span actual months of real time and lose temporal coherence. |
| **Feature set:** OHLCV + macroeconomic data from Bloomberg/Reuters | Add **broker concentration index** as a mandatory input feature; replace Bloomberg sentiment with local Nepali news NLP pipeline | In NEPSE, where retail power dominates, brokers play a huge role in shaping price action. No global data source covers NEPSE sentiment. |
| **Prediction horizon:** Next-day or intraday | **3–5 day horizon minimum** | T+2 remains the current standard. Sub-daily prediction is meaningless when execution settlement is T+2 and liquidity is compressed into 3 hours. |
| **Data normalization:** Min-Max on continuous series | Must implement **circuit-breaker-aware normalization**: clip ±10% on individual stocks, ±6% on index | The ±10% daily cap creates artificial price ceilings/floors that distort standard normalization. |
| **Loss function:** Standard MSE | Use **Huber Loss or quantile regression** | It struggles to adapt to sudden and drastic market changes. Huber loss reduces sensitivity to NEPSE's frequent political-event outliers. |
| **Retraining:** Weekly or monthly | **Retrain after every circuit-breaker event and every NRB monetary policy announcement** | The NRB Policy Review determines the direction of Nepal's banking sector by influencing liquidity, interest rates, and lending discipline. |

### A.2 Sentiment Analysis Adaptation

In global markets, sentiment is scraped from Twitter/X, Reddit, Bloomberg. For NEPSE:

- **Primary sentiment sources:** ShareSansar comments, MeroLagani forums, Nepali-language Facebook investor groups, broker-level floorsheet data
- **Language processing:** Must support **Nepali script (Devanagari)** NLP tokenization — no English-only model will work
- **Sentiment proxy:** Track the **frequency and distribution of IPO applications** as a crowd-sentiment indicator — IPO oversubscription ratios serve as a quantifiable fear/greed gauge unique to Nepal

### A.3 VMD-LSTM Hybrid Adaptation

The VMD signal decomposition approach is **well-suited** for NEPSE because the proposed model first employs VMD to decompose the stock price time series into multiple smooth intrinsic mode functions (IMFs), reducing data complexity and mitigating noise interference.

**NEPSE-specific modification:** Set the number of VMD modes to **K=4 or K=5** (rather than K=8 used in deep markets). The lower data density of NEPSE (~3hrs/day × ~220 days/year) cannot support higher-order decomposition without overfitting. Additionally, one mode should be **explicitly designated** to capture circuit-breaker-induced price truncation effects.

---

## Section B: The NEPSE Growth Stock Checklist (Atom 2 × Atom 4)

### ✅ Mandatory Screening Criteria (All Must Pass)

| # | Criterion | Quantitative Threshold | Source Atom |
| --- | --- | --- | --- |
| 1 | **EPS Growth** | ≥ 10% YoY for minimum 2 consecutive quarters | Atom 4 |
| 2 | **P/E Ratio** | Within or below sector median (Banks: 10–20; Hydro: examine PEG) | Atom 4 |
| 3 | **PEG Ratio** | < 1.5 (ideally < 1.0 signals undervalued growth) | Atom 4 |
| 4 | **Broker Distribution** | Top 2 brokers must be < 50% of recent 5-day volume | Atom 2 |
| 5 | **Volume Trend** | Rising 10-day average volume vs. 30-day, with **broad** broker participation | Atom 2 |
| 6 | **Price Base** | Stock must have formed a ≥ 30-day consolidation base (range < 15%) | Atom 2 |
| 7 | **No Political Event Proximity** | No major elections, budget announcements, or NRB policy reviews within 2 weeks | Atom 5 |

### ✅ Confirmation Signals (≥ 3 of 5 Must Trigger)

| # | Signal | What to Look For |
| --- | --- | --- |
| C1 | **Breakout with Volume** | Price breaks above 30-day consolidation ceiling on volume ≥ 1.5× 20-day average |
| C2 | **Sector Momentum** | At least 3 other stocks in the same NEPSE sub-index are also showing positive momentum |
| C3 | **Dividend/Bonus Catalyst** | Upcoming book closure date within 30–60 days with confirmed dividend ≥ prior year |
| C4 | **Candlestick Confirmation** | Bullish engulfing or long lower-wick rejection at support on the breakout candle |
| C5 | **Volume Profile POC Breakout** | Price breaks above the Point of Control from the prior 90-day Volume Profile |

### ✅ Exit / Risk Management Rules

| Trigger | Action |
| --- | --- |
| Stock hits upper circuit on day 1, then fails to hit upper circuit on day 2 with declining volume | **Reduce position by 50%** |
| Broker concentration spikes above 60% in top 2 brokers | **Full exit** |
| P/E exceeds 2× sector median | **Begin systematic exit** |
| Political unrest / market closure anticipated | **Move to 100% cash before holiday/closure** |
| NRB monetary policy announcement in < 5 trading days | **No new positions** |

---

## Section C: Strict Warning Guide — The Noise Compendium (Atom 5)

### 🚫 Indicators That Fail or Mislead in NEPSE

| Indicator | Global Reliability | NEPSE Reliability | Why It Fails |
| --- | --- | --- | --- |
| **RSI (14-period)** | Moderate | **LOW** | ±10% circuit breakers artificially cap price discovery. RSI will always show extreme readings during multi-day circuit hits without reflecting true supply-demand. |
| **MACD Crossover** | Moderate | **LOW-MODERATE** | The 3-hour trading window compresses all price action. Standard 12-26-9 MACD parameters calibrated for 6.5-hr markets generate excessive lag and false signals. Requires re-parameterization to approximately 6-13-5. |
| **Bollinger Band (20,2)** | High in liquid markets | **LOW** | The ±10% daily limit means price literally cannot exceed certain boundaries. Bollinger "breakouts" above the band are frequently just circuit-limit artifacts, not volatility signals. |
| **Raw Volume Spikes** | Moderate-High | **DANGEROUS** | Must always be cross-referenced with broker concentration data. |
| **Low P/E "Value" Screen** | High in developed markets | **TRAP** | Smaller companies or those with lower P/E ratios may lack visibility or analyst coverage in the Nepalese market. A cheap stock with no liquidity is not an investment — it is a prison. |
| **DPS (Dividend Per Share) alone** | Moderate | **UNRELIABLE** | There is negative and insignificant impact of DPS and BVPS on the market price of share. |
| **Any pure technical signal during political events** | N/A | **ZERO** | All technical models are blind to political black swans. |

### 🔴 The Five Cardinal Rules for NEPSE Quantitative Analysis

1. **Never trust volume without broker data.** Broker concentration is one of the most powerful signals in NEPSE.

2. **Never apply global model parameters without recalibration.** A 3-hour market with ±10% price limits and T+2 settlement is structurally incompatible with NYSE/NASDAQ-calibrated hyperparameters.

3. **Always maintain a political risk overlay.** No quantitative model — LSTM, ARIMA, GARCH, or otherwise — can predict Nepali political events. Maintain a discrete binary "political risk flag" that overrides all model outputs.

4. **Treat circuit breaker events as data censoring, not data points.** When a stock hits a ±10% circuit, the "true" equilibrium price may be far beyond that boundary. Standard statistical models that treat the circuit-limited price as the "real" close will systematically underestimate volatility and misprice risk.

5. **Fundamental metrics > Technical indicators for growth forecasting.** Earning price per share and P/E Ratio has positive and significant impact on MPS. In a market with this much noise, mean-reverting to fundamentals is the only statistically defensible long-term strategy.

---

## Final Synthesis: The NEPSE Growth Forecasting Framework