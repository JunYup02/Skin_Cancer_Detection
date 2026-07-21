"""Calls a deployed Vertex AI AutoML image-classification endpoint.

Requires env vars: VERTEX_PROJECT_ID, VERTEX_LOCATION (e.g. "us-central1"),
VERTEX_ENDPOINT_ID, and GOOGLE_APPLICATION_CREDENTIALS (service account key path).
"""
from __future__ import annotations

import base64
import io
import os
from functools import lru_cache

from fastapi import HTTPException
from PIL import Image

from app.schemas.gemini_report import ClassPrediction

REQUIRED_ENV_VARS = ("VERTEX_PROJECT_ID", "VERTEX_LOCATION", "VERTEX_ENDPOINT_ID")


@lru_cache
def _get_client():
    from google.cloud import aiplatform

    location = os.environ["VERTEX_LOCATION"]
    return aiplatform.gapic.PredictionServiceClient(
        client_options={"api_endpoint": f"{location}-aiplatform.googleapis.com"}
    )


def classify(image: Image.Image) -> list[ClassPrediction]:
    from google.cloud.aiplatform.gapic.schema import predict as predict_schema

    missing = [name for name in REQUIRED_ENV_VARS if not os.environ.get(name)]
    if missing:
        raise HTTPException(
            status_code=503,
            detail=(
                "Vertex AI endpoint isn't configured yet — missing env var(s): "
                f"{', '.join(missing)}. Set these once a model is deployed to an endpoint."
            ),
        )

    buffer = io.BytesIO()
    image.convert("RGB").save(buffer, format="JPEG")
    encoded_content = base64.b64encode(buffer.getvalue()).decode("utf-8")

    instance = predict_schema.instance.ImageClassificationPredictionInstance(
        content=encoded_content,
    ).to_value()
    parameters = predict_schema.params.ImageClassificationPredictionParams(
        confidence_threshold=0.0,
        max_predictions=10,
    ).to_value()

    try:
        client = _get_client()
        endpoint_path = client.endpoint_path(
            project=os.environ["VERTEX_PROJECT_ID"],
            location=os.environ["VERTEX_LOCATION"],
            endpoint=os.environ["VERTEX_ENDPOINT_ID"],
        )
        response = client.predict(endpoint=endpoint_path, instances=[instance], parameters=parameters)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Vertex AI prediction failed: {exc}") from exc

    prediction = dict(response.predictions[0])
    predictions = [
        ClassPrediction(id=class_id, name=name, probability=float(probability))
        for class_id, name, probability in zip(
            prediction["ids"], prediction["displayNames"], prediction["confidences"]
        )
    ]
    predictions.sort(key=lambda p: p.probability, reverse=True)
    return predictions
