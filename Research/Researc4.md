# Quantitative Analysis: Stock-Based Business Growth Forecasting for NEPSE

---

## Phase 1: Independent Atomic Analysis

---

### Atom 1: The NEPSE Baseline Reality

**Structural Constraints of Nepal Stock Exchange:**

NEPSE operates as **Nepal's sole stock exchange**, creating a concentrated, insular market environment with distinct characteristics:

| Constraint | Specification |
|------------|---------------|
| **Liquidity** | Lower trading volumes; limited market depth; high bid-ask spreads in mid/small-cap stocks |
| **Investor Composition** | Retail-dominated; post-COVID surge in retail participation with limited institutional buffering |
| **Regulatory Framework** | SEBON (Securities Board of Nepal) oversight; CDSC clearing mechanisms |
| **Circuit Breakers** | Daily price fluctuation limits constraining natural price discovery |
| **Trading Days** | 5 days/week; seasonal and autoregressive components identified at 5-day and 10-day intervals |
| **Index Construction** | Weighted Market Capitalization method; dominant stocks disproportionately influence index movement |

**Critical Finding:** Research confirms NEPSE exhibits **volatility clustering**, **time-varying conditional heteroskedasticity**, and **leptokurtic return distributions**—stylized characteristics requiring specialized volatility models.

---

### Atom 2: Pure Local Price Action

**NEPSE-Specific Price-Volume Correlations:**

**Correlated Technical Metrics:**
- **MACD (Moving Average Convergence Divergence)**: Measures strength and trend detection; calculated as 26-day EMA minus 12-day EMA
- **RSI (Relative Strength Index)**: Momentum indicator identifying overbought/oversold conditions
- **MFI (Money Flow Index)**: Detects money flow strength and short-term price movement direction
- **ATR (Average True Range)**: Volatility indicator for setting stop-losses based on actual price movement

**Volume Anomalies:**
Volume Profile indicators confirm **strength behind price movements**, identifying institutional participation—critical in a retail-dominated market.

**Historical Pattern Recognition:**
- EMA provides **dynamic support/resistance** identification
- SMA crossovers (50-day/200-day) identify **long-term directional shifts**
- Stochastic Oscillator effective for **range-bound market conditions** prevalent in NEPSE

---

### Atom 3: Pure Global Forecasting Models (Vacuum Context)

**Advanced Quantitative Forecasting Techniques:**

| Model | Mechanism | Primary Application |
|-------|-----------|---------------------|
| **LSTM (Long Short-Term Memory)** | Recurrent neural network handling sequential time-series data; captures long-term dependencies through memory cells and gates | Non-linear stock price prediction with historical, sentiment, and technical feature inputs |
| **ARIMA (Autoregressive Integrated Moving Average)** | Univariate time-series model capturing autoregressive, differencing, and moving average components | Short-to-medium term price forecasting; NYSE/NSE validated |
| **GARCH/EGARCH** | Models conditional heteroskedasticity; EGARCH captures asymmetric volatility (positive/negative shocks) | Volatility forecasting; risk management |
| **Algorithmic Sentiment Analysis** | NLP-based scoring of financial news to quantify market sentiment | Integrating qualitative news data into quantitative predictions |
| **SARIMA (Seasonal ARIMA)** | ARIMA extension incorporating seasonal components at fixed intervals | Markets with cyclical patterns |

---

### Atom 4: Fundamental-Technical Intersection

**Pre-Breakout Pattern Manifestation:**

**Fundamental Growth Metrics:**
- **EPS Growth**: Earnings trajectory reflecting operational performance
- **Dividend Consistency**: Cash flow stability indicator
- **P/E Ratio**: Valuation relative to earnings; expansion signals growth expectations
- **Financial Health Metrics**: Profit-to-equity ratio, non-performing loan ratios (banking sector)

**Technical Manifestation Sequence:**

1. **Volume Accumulation Phase**: Increased turnover preceding price movement
2. **Moving Average Convergence**: EMA/SMA alignment signaling momentum building
3. **Volatility Compression**: ATR contraction before breakout expansion
4. **Momentum Divergence**: RSI/MACD diverging from price, signaling underlying strength shift

---

### Atom 5: The "Noise" Factor

**Failed/Unreliable Indicators in NEPSE:**

| Indicator | Failure Mode | Evidence |
|-----------|--------------|----------|
| **RSI** | **Generates negative returns** in NEPSE backtesting | Overbought/oversold signals misaligned with actual reversals |
| **Bollinger Bands** | **Fails to produce reliable signals** | Volatility-based bands invalidated by circuit breaker constraints |
| **Simple Moving Average (certain configurations)** | Produces false signals | Lagging nature amplified in low-liquidity conditions |

---

## Phase 2: Synthesis & Contraction

---

### A. Global Model Adaptation for NEPSE Constraints

**LSTM Modification Protocol:**

| Global Parameter | NEPSE Adaptation | Rationale |
|------------------|------------------|-----------|
| Training window | Extend to capture 5-day and 10-day seasonal cycles | AR(1), SAR(5), SAR(10) components identified |
| Feature set | **Mandatory inclusion**: OHLC, Volume, MACD, ATR, MFI, Sentiment Score | RSI excluded due to negative return generation |
| Dropout layers | Increase regularization | Combat overfitting on smaller dataset |
| Prediction horizon | Limit to short-term (1-5 days) | ARIMA validation shows short-term strength |

**ARIMA/GARCH Adaptation:**

The optimal univariate model for NEPSE is **SARIMA with EGARCH**:
- **Predictors**: AR(1), MA(1), SAR(5), SAR(10), SMA(7), SMA(15)
- **Volatility capture**: EGARCH handles asymmetric positive/negative shocks
- **Validation metrics**: RMSE, MAPE confirmed minimal in static forecasting

---

### B. NEPSE Growth Checklist (Atoms 2 + 4 Combined)

**Pre-Breakout Screening Criteria:**

**Tier 1: Fundamental Filters**
- [ ] EPS growth positive for ≥2 consecutive quarters
- [ ] Dividend announcement consistency (historical pattern)
- [ ] P/E ratio below sector average with improving trajectory
- [ ] Strong financial health (banking: low NPL; others: positive cash flow)

**Tier 2: Technical Confirmation**
- [ ] **Volume surge**: Turnover exceeds 20-day average by >50%
- [ ] **MACD crossover**: Signal line crossed above zero
- [ ] **ATR compression**: Volatility narrowing (pre-expansion phase)
- [ ] **MFI reading**: Between 40-60 (accumulation zone, not overbought)
- [ ] **EMA alignment**: 10-day > 20-day > 50-day (bullish stacking)

**Tier 3: NEPSE-Specific Validation**
- [ ] Correlation with NEPSE index positive (weighted MC sensitivity check)
- [ ] No pending regulatory announcements from SEBON
- [ ] Adequate liquidity (minimum 5-day average volume threshold)

---

### C. Strict Warning Guide (Atom 5 Application)

**Indicators to Avoid or Heavily Discount in NEPSE:**

| Indicator | Warning Level | Action |
|-----------|---------------|--------|
| **RSI (standard 14-period)** | 🔴 **Critical** | Do not use for entry/exit signals; negative returns documented |
| **Bollinger Bands** | 🔴 **Critical** | Circuit breakers invalidate volatility assumptions |
| **Pure Moving Average Crossovers** | 🟡 **Moderate** | Use only with volume confirmation; high false signal rate |
| **Single-indicator strategies** | 🔴 **Critical** | Research confirms combined approaches mandatory |

---

### Final Research Protocol for NEPSE Forecasters

1. **Model Selection**: SARIMA + EGARCH for volatility; LSTM for multi-feature prediction
2. **Feature Engineering**: Exclude RSI; include MACD, ATR, MFI, sentiment scores
3. **Validation**: Static forecasting before dynamic; RMSE/MAPE thresholds mandatory
4. **Temporal Calibration**: Account for 5-day weekly cycles and 10-day seasonal effects
5. **Risk Framework**: Circuit breaker awareness; liquidity filters; regulatory calendar monitoring