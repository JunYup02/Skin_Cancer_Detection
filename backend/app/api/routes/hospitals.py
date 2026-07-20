from fastapi import APIRouter, Query

from app.schemas.hospitals import Hospital
from app.services.places import find_nearby

router = APIRouter()


@router.get("/hospitals/nearby", response_model=list[Hospital])
async def get_nearby_hospitals(
    lat: float = Query(...),
    lng: float = Query(...),
    radius_m: float = Query(3000, le=10000),
):
    return await find_nearby(lat, lng, radius_m)
