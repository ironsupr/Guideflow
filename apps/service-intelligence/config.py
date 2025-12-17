"""
Configuration settings for Service Intelligence
"""

import os
from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # API Keys
    gemini_api_key: str = ""
    elevenlabs_api_key: str = ""
    
    # ElevenLabs settings
    elevenlabs_voice_id: str = "21m00Tcm4TlvDq8ikWAM"  # Rachel voice
    elevenlabs_model_id: str = "eleven_turbo_v2"
    
    # Gemini settings
    gemini_model: str = "gemini-2.5-flash"
    
    # Output settings
    output_dir: str = "./output"
    
    # Server settings
    host: str = "0.0.0.0"
    port: int = 8000
    
    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
