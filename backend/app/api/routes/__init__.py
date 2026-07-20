from fastapi import APIRouter

from app.api.routes.gemini_report import router as gemini_report_router

router = APIRouter(prefix="/api")

# Team members: add your feature's router here, e.g.
# from app.api.routes.<feature> import router as <feature>_router
# router.include_router(<feature>_router)
router.include_router(gemini_report_router)
