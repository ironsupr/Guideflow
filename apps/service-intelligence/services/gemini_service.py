"""
Gemini AI Service - Text refinement and translation
"""

import json
from typing import List, Dict, Any, Optional

import google.generativeai as genai

from config import settings


# Enhanced system prompt for creating human-like, presentable tutorial scripts
REFINEMENT_SYSTEM_PROMPT = """You are a master tutorial creator and professional video scriptwriter. Your expertise is transforming raw, imperfect recordings into polished, engaging, and highly presentable tutorial videos that feel natural and human.

CONTEXT:
- The user has recorded themselves demonstrating software/product features
- You receive their raw spoken words (often with "um", "uh", filler words, repetitions, pauses)
- You receive DOM events showing exactly what they're clicking and interacting with
- Your goal is to create a script that sounds like a professional, friendly expert guiding viewers

YOUR MISSION:
Transform awkward, imperfect recordings into smooth, engaging, professional tutorials that viewers actually WANT to watch.

SCRIPT REQUIREMENTS:
1. **Natural Flow**: Write conversationally, like you're sitting next to the viewer helping them
2. **Human Touch**: Include friendly transitions, encouragement, and relatable explanations
3. **Professional Polish**: Clear, concise instructions without being robotic
4. **Contextual Awareness**: Reference what the user is actually doing on screen
5. **Engaging Language**: Use active voice, varied sentence structure, and natural pacing
6. **Educational Value**: Explain WHY steps matter, not just WHAT to do
7. **Smooth Transitions**: Connect ideas naturally, anticipate user questions
8. **Encouraging Tone**: Make users feel capable and excited to learn

SCRIPT STRUCTURE:
- **Opening**: Warm welcome, overview of what they'll accomplish
- **Body**: Step-by-step guidance with context and explanations
- **Transitions**: Smooth connections between concepts
- **Closing**: Summary, encouragement, next steps

VOICE CHARACTERISTICS:
- Friendly and approachable (not corporate/formal)
- Knowledgeable but not condescending
- Patient and encouraging
- Conversational rhythm with varied pacing
- Natural pauses and emphasis points

EXAMPLES OF TRANSFORMATION:

BEFORE (Raw): "Um, so now I'm gonna click this button here, uh, the blue one"
AFTER (Polished): "Perfect! Now let's click that bright blue button right here. This is where the magic happens - it opens up all the customization options we'll need."

BEFORE (Raw): "Okay, so you type in your name"
AFTER (Polished): "Great! Now go ahead and type in your name. Feel free to use your real name or whatever you'd prefer to go by."

BEFORE (Raw): "And then it saves automatically"
AFTER (Polished): "And just like that, everything saves automatically in the background. No need to worry about losing your work!"

OUTPUT FORMAT:
Return a JSON object with:
{
    "refined_text": "The complete polished script as one flowing narrative",
    "instructions": [
        {
            "text": "Individual actionable step",
            "start_time": 0.0,
            "end_time": 3.5,
            "dom_event_index": 0,
            "context": "Additional context about why this step matters"
        }
    ],
    "script_metadata": {
        "tone": "friendly_professional",
        "pace": "conversational",
        "target_audience": "beginners_intermediate",
        "estimated_duration": 45
    }
}

Remember: You're not just cleaning up speech - you're creating an engaging, human experience that makes complex tasks feel approachable and enjoyable."""


class GeminiService:
    """Service for interacting with Google Gemini AI"""
    
    def __init__(self):
        self.configured = False
        self.model = None
        
        if settings.gemini_api_key:
            genai.configure(api_key=settings.gemini_api_key)
            self.model = genai.GenerativeModel(settings.gemini_model)
            self.configured = True
            print(f"✅ Gemini configured with model: {settings.gemini_model}")
        else:
            print("⚠️  Gemini API key not configured")
    
    async def refine_transcript(
        self,
        raw_transcript: str,
        dom_events: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Refine a raw transcript using Gemini AI
        
        Args:
            raw_transcript: The raw spoken words from the user
            dom_events: List of DOM events (clicks, etc.) captured during recording
            
        Returns:
            Dictionary with refined_text and instructions
        """
        if not self.configured:
            # Return mock data if not configured
            return self._mock_refinement(raw_transcript, dom_events)
        
        # Build the prompt with enhanced context
        dom_context = self._format_dom_events_enhanced(dom_events)
        transcript_analysis = self._analyze_transcript(raw_transcript)

        prompt = f"""{REFINEMENT_SYSTEM_PROMPT}

---
RAW TRANSCRIPT:
{raw_transcript}

---
TRANSCRIPT ANALYSIS:
{transcript_analysis}

---
DOM EVENTS (user interactions on screen):
{dom_context}

---
INSTRUCTIONS:
1. Analyze what the user is demonstrating based on their speech and actions
2. Create a flowing, engaging script that feels natural and human
3. Match instructions to DOM events where they align with user actions
4. Add context and explanations that make the tutorial more valuable
5. Use conversational language that guides viewers through the experience
6. Include smooth transitions and encouraging language

Return ONLY valid JSON with the specified format. No markdown code blocks or explanations.
"""
        
        try:
            response = self.model.generate_content(prompt)
            result_text = response.text.strip()
            
            # Clean up response (remove markdown if present)
            if result_text.startswith("```"):
                result_text = result_text.split("```")[1]
                if result_text.startswith("json"):
                    result_text = result_text[4:]
            
            # Parse JSON response
            result = json.loads(result_text)

            return {
                "refined_text": result.get("refined_text", raw_transcript),
                "instructions": result.get("instructions", []),
                "script_metadata": result.get("script_metadata", {
                    "tone": "professional",
                    "pace": "standard",
                    "target_audience": "general",
                    "estimated_duration": len(raw_transcript.split()) * 0.5
                }),
            }
            
        except json.JSONDecodeError as e:
            print(f"⚠️  Failed to parse Gemini response as JSON: {e}")
            return self._mock_refinement(raw_transcript, dom_events)
            
        except Exception as e:
            print(f"❌ Gemini API error: {e}")
            return self._mock_refinement(raw_transcript, dom_events)
    
    async def translate_text(
        self,
        text: str,
        target_language: str,
    ) -> str:
        """
        Translate text to a target language
        
        Args:
            text: The text to translate
            target_language: Target language (e.g., "Spanish", "French", "German")
            
        Returns:
            Translated text
        """
        if not self.configured:
            return f"[Translation to {target_language}]: {text}"
        
        prompt = f"""Translate the following tutorial text to {target_language}.
Keep the professional tone and technical accuracy.
Return ONLY the translated text, nothing else.

Text to translate:
{text}
"""
        
        try:
            response = self.model.generate_content(prompt)
            return response.text.strip()
            
        except Exception as e:
            print(f"❌ Translation error: {e}")
            return text
    
    def _format_dom_events_enhanced(self, dom_events: List[Dict[str, Any]]) -> str:
        """Format DOM events with enhanced context for better script generation"""
        if not dom_events:
            return "No user interactions captured during recording"

        formatted = ["USER INTERACTIONS CAPTURED:"]
        for i, event in enumerate(dom_events):
            event_type = event.get("type", "unknown")
            target = event.get("target", {})
            timestamp = event.get("timestamp", 0)

            # Extract comprehensive target information
            tag = target.get("tag", "")
            text = target.get("text", "").strip()
            element_id = target.get("id", "")
            classes = target.get("classes", [])
            placeholder = target.get("placeholder", "")
            href = target.get("href", "")

            # Create human-readable description
            if event_type == "click":
                if text:
                    description = f"Clicked '{text}' ({tag})"
                elif placeholder:
                    description = f"Clicked input field '{placeholder}' ({tag})"
                elif element_id:
                    description = f"Clicked element with ID '{element_id}' ({tag})"
                else:
                    description = f"Clicked {tag} element"

            elif event_type == "input":
                if placeholder:
                    description = f"Typed in '{placeholder}' field"
                elif text:
                    description = f"Entered text in '{text}' field"
                else:
                    description = f"Typed in input field"

            elif event_type == "scroll":
                description = "Scrolled through content"

            elif event_type == "focus":
                if text:
                    description = f"Focused on '{text}' ({tag})"
                else:
                    description = f"Focused on {tag} element"

            else:
                description = f"{event_type.upper()} interaction with {tag}"

            # Add timing and additional context
            time_seconds = timestamp / 1000
            formatted.append(".1f")

        return "\n".join(formatted)

    def _analyze_transcript(self, raw_transcript: str) -> str:
        """Analyze the raw transcript for context and intent"""
        analysis = ["TRANSCRIPT ANALYSIS:"]

        # Basic metrics
        word_count = len(raw_transcript.split())
        filler_words = sum(1 for word in raw_transcript.lower().split()
                          if word in ['um', 'uh', 'like', 'you know', 'so', 'well'])

        analysis.append(f"- Total words: {word_count}")
        analysis.append(f"- Filler words detected: {filler_words}")

        # Detect common patterns
        if any(word in raw_transcript.lower() for word in ['click', 'press', 'tap']):
            analysis.append("- Contains interaction instructions")
        if any(word in raw_transcript.lower() for word in ['now', 'next', 'then', 'after']):
            analysis.append("- Sequential workflow detected")
        if any(word in raw_transcript.lower() for word in ['here', 'this', 'that']):
            analysis.append("- References visual elements on screen")
        if any(word in raw_transcript.lower() for word in ['let me', 'i\'ll', 'we\'re']):
            analysis.append("- Demonstrative language (showing how to do something)")

        # Detect tone and style
        if any(word in raw_transcript.lower() for word in ['easy', 'simple', 'quick', 'fast']):
            analysis.append("- Emphasizes ease of use")
        if any(word in raw_transcript.lower() for word in ['important', 'remember', 'note']):
            analysis.append("- Includes important tips/warnings")

        return "\n".join(analysis)
    
    def _mock_refinement(
        self,
        raw_transcript: str,
        dom_events: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Generate mock refinement when Gemini is not configured"""
        # Simple cleanup
        refined = raw_transcript.replace(" um ", " ").replace(" uh ", " ")
        refined = refined.replace("Um, ", "").replace("Uh, ", "")
        refined = refined.strip()
        
        # Generate basic instructions from DOM events
        instructions = []
        for i, event in enumerate(dom_events):
            if event.get("type") == "click":
                target = event.get("target", {})
                text = target.get("text", "element")
                timestamp = event.get("timestamp", i * 2000)
                
                instructions.append({
                    "text": f"Click on '{text}'",
                    "start_time": timestamp / 1000,
                    "end_time": (timestamp + 2000) / 1000,
                    "dom_event_index": i,
                })
        
        return {
            "refined_text": refined if refined else "Welcome to this tutorial! Let's walk through the steps together to help you get started.",
            "instructions": instructions,
            "script_metadata": {
                "tone": "friendly_professional",
                "pace": "conversational",
                "target_audience": "beginners",
                "estimated_duration": len(raw_transcript.split()) * 0.4
            },
        }
