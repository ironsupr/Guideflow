"""
Health check endpoint
"""

from datetime import datetime
from fastapi import APIRouter

from config import settings

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health_check():
    """Check service health and configuration status"""
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "services": {
            "gemini": "configured" if settings.gemini_api_key else "not_configured",
            "elevenlabs": "configured" if settings.elevenlabs_api_key else "not_configured",
        },
    }
