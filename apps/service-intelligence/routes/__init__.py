"""
Routes package for Service Intelligence
"""

from .health import router as health_router
from .audio import router as audio_router

__all__ = ["health_router", "audio_router"]
