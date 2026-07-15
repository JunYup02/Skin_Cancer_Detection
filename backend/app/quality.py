"""Lightweight image quality checks: resolution and blur.

Blur is estimated with the variance of a Laplacian-filtered grayscale image
(a standard cheap sharpness proxy) - low variance means few sharp edges,
i.e. a blurry photo.
"""
from __future__ import annotations

import numpy as np
from PIL import Image
from scipy import ndimage

MIN_DIMENSION = 200
BLUR_VARIANCE_THRESHOLD = 80.0

LAPLACIAN_KERNEL = np.array([[0, 1, 0], [1, -4, 1], [0, 1, 0]])


def check_image_quality(image: Image.Image) -> list[str]:
    warnings = []

    width, height = image.size
    if width < MIN_DIMENSION or height < MIN_DIMENSION:
        warnings.append(f"Image resolution is low ({width}x{height}). Please use a higher-resolution photo.")

    gray = np.asarray(image.convert("L"), dtype=np.float64)
    laplacian = ndimage.convolve(gray, LAPLACIAN_KERNEL)
    sharpness = laplacian.var()
    if sharpness < BLUR_VARIANCE_THRESHOLD:
        warnings.append("The image looks blurry. Please retake a clearer, in-focus photo.")

    return warnings
