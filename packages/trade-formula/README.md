# Trade Formulations

This document defines the complete formulation used by the Pattern Analyzer and Trade Executor to evaluate patterns, compute stop loss, take profit, and determine position sizing. It serves as the authoritative reference for both implementation and AI guidance.

---

## 0. Base Field Definitions

Every candle has 4 raw OHLC fields from the exchange. All derived fields used throughout this document are computed from these.

### Raw Fields (from exchange)

| Field | Description |
|---|---|
| `open` | Price at candle open |
| `high` | Highest price during candle |
| `low` | Lowest price during candle |
| `close` | Price at candle close |

### Derived Fields

| Field | Formula | Notes |
|---|---|---|
| `pct_change` | `(close - open) / open × 100` | Signed percentage move. Positive = bullish candle, negative = bearish candle. |
| `body_ratio` | `abs(close - open) / (high - low)` | Proportion of the candle range occupied by the body. Range: 0 to 1. A value of 1 means no wicks. If `high == low` (zero-range candle), `body_ratio = 0`. |
| `candle_range` | `(high - low) / open × 100` | Total candle span as a percentage of open price. Always ≥ 0. Direction-agnostic. |

### Key Conventions

- **`sl_pct` is always a positive magnitude.** It represents the distance from entry as a percentage, never a signed value. The direction (add or subtract from entry) is determined by the trade side (long/short) in Section 7.
- **Trade direction** is determined by the Postgres probability: if the up probability ≥ threshold → **LONG**; if the down probability ≥ threshold → **SHORT**. The higher side wins. If neither side meets the 68% minimum, no trade is taken.
- **All percentage values in formulas** (pct_change, candle_range, sl_pct) are expressed as raw percentages (e.g. 1.5 means 1.5%), not decimals (not 0.015).

---

## 1. Candle Classification

Each closed candle is classified into one of 7 labels using `pct_change` and `body_ratio`:

```
function classifyCandle(pct_change, body_ratio):
  if pct_change >  1.5 && body_ratio >= 0.5 → 'up_strong'
  if pct_change >  0.5 && body_ratio >= 0.4 → 'up_medium'
  if pct_change >  0.1 && body_ratio >= 0.3 → 'up_weak'
  if pct_change < -1.5 && body_ratio >= 0.5 → 'down_strong'
  if pct_change < -0.5 && body_ratio >= 0.4 → 'down_medium'
  if pct_change < -0.1 && body_ratio >= 0.3 → 'down_weak'
  else → 'flat' (excluded from pattern matching)
```

- 6 valid labels × 3 candle sequence = **216 possible patterns**
- Patterns containing `flat` in any position are ignored entirely

---

## 2. Pattern Lookup & Probability Check

The 3-candle sequence `(c1, c2, c3)` ordered oldest → newest is matched against the Postgres materialized table.

### Statistical Confidence
With 12 months of 5-minute closed klines per instrument:
```
candles per day  = (60 / 5) × 24 = 288
candles per year = 288 × 365     = 105,120
avg per pattern  = 105,120 / 216 ≈ 487 occurrences
```
Sample size is statistically sufficient. No minimum occurrence threshold is required.

### Probability Tiers

| Tier | Probability Range | Conviction |
|---|---|---|
| **Skip** | < 68% | Too uncertain — no trade |
| **Moderate** | 68% – 74% | Moderate conviction |
| **High** | 75% – 79% | High conviction |
| **Dominant** | ≥ 80% | Overwhelming — Postgres dominates |

### Conflict Detection

A conflict occurs when the Postgres predicted direction contradicts the structural direction implied by the formulation route (see Section 4).

| Postgres says | Formulation route implies | Conflict? |
|---|---|---|
| down 70% | Pullback (uptrend continuation) | ✅ Yes |
| up 72% | Trend (uptrend) | ❌ No — aligned |
| down 75% | Reversal (from up to down) | ❌ No — aligned |
| up 69% | Pullback (downtrend c1, up c3) | ✅ Yes |

### Trade Decision Logic

```
probability < 68%               → skip (too uncertain)
probability ≥ 80%               → trade (Postgres dominates, conflict overridden)
68% – 79% AND no conflict       → trade
68% – 79% AND conflict          → skip, log as CONFLICTED for AI learning
```

Conflicted patterns are never silently dropped — they are always recorded with full pre-computation values, the Postgres probability, and the detected conflict reason so the AI can learn from them over time.

---

## 3. Pre-computation Layer (Sub-formulas)

Computed once from `(c1, c2, c3)` before any routing or group formula is applied. All values are stored alongside the trade for AI learning regardless of which route is taken.

| Name | Formula | Notes |
|---|---|---|
| **Momentum Score** | `pct_change × body_ratio` (per candle) | Filters noise — only counts moves backed by body strength |
| **Sequence Slope** | `c3.pct_change - c1.pct_change` | Positive = accelerating, negative = fading, sign flip = reversal |
| **Wick Ratio** | `1 - body_ratio` (per candle) | High value = more rejection / noisy price action |
| **Volatility Proxy** | `avg(c1.candle_range, c2.candle_range, c3.candle_range)` | Direction-agnostic noise level of the 3-candle window |
| **Directional Agreement** | `sign(c1) + sign(c2) + sign(c3)` | `up_*` = +1, `down_*` = -1 |

### Directional Agreement — Possible Scores

With 3 candles and binary signs (`+1` or `-1`, flat excluded), only `±1` and `±3` are mathematically possible. Scores of `0` and `±2` cannot occur with an odd number of binary values.

| Score | Meaning |
|---|---|
| `+3` or `-3` | All 3 candles same direction |
| `+1` or `-1` | Two candles agree, one opposes |

---

## 4. Route Discrimination

Three routes are possible. The route determines which group formulas are applied and how the SL percentile is selected.

```
directional_agreement = ±3
  → Trend

directional_agreement = ±1
  AND sign(c1) ≠ sign(c3)
  AND abs(c3.momentum_score) > abs(c1.momentum_score)
  → Reversal

everything else (±1)
  → Pullback
```

| Route | Condition |
|---|---|
| **Trend** | `directional_agreement = ±3` |
| **Reversal** | `directional_agreement = ±1` AND `sign(c1) ≠ sign(c3)` AND `abs(c3.momentum_score) > abs(c1.momentum_score)` |
| **Pullback** | `directional_agreement = ±1` AND (`sign(c1) = sign(c3)` OR `abs(c3.momentum_score) ≤ abs(c1.momentum_score)`) |

**Reversal outperformance check rationale:** Using `abs(momentum_score)` comparison instead of raw price levels ensures the outperformance check is normalized and label-consistent — the same label combination classifies identically regardless of absolute price.

---

## 5. Group Formulas

All formulas in the matched group are always computed. Ineligible formulas are stored for AI learning but excluded from percentile ranking.

### 🟢 Trend — `directional_agreement = ±3`

| # | Name | Formula | SL Eligible |
|---|---|---|---|
| T1 | Simple Average | `avg(c1.pct_change, c2.pct_change, c3.pct_change)` | ✅ |
| T2 | Weighted Average | `c1.pct_change × 0.2 + c2.pct_change × 0.3 + c3.pct_change × 0.5` | ✅ |
| T3 | Conviction-Weighted | `avg(c1.momentum_score, c2.momentum_score, c3.momentum_score)` | ✅ |
| T4 | Range Ceiling | `max(c1.candle_range, c2.candle_range, c3.candle_range)` | ✅ |
| T5 | Trend Acceleration | `sequence_slope` | ❌ — directional signal only, not a magnitude |

**Note on T1, T2, T3:** These formulas can produce negative values in a down-trend (all 3 candles bearish, `directional_agreement = -3`). Since `sl_pct` must be a positive magnitude, always take `abs()` of the output before using it as `sl_pct`.

### 🔄 Reversal — `directional_agreement = ±1` AND `sign(c1) ≠ sign(c3)` AND `abs(c3.momentum_score) > abs(c1.momentum_score)`

| # | Name | Formula | SL Eligible |
|---|---|---|---|
| R1 | Pivot Range | `c2.candle_range` | ✅ |
| R2 | Full Swing | `abs(c1.pct_change) + abs(c3.pct_change)` | ✅ |
| R3 | Reversal Strength | `c3.pct_change × c3.body_ratio` | ❌ — can be negative, directional signal only |
| R4 | Rejection Magnitude | `max(c1.candle_range, c3.candle_range)` | ✅ |
| R5 | Body Conflict | `abs(c1.body_ratio - c3.body_ratio) × volatility_proxy` | ✅ |

### 🌀 Pullback — `directional_agreement = ±1` AND (`sign(c1) = sign(c3)` OR `abs(c3.momentum_score) ≤ abs(c1.momentum_score)`)

| # | Name | Formula | SL Eligible |
|---|---|---|---|
| P1 | Max Range | `max(c1.candle_range, c2.candle_range, c3.candle_range)` | ✅ |
| P2 | Absolute Volatility | `avg(abs(c1.pct_change), abs(c2.pct_change), abs(c3.pct_change))` | ✅ |
| P3 | Chaos Score | `stdev(c1.pct_change, c2.pct_change, c3.pct_change)` | ✅ |
| P4 | Wick Dominance | `volatility_proxy × (1 - avg(c1.body_ratio, c2.body_ratio, c3.body_ratio))` | ✅ |
| P5 | Total Exposure | `c1.candle_range + c2.candle_range + c3.candle_range` | ✅ |

### Edge Case: Tied Formula Outputs

If two or more eligible formulas produce the same value, the percentile selection still applies to the sorted list. Duplicate values occupy consecutive positions and the positional pick remains deterministic. No special tie-breaking is needed — the sort is stable and position-based.

---

## 6. Percentile Banding — SL Formula Selection

All eligible formulas are computed, sorted ascending, then one is selected by percentile position based on route and conviction tier.

**Core principle:**
- Higher conviction → tighter SL → lower percentile
- Lower conviction → wider SL → higher percentile
- Reversal always picks one band wider than Trend at every tier — inherently more unpredictable
- Pullback sits between Trend and Reversal

### 🟢 Trend (4 eligible: T1, T2, T3, T4)

| Conviction Tier | Percentile | Picks | Rationale |
|---|---|---|---|
| Moderate (68–74%) | 75th | 3rd of 4 | Clear trend but moderate confidence — give it room |
| High (75–79%) | 50th | 2nd of 4 | Good confidence — middle ground |
| Dominant (≥80%) | 25th | 1st of 4 (tightest) | Strong certainty — tight SL maximizes reward |

### 🔄 Reversal (4 eligible: R1, R2, R4, R5)

| Conviction Tier | Percentile | Picks | Rationale |
|---|---|---|---|
| Moderate (68–74%) | 100th | 4th of 4 (widest) | Reversal is risky + moderate conviction = maximum protection |
| High (75–79%) | 75th | 3rd of 4 | Better confidence but reversal still volatile — stay wide |
| Dominant (≥80%) | 50th | 2nd of 4 | Strong signal — can afford middle ground |

### 🌀 Pullback (5 eligible: P1, P2, P3, P4, P5)

| Conviction Tier | Percentile | Picks | Rationale |
|---|---|---|---|
| Moderate (68–74%) | 80th | 4th of 5 | Pullback direction uncertain — lean wide |
| High (75–79%) | 60th | 3rd of 5 | Middle ground — structure partially known |
| Dominant (≥80%) | 40th | 2nd of 5 | Postgres strongly confident — tighten up |

### Summary Matrix

| Route | Moderate | High | Dominant |
|---|---|---|---|
| **Trend** | 75th (3rd/4) | 50th (2nd/4) | 25th (1st/4) |
| **Reversal** | 100th (4th/4) | 75th (3rd/4) | 50th (2nd/4) |
| **Pullback** | 80th (4th/5) | 60th (3rd/5) | 40th (2nd/5) |

---

## 7. Stop Loss Price Level

The selected formula outputs a **percentage magnitude**. The Trade Executor converts it to an actual price level:

```
Long  trade: SL price = entry_price - (entry_price × sl_pct)
Short trade: SL price = entry_price + (entry_price × sl_pct)
```

---

## 8. Take Profit Price Level

TP uses a static multiplier from user settings applied against the SL distance:

```
Long  trade: TP price = entry_price + (sl_distance × tp_multiplier)
Short trade: TP price = entry_price - (sl_distance × tp_multiplier)

where:
  sl_distance  = entry_price × sl_pct
  tp_multiplier = user setting (e.g. 2 = 2:1 reward-to-risk)
```

**Example:** entry = $100, SL = 1.5%, TP multiplier = 2
```
sl_distance = $100 × 1.5% = $1.50
SL long     = $100 - $1.50 = $98.50
TP long     = $100 + ($1.50 × 2) = $103.00
```

---

## 9. Position Sizing & Leverage

### Core Formula

```
dollar_risk  = account_size × risk_pct          (from user settings)
raw_leverage = risk_pct / sl_pct
leverage     = floor(raw_leverage)              (must be integer — floor, not round)
leverage     = max(1, min(leverage, 20))        (min 1x, max 20x)
```

### Why floor and not round?
Rounding up overshoots the dollar risk target. Flooring keeps actual risk slightly below the user's setting, which is always safe.

**Example:** risk = 3%, SL = 0.46%, account = $1,000
```
raw_leverage = 3% / 0.46% = 6.52x
floor        = 6x
dollar_risk  = ($1,000 × 6) × 0.46% = $27.60  ✅ slightly under $30
```

### Leverage Cap — 20x Maximum
Binance requires a minimum margin of 5% in the account:
```
min_margin = 5%  →  max_leverage = 1 / 5% = 20x
```
If `raw_leverage > 20`, cap at 20x. Dollar risk will be less than target — this is acceptable.

### Leverage Floor — 1x Minimum
When `sl_pct > risk_pct`, raw leverage falls below 1x. The minimum is always 1x. In this case dollar risk will slightly exceed the user's risk setting. This is unavoidable at minimum leverage and is flagged as `WIDE_SL`.

```
if sl_pct > risk_pct → leverage = 1x, log as WIDE_SL
```

### Simulated Cases (account = $1,000, risk = 3%, dollar_risk = $30)

| Case | Route | Tier | SL% | Raw Leverage | Final Leverage | Dollar Risk | Flag |
|---|---|---|---|---|---|---|---|
| T-A | Trend | Dominant | 0.46% | 6.52x | **6x** | $27.60 | — |
| T-B | Trend | High | 0.90% | 3.33x | **3x** | $27.00 | — |
| T-C | Trend | Moderate | 2.80% | 1.07x | **1x** | $28.00 | — |
| T-D | Trend | Dominant | 0.05% | 60x | **20x** (cap) | $10.00 | — |
| R-A | Reversal | Dominant | 3.20% | 0.94x | **1x** (floor) | $32.00 | WIDE_SL |
| R-B | Reversal | Moderate | 2.90% | 1.03x | **1x** | $29.00 | — |
| P-A | Pullback | Dominant | 0.88% | 3.41x | **3x** | $26.40 | — |
| P-B | Pullback | Moderate | 3.00% | 1.00x | **1x** | $30.00 | — |

---

## 10. What Gets Stored Per Trade

Every trade — executed or skipped — is recorded with the following for AI learning:

| Field | Description |
|---|---|
| `pattern` | 3-candle label sequence e.g. `[up_weak, up_medium, up_weak]` |
| `postgres_probability` | Raw up/down probability from materialized table |
| `conviction_tier` | Skip / Moderate / High / Dominant |
| `conflict` | Boolean — whether directional conflict was detected |
| `conflict_reason` | Description of the conflict if applicable |
| `route` | Trend / Reversal / Pullback |
| `momentum_score` | Per candle (c1, c2, c3) |
| `sequence_slope` | c3.pct_change - c1.pct_change |
| `wick_ratio` | Per candle (c1, c2, c3) |
| `volatility_proxy` | avg candle_range across 3 candles |
| `directional_agreement` | Score ±1 or ±3 |
| `all_formula_outputs` | Every formula in the group (eligible and ineligible) |
| `selected_formula` | Name of the formula selected by percentile banding |
| `selected_percentile` | Percentile rank of the selected formula |
| `sl_pct` | Selected SL as percentage |
| `sl_price` | Actual SL price level |
| `tp_price` | Actual TP price level |
| `tp_multiplier` | TP multiplier from user settings at time of trade |
| `leverage` | Final integer leverage applied |
| `dollar_risk` | Actual dollar amount at risk |
| `wide_sl_flag` | Boolean — true if sl_pct > risk_pct (leverage floored to 1x) |
| `trade_outcome` | Win / Loss / Breakeven (filled post-trade) |

---

## 11. Full Execution Order

```
(c1, c2, c3) formed
     ↓
[1. Pattern Lookup — Postgres materialized table]
    match 3-candle label sequence
    retrieve up/down probability for 4th candle
     ↓ if no match → skip, no trade
[2. Probability Check + Conflict Detection]
     ↓
    < 68%                         → skip, no trade
    ≥ 80%                         → trade (Postgres dominates, conflict overridden)
    68% – 79% AND no conflict     → trade
    68% – 79% AND conflict        → skip, log as CONFLICTED
     ↓ if trading
[3. Pre-computation Layer]
    momentum_score        = pct_change × body_ratio        (per candle)
    sequence_slope        = c3.pct_change - c1.pct_change
    wick_ratio            = 1 - body_ratio                 (per candle)
    volatility_proxy      = avg(c1, c2, c3 candle_range)
    directional_agreement = sign(c1) + sign(c2) + sign(c3)
     ↓
[4. SL Router]
    ±3
      → Trend
    ±1 AND sign(c1) ≠ sign(c3) AND abs(c3.momentum_score) > abs(c1.momentum_score)
      → Reversal
    ±1 everything else
      → Pullback
     ↓
[5. Compute All Group Formulas]
    compute all formulas in matched group (T1–T5 / R1–R5 / P1–P5)
    take abs() of any eligible formula output (sl_pct must be positive magnitude)
    store all outputs including ineligible for AI learning
    sort eligible outputs ascending
    select by percentile based on route + conviction tier
     ↓
[6. SL & TP Price Levels]
    sl_pct   = selected formula output
    sl_price = entry ± (entry × sl_pct)
    tp_price = entry ∓ (sl_distance × tp_multiplier)
     ↓
[7. Position Sizing & Leverage]
    dollar_risk  = account_size × risk_pct
    raw_leverage = risk_pct / sl_pct
    leverage     = floor(raw_leverage)
    leverage     = max(1, min(leverage, 20))
    if sl_pct > risk_pct → flag WIDE_SL
     ↓
[8. Execute Trade]
    set leverage on exchange
    place entry order
    place SL order
    place TP order
    store all trade fields for AI learning
```

---

## 12. End-to-End Worked Example

This section traces a single trade from raw OHLC data through every step to final execution.

### Given

**Instrument:** BTCUSDT
**Timeframe:** 5-minute
**User settings:** account = $1,000, risk = 3%, tp_multiplier = 2
**Entry price (c3 close):** $65,000

**Raw candle data:**

| Candle | Open | High | Low | Close |
|---|---|---|---|---|
| c1 | $64,800 | $65,150 | $64,750 | $65,100 |
| c2 | $65,100 | $65,400 | $65,050 | $65,350 |
| c3 | $65,350 | $65,850 | $65,300 | $65,750 |

### Step 0 — Derive Base Fields

| Candle | pct_change | body_ratio | candle_range |
|---|---|---|---|
| c1 | `(65100-64800)/64800 × 100 = 0.463%` | `abs(65100-64800)/(65150-64750) = 300/400 = 0.75` | `(65150-64750)/64800 × 100 = 0.617%` |
| c2 | `(65350-65100)/65100 × 100 = 0.384%` | `abs(65350-65100)/(65400-65050) = 250/350 = 0.714` | `(65400-65050)/65100 × 100 = 0.538%` |
| c3 | `(65750-65350)/65350 × 100 = 0.612%` | `abs(65750-65350)/(65850-65300) = 400/550 = 0.727` | `(65850-65300)/65350 × 100 = 0.842%` |

### Step 1 — Candle Classification

| Candle | pct_change | body_ratio | Label |
|---|---|---|---|
| c1 | 0.463% (> 0.1, < 0.5) | 0.75 (≥ 0.3) | `up_weak` |
| c2 | 0.384% (> 0.1, < 0.5) | 0.714 (≥ 0.3) | `up_weak` |
| c3 | 0.612% (> 0.5) | 0.727 (≥ 0.4) | `up_medium` |

**Pattern:** `[up_weak, up_weak, up_medium]`

### Step 2 — Pattern Lookup & Probability Check

Postgres materialized table returns:
- **up probability: 73%**, down probability: 27%

Conviction tier: **Moderate (68–74%)**
Trade direction: **LONG** (up side ≥ 68%)

Conflict check deferred until route is determined (Step 4).

### Step 3 — Pre-computation Layer

| Name | Computation | Result |
|---|---|---|
| Momentum Score (c1) | `0.463 × 0.75` | `0.347` |
| Momentum Score (c2) | `0.384 × 0.714` | `0.274` |
| Momentum Score (c3) | `0.612 × 0.727` | `0.445` |
| Sequence Slope | `0.612 - 0.463` | `+0.149` (accelerating) |
| Wick Ratio (c1) | `1 - 0.75` | `0.25` |
| Wick Ratio (c2) | `1 - 0.714` | `0.286` |
| Wick Ratio (c3) | `1 - 0.727` | `0.273` |
| Volatility Proxy | `avg(0.617, 0.538, 0.842)` | `0.666%` |
| Directional Agreement | `+1 + 1 + 1` | `+3` |

### Step 4 — Route Discrimination

`directional_agreement = +3` → **Trend**

**Conflict check:** Postgres says up 73%, Trend route on all-bullish candles implies uptrend → **No conflict. Aligned.**

### Step 5 — Compute Trend Group Formulas

| # | Name | Computation | Output | SL Eligible |
|---|---|---|---|---|
| T1 | Simple Average | `avg(0.463, 0.384, 0.612)` | `0.486%` | ✅ |
| T2 | Weighted Average | `0.463×0.2 + 0.384×0.3 + 0.612×0.5` | `0.514%` | ✅ |
| T3 | Conviction-Weighted | `avg(0.347, 0.274, 0.445)` | `0.355%` | ✅ |
| T4 | Range Ceiling | `max(0.617, 0.538, 0.842)` | `0.842%` | ✅ |
| T5 | Trend Acceleration | `sequence_slope = 0.149` | `0.149` | ❌ |

**Eligible sorted ascending:** `[0.355%, 0.486%, 0.514%, 0.842%]`
(positions:                      1st      2nd      3rd      4th)

**Percentile selection:** Trend + Moderate → 75th percentile → picks **3rd of 4** = `0.514%`

**Selected formula:** T2 (Weighted Average)
**sl_pct = 0.514%**

### Step 6 — SL & TP Price Levels

```
sl_distance = $65,000 × 0.514% = $334.10
SL price    = $65,000 - $334.10 = $64,665.90   (long trade)
TP price    = $65,000 + ($334.10 × 2) = $65,668.20
```

### Step 7 — Position Sizing & Leverage

```
dollar_risk  = $1,000 × 3% = $30
raw_leverage = 3% / 0.514% = 5.84x
leverage     = floor(5.84) = 5x
leverage     = max(1, min(5, 20)) = 5x

actual_risk  = ($1,000 × 5) × 0.514% = $25.70  ✅ under $30
wide_sl_flag = false (0.514% < 3%)
```

### Step 8 — Execute Trade

| Field | Value |
|---|---|
| Direction | LONG |
| Entry | $65,000 |
| Stop Loss | $64,665.90 |
| Take Profit | $65,668.20 |
| Leverage | 5x |
| Dollar Risk | $25.70 |
| Pattern | `[up_weak, up_weak, up_medium]` |
| Route | Trend |
| Conviction | Moderate (73%) |
| Selected Formula | T2 — Weighted Average |
| Conflict | None |
| Wide SL | No |
