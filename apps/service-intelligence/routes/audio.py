"""
Audio processing routes - Full pipeline, refinement, and synthesis
"""

from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from config import settings
from services.gemini_service import GeminiService
from services.elevenlabs_service import ElevenLabsService

router = APIRouter(tags=["Audio Processing"])


# Request/Response Models
class DOMEvent(BaseModel):
    """DOM event from the extension"""
    type: str
    timestamp: int
    target: Optional[dict] = None
    metadata: Optional[dict] = None


class Instruction(BaseModel):
    """Generated instruction for the video"""
    text: str
    startTime: float
    endTime: float


class AudioProcessRequest(BaseModel):
    """Request for full audio processing pipeline"""
    sessionId: str
    audioPath: Optional[str] = None
    rawTranscript: str
    domEvents: List[dict] = []
    targetLanguage: Optional[str] = None


class AudioProcessResponse(BaseModel):
    """Response from full audio processing"""
    sessionId: str
    refinedText: str
    synthesizedAudioPath: str
    instructions: List[Instruction]
    scriptMetadata: Optional[dict] = None


class RefineTextRequest(BaseModel):
    """Request for text refinement only"""
    rawTranscript: str
    domEvents: List[dict] = []


class RefineTextResponse(BaseModel):
    """Response from text refinement"""
    refinedText: str
    instructions: List[Instruction]
    scriptMetadata: Optional[dict] = None


class SynthesizeVoiceRequest(BaseModel):
    """Request for voice synthesis only"""
    text: str
    voiceId: Optional[str] = None


class SynthesizeVoiceResponse(BaseModel):
    """Response from voice synthesis"""
    audioPath: str
    duration: float


class TranslateSynthesizeRequest(BaseModel):
    """Request for translation and synthesis"""
    text: str
    targetLanguage: str
    voiceId: Optional[str] = None


class TranslateSynthesizeResponse(BaseModel):
    """Response from translation and synthesis"""
    translatedText: str
    audioPath: str
    duration: float


# Initialize services
gemini_service = GeminiService()
elevenlabs_service = ElevenLabsService()


@router.post("/audio-full-process", response_model=AudioProcessResponse)
async def audio_full_process(request: AudioProcessRequest):
    """
    Full processing pipeline:
    1. Refine transcript with Gemini
    2. Generate instructions from DOM events
    3. Synthesize voice with ElevenLabs
    """
    try:
        print(f"🎯 Processing session: {request.sessionId}")
        
        # Step 1: Refine text with Gemini
        refined_result = await gemini_service.refine_transcript(
            raw_transcript=request.rawTranscript,
            dom_events=request.domEvents,
        )

        refined_text = refined_result["refined_text"]
        instructions = refined_result["instructions"]
        script_metadata = refined_result.get("script_metadata", {})
        
        print(f"✅ Refined text: {refined_text[:100]}...")
        
        # Step 2: Synthesize voice with ElevenLabs
        output_filename = f"{request.sessionId}_synthesized.mp3"
        audio_result = await elevenlabs_service.synthesize_voice(
            text=refined_text,
            output_filename=output_filename,
        )
        
        print(f"🔊 Synthesized audio: {audio_result['audio_path']}")
        
        return AudioProcessResponse(
            sessionId=request.sessionId,
            refinedText=refined_text,
            synthesizedAudioPath=audio_result["audio_path"],
            instructions=[
                Instruction(
                    text=inst["text"],
                    startTime=inst["start_time"],
                    endTime=inst["end_time"],
                )
                for inst in instructions
            ],
            scriptMetadata=script_metadata,
        )
        
    except Exception as e:
        print(f"❌ Processing error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/refine-text", response_model=RefineTextResponse)
async def refine_text(request: RefineTextRequest):
    """Refine transcript text using Gemini AI"""
    try:
        result = await gemini_service.refine_transcript(
            raw_transcript=request.rawTranscript,
            dom_events=request.domEvents,
        )

        return RefineTextResponse(
            refinedText=result["refined_text"],
            instructions=[
                Instruction(
                    text=inst["text"],
                    startTime=inst["start_time"],
                    endTime=inst["end_time"],
                )
                for inst in result["instructions"]
            ],
            scriptMetadata=result.get("script_metadata", {}),
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/synthesize-voice", response_model=SynthesizeVoiceResponse)
async def synthesize_voice(request: SynthesizeVoiceRequest):
    """Generate voice using ElevenLabs TTS"""
    try:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_filename = f"voice_{timestamp}.mp3"
        
        result = await elevenlabs_service.synthesize_voice(
            text=request.text,
            output_filename=output_filename,
            voice_id=request.voiceId,
        )
        
        return SynthesizeVoiceResponse(
            audioPath=result["audio_path"],
            duration=result["duration"],
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/translate-synthesize", response_model=TranslateSynthesizeResponse)
async def translate_synthesize(request: TranslateSynthesizeRequest):
    """Translate text and synthesize in target language"""
    try:
        # Translate with Gemini
        translated_text = await gemini_service.translate_text(
            text=request.text,
            target_language=request.targetLanguage,
        )
        
        # Synthesize translated text
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_filename = f"translated_{request.targetLanguage}_{timestamp}.mp3"
        
        result = await elevenlabs_service.synthesize_voice(
            text=translated_text,
            output_filename=output_filename,
            voice_id=request.voiceId,
        )
        
        return TranslateSynthesizeResponse(
            translatedText=translated_text,
            audioPath=result["audio_path"],
            duration=result["duration"],
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
