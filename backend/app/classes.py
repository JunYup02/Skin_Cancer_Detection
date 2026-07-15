"""HAM10000 seven-class lesion taxonomy and demo risk mapping.

Base risk levels are a simplified illustrative mapping (malignant/precancerous
classes -> high, benign-but-worth-checking -> medium, common benign -> low),
not a clinically validated triage rule.
"""
from __future__ import annotations

CLASS_ORDER = ["akiec", "bcc", "bkl", "df", "mel", "nv", "vasc"]

CLASS_INFO = {
    "akiec": {
        "label": "Actinic keratosis / intraepithelial carcinoma",
        "base_risk": "high",
    },
    "bcc": {
        "label": "Basal cell carcinoma",
        "base_risk": "high",
    },
    "bkl": {
        "label": "Benign keratosis-like lesion",
        "base_risk": "medium",
    },
    "df": {
        "label": "Dermatofibroma",
        "base_risk": "low",
    },
    "mel": {
        "label": "Melanoma",
        "base_risk": "high",
    },
    "nv": {
        "label": "Melanocytic nevus",
        "base_risk": "low",
    },
    "vasc": {
        "label": "Vascular lesion",
        "base_risk": "low",
    },
}

LOW_CONFIDENCE_THRESHOLD = 0.5
RISK_UPGRADE = {"low": "medium", "medium": "high", "high": "high"}

GUIDANCE = {
    "high": (
        "This is a high-risk finding. We recommend seeing a dermatologist as soon as "
        "possible for an accurate diagnosis."
    ),
    "medium": (
        "This finding warrants monitoring. Regularly check the lesion for changes in "
        "size, color, or shape, and consider a dermatology visit."
    ),
    "low": (
        "No significant risk findings. Still, if the lesion changes in size, color, "
        "or shape, we recommend consulting a dermatologist."
    ),
}


def compute_risk(predicted_class: str, confidence: float) -> tuple[str, bool]:
    """Return (risk_level, was_upgraded_for_low_confidence)."""
    base_risk = CLASS_INFO[predicted_class]["base_risk"]
    if confidence < LOW_CONFIDENCE_THRESHOLD:
        return RISK_UPGRADE[base_risk], True
    return base_risk, False
