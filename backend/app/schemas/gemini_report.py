from pydantic import BaseModel


class ClassPrediction(BaseModel):
    id: str
    name: str
    probability: float


class GeminiReportResponse(BaseModel):
    predictions: list[ClassPrediction]
    report: str
    texture_note: str
    pigment_note: str
    self_care: str | None = None
