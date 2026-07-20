from pydantic import BaseModel


class Hospital(BaseModel):
    name: str
    address: str
    lat: float
    lng: float
    distance_m: float
    business_status: str | None = None
    google_maps_url: str
