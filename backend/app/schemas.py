from pydantic import BaseModel


class AnalyzeResponse(BaseModel):
    predicted_class: str
    label: str
    confidence: float
    probabilities: dict[str, float]
    risk_level: str
    risk_upgraded_low_confidence: bool
    guidance: str
    quality_warnings: list[str]
