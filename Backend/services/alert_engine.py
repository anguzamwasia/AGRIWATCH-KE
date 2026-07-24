# AgriWatch KE — Early Warning Alert Engine
# © 2026 Cynthia Anguza. All Rights Reserved.
# IGAD Hackathon 2026 Submission.
#
# Computes threshold-based yield alerts (GREEN / ORANGE / RED)
# comparing AI-predicted yield against historical AFA baseline.
# Alerts are logged to the yield_alerts table for audit trail.
# Raw data is NEVER exposed — only the alert level + deviation %.

import logging

logger = logging.getLogger(__name__)

# ---- Thresholds ----
# Negative deviation (below baseline) triggers escalating alerts.
# ORANGE threshold: predicted yield is 10–30% below the historical average.
# RED threshold:    predicted yield is more than 30% below the historical average.
ORANGE_THRESHOLD = 10.0  # %
RED_THRESHOLD    = 30.0  # %

RECOMMENDED_ACTIONS = {
    "GREEN": (
        "Routine monitoring. No intervention required. "
        "Continue tracking NDVI and rainfall patterns."
    ),
    "ORANGE": (
        "WATCH: Notify county agricultural officers. "
        "Pre-position drought-tolerant seed varieties. "
        "Increase satellite monitoring frequency. "
        "Coordinate with local extension officers for ground verification."
    ),
    "RED": (
        "ALERT: Immediately notify national food security agencies. "
        "Activate anticipatory action protocols per IGAD/ICPAC framework. "
        "Coordinate emergency seed and fertilizer support with relevant ministries. "
        "Engage WFP/FAO for early response planning in affected counties."
    ),
}


def compute_alert(
    county: str,
    crop: str,
    year: int,
    predicted_yield: float,
    baseline_yield: float,
) -> dict:
    """
    Compare predicted yield against historical baseline and return a
    structured early warning alert object.

    Parameters
    ----------
    county          : County name (e.g. "Uasin Gishu")
    crop            : Crop name (e.g. "Maize")
    year            : Prediction year
    predicted_yield : AI-predicted yield in t/ha
    baseline_yield  : Historical average yield in t/ha

    Returns
    -------
    dict with keys:
        level            : "GREEN" | "ORANGE" | "RED"
        deviation_pct    : % difference from baseline (negative = below baseline)
        predicted_yield  : float (t/ha)
        baseline_yield   : float (t/ha)
        message          : Human-readable summary
        recommended_action: Suggested response
        county, crop, year
    """
    if baseline_yield <= 0:
        return {
            "level": "GREEN",
            "deviation_pct": 0.0,
            "predicted_yield": round(predicted_yield, 2),
            "baseline_yield": 0.0,
            "message": "No historical baseline available for comparison.",
            "recommended_action": RECOMMENDED_ACTIONS["GREEN"],
            "county": county,
            "crop": crop,
            "year": year,
        }

    deviation_pct = ((predicted_yield - baseline_yield) / baseline_yield) * 100

    if deviation_pct >= -ORANGE_THRESHOLD:
        level = "GREEN"
        message = (
            f"Normal season projected for {crop} in {county} ({year}). "
            f"Yield is {abs(deviation_pct):.1f}% {'above' if deviation_pct >= 0 else 'below'} "
            f"the historical average ({baseline_yield:.2f} t/ha)."
        )
    elif deviation_pct >= -RED_THRESHOLD:
        level = "ORANGE"
        message = (
            f"Below-average season projected for {crop} in {county} ({year}). "
            f"Yield is {abs(deviation_pct):.1f}% below the historical average "
            f"({baseline_yield:.2f} t/ha). Monitoring and preparedness advised."
        )
    else:
        level = "RED"
        message = (
            f"Crop failure risk for {crop} in {county} ({year}). "
            f"Yield is {abs(deviation_pct):.1f}% below the historical average "
            f"({baseline_yield:.2f} t/ha). Immediate anticipatory action required."
        )

    # Log to DB (non-fatal if DB unavailable)
    _log_alert_to_db(county, crop, year, predicted_yield, baseline_yield, deviation_pct, level)

    return {
        "level": level,
        "deviation_pct": round(deviation_pct, 1),
        "predicted_yield": round(predicted_yield, 2),
        "baseline_yield": round(baseline_yield, 2),
        "message": message,
        "recommended_action": RECOMMENDED_ACTIONS[level],
        "county": county,
        "crop": crop,
        "year": year,
    }


def _log_alert_to_db(county, crop, year, predicted_yield, baseline_yield, deviation_pct, level):
    """Write alert to the yield_alerts PostgreSQL table (audit trail)."""
    try:
        from services.cache_service import log_alert
        log_alert(
            county=county,
            crop=crop,
            year=year,
            predicted_yield=predicted_yield,
            baseline_yield=baseline_yield,
            deviation_pct=deviation_pct,
            alert_level=level,
        )
    except Exception as e:
        logger.debug(f"Alert DB log skipped (non-fatal): {e}")
