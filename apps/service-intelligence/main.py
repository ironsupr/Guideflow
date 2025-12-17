"""
Service Intelligence - FastAPI application for AI processing
Handles text refinement with Gemini and voice synthesis with ElevenLabs
"""

import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from routes import audio_router, health_router
from config import settings

# Load environment variables
load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - setup and teardown"""
    # Startup
    output_dir = Path(settings.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    print(f"📁 Output directory: {output_dir.absolute()}")
    
    yield
    
    # Shutdown
    print("👋 Shutting down Service Intelligence")


# Create FastAPI app
app = FastAPI(
    title="Service Intelligence",
    description="AI processing service for Clueso.io clone - Gemini text refinement and ElevenLabs TTS",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for audio output
output_path = Path(settings.output_dir)
output_path.mkdir(parents=True, exist_ok=True)
app.mount("/output", StaticFiles(directory=str(output_path)), name="output")

# Include routers
app.include_router(health_router)
app.include_router(audio_router)


@app.get("/")
async def root():
    """Root endpoint with API info"""
    return {
        "name": "Service Intelligence",
        "version": "1.0.0",
        "description": "AI processing service for Clueso.io clone",
        "endpoints": {
            "POST /audio-full-process": "Full processing pipeline (refine + synthesize)",
            "POST /refine-text": "Refine transcript text with Gemini",
            "POST /synthesize-voice": "Generate voice with ElevenLabs",
            "POST /translate-synthesize": "Translate and synthesize in target language",
            "GET /health": "Health check endpoint",
        },
    }


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=True,
    )
