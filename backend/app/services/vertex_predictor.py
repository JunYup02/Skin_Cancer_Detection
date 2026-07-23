"""Calls a deployed Vertex AI AutoML image-classification endpoint over its REST API.

Requires env vars: VERTEX_PROJECT_ID, VERTEX_LOCATION (e.g. "us-central1"),
VERTEX_ENDPOINT_ID, and GOOGLE_APPLICATION_CREDENTIALS (service account key path).

Talks to the predict REST endpoint directly with google-auth + httpx instead of the
google-cloud-aiplatform SDK: that SDK pulls in grpc/protobuf, heavy enough to
OOM-kill small instances (e.g. Render's free tier) on import alone.
"""
from __future__ import annotations

import base64
import io
import os
from functools import lru_cache

import httpx
from fastapi import HTTPException
from google.auth.transport.requests import Request
from google.oauth2 import service_account
from PIL import Image

from app.schemas.gemini_report import ClassPrediction

REQUIRED_ENV_VARS = ("VERTEX_PROJECT_ID", "VERTEX_LOCATION", "VERTEX_ENDPOINT_ID")
SCOPES = ["https://www.googleapis.com/auth/cloud-platform"]


@lru_cache
def _get_credentials() -> service_account.Credentials:
    key_path = os.environ["GOOGLE_APPLICATION_CREDENTIALS"]
    return service_account.Credentials.from_service_account_file(key_path, scopes=SCOPES)


def _get_access_token() -> str:
    creds = _get_credentials()
    if not creds.valid:
        creds.refresh(Request())
    return creds.token


def classify(image: Image.Image) -> list[ClassPrediction]:
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

    project = os.environ["VERTEX_PROJECT_ID"]
    location = os.environ["VERTEX_LOCATION"]
    endpoint_id = os.environ["VERTEX_ENDPOINT_ID"]
    url = (
        f"https://{location}-aiplatform.googleapis.com/v1/projects/{project}"
        f"/locations/{location}/endpoints/{endpoint_id}:predict"
    )
    payload = {
        "instances": [{"content": encoded_content}],
        "parameters": {"confidenceThreshold": 0.0, "maxPredictions": 10},
    }

    try:
        token = _get_access_token()
        response = httpx.post(
            url,
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
            timeout=30.0,
        )
        response.raise_for_status()
        prediction = response.json()["predictions"][0]
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Vertex AI prediction failed: {exc}") from exc

    predictions = [
        ClassPrediction(id=class_id, name=name, probability=float(probability))
        for class_id, name, probability in zip(
            prediction["ids"], prediction["displayNames"], prediction["confidences"]
        )
    ]
    predictions.sort(key=lambda p: p.probability, reverse=True)
    return predictions
