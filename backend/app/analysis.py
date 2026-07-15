import io

from fastapi import HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError

from app.classes import CLASS_INFO, GUIDANCE, compute_risk
from app.predictor import get_predictor
from app.quality import check_image_quality
from app.schemas import AnalyzeResponse

MAX_UPLOAD_BYTES = 10 * 1024 * 1024


async def load_upload_image(file: UploadFile) -> Image.Image:
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="The image file is too large (10MB max).")
    try:
        return Image.open(io.BytesIO(data))
    except UnidentifiedImageError:
        raise HTTPException(status_code=400, detail="Could not open the image file. Please try a different file.")


def run_analysis(image: Image.Image) -> AnalyzeResponse:
    quality_warnings = check_image_quality(image)

    probabilities = get_predictor().predict(image)
    predicted_class = max(probabilities, key=probabilities.get)
    confidence = probabilities[predicted_class]

    risk_level, was_upgraded = compute_risk(predicted_class, confidence)
    info = CLASS_INFO[predicted_class]

    return AnalyzeResponse(
        predicted_class=predicted_class,
        label=info["label"],
        confidence=confidence,
        probabilities=probabilities,
        risk_level=risk_level,
        risk_upgraded_low_confidence=was_upgraded,
        guidance=GUIDANCE[risk_level],
        quality_warnings=quality_warnings,
    )
