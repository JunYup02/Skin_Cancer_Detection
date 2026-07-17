"""Classifier backend abstraction.

Set PREDICTOR_BACKEND=local (default) to use the demo classifier trained on
synthetic data (see ml/synthetic_data.py). Set PREDICTOR_BACKEND=vertex to
route through Vertex AI once a real HAM10000-trained model is deployed there
(see VertexAIPredictor below for the env vars it needs and what's left to
wire up).
"""
from __future__ import annotations

import base64
import io
import os
from abc import ABC, abstractmethod
from functools import lru_cache
from pathlib import Path

import joblib
from PIL import Image

from app.classes import CLASS_ORDER
from ml.features import extract_features

ARTIFACT_PATH = Path(__file__).resolve().parent.parent / "ml" / "artifacts" / "lesion_model.joblib"


class Predictor(ABC):
    @abstractmethod
    def predict(self, image: Image.Image) -> dict[str, float]:
        """Return a {class_code: probability} dict covering all 7 classes."""


class LocalDemoPredictor(Predictor):
    def __init__(self):
        if not ARTIFACT_PATH.exists():
            raise FileNotFoundError(
                f"{ARTIFACT_PATH} not found. Run `python -m ml.train_model` from backend/ first."
            )
        self.model = joblib.load(ARTIFACT_PATH)

    def predict(self, image: Image.Image) -> dict[str, float]:
        features = extract_features(image).reshape(1, -1)
        probs = self.model.predict_proba(features)[0]
        return dict(zip(self.model.classes_, (float(p) for p in probs)))


class VertexAIPredictor(Predictor):
    """Routes prediction requests to a Vertex AI AutoML image classification endpoint.

    Requires env vars: VERTEX_PROJECT_ID, VERTEX_LOCATION, VERTEX_ENDPOINT_ID,
    and GOOGLE_APPLICATION_CREDENTIALS (service account key path). The endpoint's
    class labels must match the CLASS_ORDER codes in app/classes.py; any label the
    model doesn't return is treated as 0 probability.
    """

    def __init__(self):
        from google.cloud import aiplatform

        self.project_id = os.environ["VERTEX_PROJECT_ID"]
        self.location = os.environ["VERTEX_LOCATION"]
        self.endpoint_id = os.environ["VERTEX_ENDPOINT_ID"]

        self.client = aiplatform.gapic.PredictionServiceClient(
            client_options={"api_endpoint": f"{self.location}-aiplatform.googleapis.com"}
        )
        self.endpoint_path = self.client.endpoint_path(
            project=self.project_id, location=self.location, endpoint=self.endpoint_id
        )

    def predict(self, image: Image.Image) -> dict[str, float]:
        from google.cloud.aiplatform.gapic.schema import predict as predict_schema

        buffer = io.BytesIO()
        image.convert("RGB").save(buffer, format="JPEG")
        encoded_content = base64.b64encode(buffer.getvalue()).decode("utf-8")

        instance = predict_schema.instance.ImageClassificationPredictionInstance(
            content=encoded_content,
        ).to_value()
        parameters = predict_schema.params.ImageClassificationPredictionParams(
            confidence_threshold=0.0,
            max_predictions=len(CLASS_ORDER),
        ).to_value()

        response = self.client.predict(
            endpoint=self.endpoint_path, instances=[instance], parameters=parameters
        )
        prediction = dict(response.predictions[0])
        scores = dict(zip(prediction["displayNames"], prediction["confidences"]))
        return {class_code: float(scores.get(class_code, 0.0)) for class_code in CLASS_ORDER}


@lru_cache
def get_predictor() -> Predictor:
    backend = os.environ.get("PREDICTOR_BACKEND", "local")
    if backend == "vertex":
        return VertexAIPredictor()
    return LocalDemoPredictor()
