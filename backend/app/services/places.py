"""Finds nearby dermatology clinics/hospitals via the Google Places API (New).

Requires the GOOGLE_PLACES_API_KEY env var. Field mask is deliberately limited to
Nearby Search Pro-tier fields (cheaper) -- avoid adding rating, currentOpeningHours,
or other Enterprise-tier fields without checking their billing SKU first.
"""
from __future__ import annotations

import math
import os

import httpx
from fastapi import HTTPException

from app.schemas.hospitals import Hospital

SEARCH_URL = "https://places.googleapis.com/v1/places:searchNearby"
FIELD_MASK = (
    "places.displayName,places.formattedAddress,places.location,"
    "places.businessStatus,places.googleMapsUri"
)
EARTH_RADIUS_M = 6371000


def _distance_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in meters (haversine)."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


async def find_nearby(lat: float, lng: float, radius_m: float) -> list[Hospital]:
    payload = {
        "includedTypes": ["skin_care_clinic", "hospital"],
        "maxResultCount": 10,
        "locationRestriction": {
            "circle": {"center": {"latitude": lat, "longitude": lng}, "radius": radius_m}
        },
    }
    try:
        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": os.environ["GOOGLE_PLACES_API_KEY"],
            "X-Goog-FieldMask": FIELD_MASK,
        }
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(SEARCH_URL, json=payload, headers=headers)
            response.raise_for_status()
    except (KeyError, httpx.HTTPError) as exc:
        raise HTTPException(status_code=502, detail=f"Places lookup failed: {exc}") from exc

    hospitals = []
    for place in response.json().get("places", []):
        location = place.get("location", {})
        place_lat, place_lng = location.get("latitude"), location.get("longitude")
        hospitals.append(
            Hospital(
                name=place.get("displayName", {}).get("text", ""),
                address=place.get("formattedAddress", ""),
                lat=place_lat,
                lng=place_lng,
                distance_m=_distance_m(lat, lng, place_lat, place_lng),
                business_status=place.get("businessStatus"),
                google_maps_url=place.get("googleMapsUri", ""),
            )
        )

    hospitals.sort(key=lambda h: h.distance_m)
    return hospitals
