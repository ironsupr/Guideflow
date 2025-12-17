"""
ElevenLabs Service - Text-to-Speech synthesis
"""

import os
from pathlib import Path
from typing import Optional, Dict, Any

from elevenlabs import ElevenLabs, VoiceSettings

from config import settings


class ElevenLabsService:
    """Service for interacting with ElevenLabs TTS API"""
    
    def __init__(self):
        self.configured = False
        self.client = None
        
        if settings.elevenlabs_api_key:
            self.client = ElevenLabs(api_key=settings.elevenlabs_api_key)
            self.configured = True
            print(f"✅ ElevenLabs configured with voice: {settings.elevenlabs_voice_id}")
        else:
            print("⚠️  ElevenLabs API key not configured")
    
    async def synthesize_voice(
        self,
        text: str,
        output_filename: str,
        voice_id: Optional[str] = None,
        model_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Synthesize text to speech using ElevenLabs
        
        Args:
            text: The text to synthesize
            output_filename: Name of the output audio file
            voice_id: Optional voice ID (uses default from settings if not provided)
            model_id: Optional model ID (uses default from settings if not provided)
            
        Returns:
            Dictionary with audio_path and duration
        """
        output_dir = Path(settings.output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / output_filename
        
        if not self.configured:
            # Return mock data if not configured
            return self._mock_synthesis(str(output_path), text)
        
        try:
            # Use provided values or defaults
            voice = voice_id or settings.elevenlabs_voice_id
            model = model_id or settings.elevenlabs_model_id
            
            # Generate audio
            audio_generator = self.client.text_to_speech.convert(
                voice_id=voice,
                model_id=model,
                text=text,
                voice_settings=VoiceSettings(
                    stability=0.5,
                    similarity_boost=0.75,
                    style=0.0,
                    use_speaker_boost=True,
                ),
            )
            
            # Write audio to file
            with open(output_path, "wb") as f:
                for chunk in audio_generator:
                    f.write(chunk)
            
            # Estimate duration (rough estimate: ~150 words per minute)
            word_count = len(text.split())
            estimated_duration = (word_count / 150) * 60  # in seconds
            
            # Convert Windows backslash to forward slash for URL compatibility
            url_path = "/output/" + output_filename
            
            return {
                "audio_path": url_path,
                "duration": estimated_duration,
            }
            
        except Exception as e:
            print(f"❌ ElevenLabs API error: {e}")
            return self._mock_synthesis(output_filename, text)
    
    async def get_available_voices(self) -> list:
        """Get list of available voices from ElevenLabs"""
        if not self.configured:
            return self._mock_voices()
        
        try:
            voices_response = self.client.voices.get_all()
            return [
                {
                    "voice_id": voice.voice_id,
                    "name": voice.name,
                    "category": voice.category,
                    "description": getattr(voice, "description", ""),
                }
                for voice in voices_response.voices
            ]
            
        except Exception as e:
            print(f"❌ Error fetching voices: {e}")
            return self._mock_voices()
    
    def _mock_synthesis(self, output_filename: str, text: str) -> Dict[str, Any]:
        """Generate mock synthesis result when ElevenLabs is not configured"""
        output_dir = Path(settings.output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / output_filename
        
        # Create a placeholder file
        with open(output_path, "wb") as f:
            # Write minimal valid MP3 header (silence)
            f.write(b"\xff\xfb\x90\x00" + b"\x00" * 100)
        
        # Estimate duration
        word_count = len(text.split())
        estimated_duration = (word_count / 150) * 60
        
        # Use URL-friendly path
        url_path = "/output/" + output_filename

        return {
            "audio_path": url_path,
            "duration": estimated_duration,
        }
    
    def _mock_voices(self) -> list:
        """Return mock voice list when ElevenLabs is not configured"""
        return [
            {"voice_id": "21m00Tcm4TlvDq8ikWAM", "name": "Rachel", "category": "premade"},
            {"voice_id": "EXAVITQu4vr4xnSDxMaL", "name": "Bella", "category": "premade"},
            {"voice_id": "ErXwobaYiN019PkySvjV", "name": "Antoni", "category": "premade"},
            {"voice_id": "MF3mGyEYCl7XYWbV9V6O", "name": "Elli", "category": "premade"},
            {"voice_id": "TxGEqnHWrfWFTfGW9XjX", "name": "Josh", "category": "premade"},
        ]
