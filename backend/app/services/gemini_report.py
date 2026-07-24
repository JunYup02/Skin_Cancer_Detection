"""Generates a plain-language explanation of a lesion classification using Gemini.

Requires the GEMINI_API_KEY env var (get one at https://aistudio.google.com/apikey).
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from functools import lru_cache

from fastapi import HTTPException
from google import genai
from google.genai import types
from PIL import Image
from pydantic import BaseModel

from app.schemas.gemini_report import ClassPrediction

# gemini-3.5-flash was tried briefly for better English-enforcement, but its capacity is
# prone to 503 UNAVAILABLE ("high demand") under load -- gemini-2.5-flash is the proven
# stable model for this endpoint, so the Hangul/percentage retry below (which predates
# the 3.5 experiment) does the enforcement work instead.
MODEL_NAME = "gemini-2.5-flash"

# Matches any Hangul syllable/jamo -- used to detect Korean slipping into a response
# despite the English-only instruction, so we can retry once with a firmer prompt.
HANGUL_RE = re.compile(r"[가-힣ᄀ-ᇿ㄰-㆏]")

# The classification model returns short HAM10000 codes (e.g. "nv"), not names --
# expand to a full name here so Gemini always gets (and can use) the real disease
# name rather than guessing what the abbreviation means each time.
FULL_DISEASE_NAMES = {
    "akiec": "actinic keratosis / Bowen's disease (intraepithelial carcinoma)",
    "bcc": "basal cell carcinoma",
    "bkl": "benign keratosis-like lesion (solar lentigo, seborrheic keratosis, or lichen-planus-like keratosis)",
    "df": "dermatofibroma",
    "mel": "melanoma",
    "nv": "melanocytic nevus",
    "vasc": "vascular lesion (angioma, angiokeratoma, pyogenic granuloma, or hemorrhage)",
}

# Mirrors the two-tier risk split in frontend/js/results.js (CLASS_INFO) -- keyed by the
# same class `name` the backend returns (ClassPrediction.name = AutoML displayName).
# Kept in sync manually since the frontend doesn't call back here.
RISK_BY_CLASS = {
    "mel": "high",
    "bcc": "high",
    "akiec": "high",
    "bkl": "low",
    "nv": "low",
    "vasc": "low",
    "df": "low",
}

# Set as both a system_instruction and repeated inline in the prompt itself --
# belt and suspenders against the model matching some other language cue (e.g.
# variable names, or just drifting) instead of the instruction.
SYSTEM_INSTRUCTION = (
    "You always respond in English only, regardless of what language anything else in the "
    "conversation or request is in. Never output Korean or any language other than English."
)

PROMPT_TEMPLATE = """You are an AI assistant supporting a dermatology workflow. The attached image is a
photo of a skin lesion taken by the patient. An AI classification model's top predicted condition for
this lesion is:

{disease_name}

Do not mention or imply any confidence score, probability, or percentage anywhere in your answer --
just refer to this as the predicted condition. Look at the image yourself and write the following
three fields. IMPORTANT: every field must be written in English only -- do not use Korean or any other
language, even if it feels more natural for the content.

1. report: 3-5 sentences in English. Explain the predicted condition in plain language and suggest a
   recommended next step (e.g. whether an in-person visit is warranted). The final sentence must state
   that this is a reference-only AI analysis, not a medical diagnosis.
2.  self_care: 3-5 sentences in English with practical, general self-care and monitoring guidance for a
   low-risk skin lesion like this one (e.g. sun protection, moisturizing, avoiding irritation/picking, and
   what changes in size, shape, color, or symptoms -- such as bleeding or itching -- should prompt seeing a
   doctor). Keep it general safety advice, not a prescribed treatment, and do not contradict the
   reference-only nature of this analysis.
3. pigment_note: One sentence in English on the lesion's color/pigment distribution as actually
   observed in the image (e.g. a single tone vs. multiple colors mixed together). Describe only what is
   actually visible in the image.

"""

SELF_CARE_ADDENDUM = """

The AI classification for this lesion falls in the low-risk (benign-leaning) tier. In addition to the
three fields above, also write a fourth field:

4. texture_note: One sentence in English on the lesion's border/texture as actually observed in the
   image (e.g. whether the border is smooth or irregular, symmetric or not). Describe only what is
   actually visible in the image.

Reminder:  report, texture_note, and pigment_note, self_care must also be in English only, with no percentages or probability figures."""

RETRY_SUFFIX = """

Your previous answer violated the rules above (it contained Korean text and/or a percentage). Write the
fields again from scratch, in English only, with zero Korean characters and zero numbers standing
for probabilities or percentages."""


class GeminiAnalysis(BaseModel):
    report: str
    texture_note: str
    pigment_note: str


class GeminiAnalysisWithSelfCare(GeminiAnalysis):
    self_care: str


@dataclass
class ReportResult:
    report: str
    texture_note: str
    pigment_note: str
    self_care: str | None = None


@lru_cache
def _get_client() -> genai.Client:
    return genai.Client()


def _violates_language_rules(analysis: GeminiAnalysis) -> bool:
    combined = " ".join(v for v in analysis.model_dump().values() if isinstance(v, str))
    return bool(HANGUL_RE.search(combined) or "%" in combined)


def _call_gemini(image: Image.Image, prompt: str, schema: type[GeminiAnalysis]) -> GeminiAnalysis:
    try:
        response = _get_client().models.generate_content(
            model=MODEL_NAME,
            contents=[image, prompt],
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                response_mime_type="application/json",
                response_schema=schema,
            ),
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Gemini report generation failed: {exc}") from exc
    return response.parsed


def generate_report(predictions: list[ClassPrediction], image: Image.Image) -> ReportResult:
    top = max(predictions, key=lambda p: p.probability)
    risk = RISK_BY_CLASS.get(top.name, "low")
    disease_name = FULL_DISEASE_NAMES.get(top.name, top.name)

    prompt = PROMPT_TEMPLATE.format(disease_name=disease_name)
    schema = GeminiAnalysis
    if risk == "low":
        # Only ask for (and pay for) self-care guidance when the finding is low-risk --
        # it's not relevant advice for a high-risk finding, which should point to a
        # doctor instead.
        prompt += SELF_CARE_ADDENDUM
        schema = GeminiAnalysisWithSelfCare

    analysis = _call_gemini(image, prompt, schema)
    if _violates_language_rules(analysis):
        # gemini-2.5-flash occasionally ignores the system_instruction on the first pass --
        # one retry with an explicit callout of the violation reliably fixes it in practice.
        analysis = _call_gemini(image, prompt + RETRY_SUFFIX, schema)

    return ReportResult(
        report=analysis.report,
        texture_note=analysis.texture_note,
        pigment_note=analysis.pigment_note,
        self_care=getattr(analysis, "self_care", None),
    )
