# Data and models

The detailed account behind the headline numbers in the [README](../README.md):
where the data comes from, every filtering decision and why it was made, and how
each model was measured. All figures are from the checkpoints the app currently
serves, on storms held out from training.

## The data

| | |
| --- | --- |
| Source | IBTrACS v04r01, NOAA/NCEI best-track archive |
| Wind column | `USA_WIND`, 1-minute sustained |
| Fixes | Synoptic only — 00/06/12/18Z |
| Span | 1980 – 2026, 4,450 storms, 111,960 fixes |
| Basins | WP 1338, EP 946, SI 757, NA 710, SP 465, NI 233, SA 1 |
| North Indian Ocean | Bay of Bengal 157, Arabian Sea 76 |
| Scale | Saffir-Simpson, which is defined for 1-minute winds |
| Environment | Sea-surface temperature: NOAA ERSST v5 monthly means, 2° grid |

A storm is filed under the basin and sub-basin it **formed** in, which is why
those counts sum to the total exactly. Twenty-five more storms formed elsewhere and
later moved into the North Indian Ocean, and IBTrACS records both names for
them: the Pacific storm Matmo became Bulbul on entering the Bay of Bengal in
2019, and the archive stores it as `BULBUL:MATMO`.

Four choices in that table are load-bearing.

`USA_WIND` is used alone because `WMO_WIND` mixes 1-, 3- and 10-minute
averaging periods between agencies, so comparing its values across basins
compares different quantities.

Only synoptic rows are kept because IBTrACS interpolates the intermediate
3-hourly rows from fixes on both sides — including later ones. Training on those
rows let the model read forward in time, and they were 42% of the original
table.

A fix needs a position and a wind, but **not** a pressure. Requiring one threw
away 18,472 fixes and 476 whole storms, and it fell hardest where the data is
thinnest: two thirds of North Indian Ocean fixes report a wind and only two
thirds of those also report a pressure. The models are built for this — the
step features carry a `pressure_present` flag, training applies pressure
dropout, and the intensity loss and metrics mask the pressure component per fix
so an absent reading contributes nothing rather than being learned as "no
change".

Uncoded fixes (IBTrACS `NATURE = NR`) are kept. `NR` means *not reported*, not
*not tropical*: measured against this archive those fixes sit at a median 12.7°
of latitude against 41.5° for extratropical ones, and the live adapter has
always accepted them. Fixes positively coded as something else — extratropical,
subtropical, disturbance, mixed — stay out.

That rule was briefly stricter, keeping `NR` only inside storms coded `TS`
somewhere, and the North Indian Ocean is why it is not. Between 1990 and 1995
that basin has **1,952 `NR` fixes against 57 `TS`** ones: only 5 of its 58
storms carry a single `TS` fix, because that is simply how the basin was
recorded then. The restriction deleted six consecutive Indian Ocean seasons,
among them the **April 1991 Bangladesh cyclone** — 33 synoptic fixes, every one
reporting a wind, coded `NR` throughout, peak 259 kph, and one of the deadliest
tropical cyclones ever recorded. A filter that silently erases the deadliest
storm in the record is not conservative, it is broken.

The **Arabian Sea** and the **Bay of Bengal** are one IBTrACS basin (NI) but two
seas on opposite sides of the Indian peninsula, so the sub-basin is stored and
filterable in its own right. It is taken from the storm's genesis fix, the same
rule already used for the basin.

## The models

Measured on 668 held-out **storms**, never held-out rows: every fix of a storm
is in exactly one split, so nothing is scored against a storm it trained on.

**Track** — GRU over up to 12 past fixes, 20 features per step.

| Horizon | Mean error | Median | Persistence | Linear extrapolation |
| --- | --- | --- | --- | --- |
| +6h | 28.6 km | 23.5 km | 105.0 km | 31.0 km |
| +12h | 61.8 km | 51.6 km | 206.0 km | 69.0 km |
| +24h | 143.7 km | 122.0 km | 399.6 km | 166.3 km |

Per basin, with the margin over linear extrapolation at +24h — the comparison
that shows the model learned how tracks curve in that basin, rather than just
that storms keep moving:

| Basin | Held-out storms | +6h | +12h | +24h | vs linear at +24h |
| --- | --- | --- | --- | --- | --- |
| East/Central Pacific | 132 | 22 km | 48 km | 111 km | 9% better |
| North Atlantic | 152 | 31 km | 69 km | 164 km | 18% better |
| **North Indian Ocean** | 42 | 31 km | 60 km | 134 km | 11% better |
| South Indian | 103 | 28 km | 59 km | 136 km | 11% better |
| South Pacific | 61 | 34 km | 75 km | 180 km | 6% better |
| West Pacific | 214 | 29 km | 63 km | 146 km | 16% better |

Two honest notes on that table. The North Indian Ocean row rests on 42 held-out
storms, the fewest of any basin, so its margin carries the widest error bars.
And at **+6h** the South Pacific is a wash — 34 km against the baseline's 33 —
so "beats linear in every basin" is true at +24h and not at every horizon.

Forecasting the same held-out storms with **pressure withheld entirely** costs
under 0.3 km at every horizon (28.8 / 61.8 / 143.5 km). That is what the
`pressure_present` flag is for, and it is why the archive can include storms
that never reported a pressure: the model degrades gracefully on them instead
of mispredicting them.

**Intensity** — same encoder, wind and pressure regression plus a three-class
trend head.

| Horizon | Wind MAE | Persistence | Wind n | Pressure MAE | Persistence | Pressure n |
| --- | --- | --- | --- | --- | --- | --- |
| +6h | 5.9 kph | 7.5 kph | 15,090 | 2.5 hPa | 3.1 hPa | 12,457 |
| +12h | 10.3 kph | 14.4 kph | 14,386 | 4.3 hPa | 5.9 hPa | 11,877 |
| +24h | 18.0 kph | 26.0 kph | 13,063 | 7.8 hPa | 10.8 hPa | 10,730 |

Trend accuracy 68.0% against a 42.1% majority-class baseline.

Sea-surface temperature is one of the inputs, and it does not earn its place.
Retraining the same model on the same held-out storms without it gives wind
MAE 17.9 kph at +24h instead of 18.0 and trend accuracy 68.4% instead of 68.0%
— within noise, and no better. It stays wired in because it costs nothing and a
finer-grained field might change that; it is not claimed as an improvement.

The two sample counts differ on purpose, and the gap is the honesty fix made
visible: 2,633 held-out samples at +6h have a wind target and no pressure
target, so they score the wind head and are excluded from the pressure figure
entirely. Counting them would have meant scoring the model against a pressure
change of zero that nobody measured — and it would have flattered the pressure
MAE precisely where reporting is thinnest.

**Analogue ensemble** — nearest neighbours over 88,304 track windows from 4,313
storms, matched on recent curvature rather than absolute displacement, with the
ten closest averaged into an independent second forecast.

It is the weakest component here, and the wider archive made it weaker as a
forecaster rather than stronger:

| Horizon | Analogue | Linear extrapolation | Neural track model |
| --- | --- | --- | --- |
| +6h | 30.1 km | 29.0 km | 28.6 km |
| +12h | 66.3 km | 65.7 km | 61.8 km |
| +24h | 158.0 km | 161.0 km | 143.7 km |

So it now loses to plain linear extrapolation at +6h and +12h, and beats it at
+24h by only 1.9% — down from 4% before, because the added sparsely-reported
storms are ones a straight line predicts well. Combining the members differently does not rescue it: the plain mean, the
median and a closeness-weighted mean score 158.0, 157.9 and 158.1 km at +24h
on the same windows. Its member spread correlates
with its own error at only 0.23–0.25, so it is a weak uncertainty signal.

Blending it into the neural forecast was measured too, fairly: the same held-out
moments, an analogue index built from training storms only, the weight chosen on
validation storms and applied once to the test set, and a confidence interval
that resamples whole storms ([`ai-service/evaluation/blend_report.py`](../ai-service/evaluation/blend_report.py)). The gain is real at
every horizon and far too small to matter — 0.3 km at +6h, 0.4 km at +12h and
+24h, against best-track positions recorded to about 11 km — so the two are not
blended.

It stays in the product for the one thing it does that no network does: every
number it produces is traceable to named storms a reader can go and look at.
Asked about Mocha from its 13 May 2023 12:00Z fix, it returns Mala 2006 first — which also crossed the Bay of
Bengal into Myanmar's Rakhine coast in May — and that is an argument a
forecaster can check. It is presented as a second opinion, never as the
forecast. The console words its comparison with a straight line from the
evaluation the index recorded, so the claim moves with the next rebuild instead
of going stale, and its circles are labelled as disagreement between past
storms, not as an error range.

**Storm DNA** — the one analysis here with no model in it. A storm's whole
life is reduced to nine measured traits — how long it lasted, how strong and
how quickly it got there, how far, how fast and how crookedly it travelled,
where it formed and how far poleward it went — and compared with every other
storm in the archive by standardised Euclidean distance. It is not the analogue
ensemble: that matches the last 24 hours to forecast the next 24, while this
compares completed lives and forecasts nothing. Nearest neighbours are reported
with the distance and the number of traits it was computed from, because a
distance over four traits is not the same claim as one over nine.

**Satellite** — architecture, training pipeline and source-conditioning are
complete, but no checkpoint for the current architecture exists on this machine,
so every satellite request returns `NOT_AVAILABLE` with a reason. An earlier
ResNet-18 checkpoint under `ai-service/trained_models/` predates the
source-conditioned architecture and deliberately fails to load rather than
loading partially.

Baselines matter more than the headline numbers. Persistence and linear
extrapolation are what a forecaster gets for free, so a model is only worth
running if it beats them — and the honest margin over linear extrapolation at
+24h is 10–20% by basin, not the multiple that a comparison against persistence
alone would suggest.
