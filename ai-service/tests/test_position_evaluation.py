"""The evaluation a track model publishes in its health entry.

The console words its comparisons ("worse than a straight line at +6 h") from
these numbers, so they must be exactly what training recorded, in horizon
order, and absent rather than invented when nothing was recorded.
"""

from registry.registry import position_evaluation


def test_rows_come_out_in_horizon_order_with_the_recorded_values():
    metrics = {"per_horizon": {
        "24h": {"mean_error_km": 158.0, "baseline_linear_km": 161.0, "spread_error_correlation": 0.25},
        "6h": {"mean_error_km": 30.1, "baseline_linear_km": 29.0, "spread_error_correlation": 0.23},
    }}

    rows = position_evaluation(metrics)

    assert [r["hours"] for r in rows] == [6, 24]
    assert rows[0] == {"hours": 6, "meanErrorKm": 30.1, "linearBaselineKm": 29.0,
                       "spreadErrorCorrelation": 0.23}


def test_a_model_without_spread_publishes_no_correlation():
    rows = position_evaluation({"per_horizon": {
        "6h": {"mean_error_km": 28.6, "baseline_linear_km": 31.0}}})

    assert "spreadErrorCorrelation" not in rows[0]


def test_nothing_recorded_means_nothing_published():
    assert position_evaluation(None) == []
    assert position_evaluation({}) == []
    # An intensity checkpoint has per-horizon metrics but no position error.
    assert position_evaluation({"per_horizon": {"6h": {"wind_mae_kph": 5.9}}}) == []
