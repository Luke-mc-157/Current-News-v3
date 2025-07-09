// Service for ElevenLabs voice synthesis
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ElevenLabs API configuration
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

// Curated voice options based on ElevenLabs premium voices
export const VOICE_OPTIONS = [
  { id: 'nPczCjzI2devNBz1zQrb', name: 'Bryan - Professional Narrator', description: 'Warm and confident American male voice, perfect for news and educational content' },
  { id: '9BWtsMINqrJLrRacOk9x', name: 'Aria', description: 'Clear American female voice' },
  { id: 'pqHfZKP75CvOlQylNhV4', name: 'Bill', description: 'Friendly American male voice' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', description: 'Professional female voice' },
  { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', description: 'Crisp American male voice' }
];

// Get available voices from ElevenLabs
export async function getAvailableVoices() {
  if (!ELEVENLABS_API_KEY) {
    console.warn("ElevenLabs API key not set, returning default voices");
    return VOICE_OPTIONS;
  }
  
  try {
    const response = await fetch(`${ELEVENLABS_API_URL}/voices`, {
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY
      }
    });
    
    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.voices.map(voice => ({
      id: voice.voice_id,
      name: voice.name,
      description: voice.labels ? Object.values(voice.labels).join(', ') : voice.description
    }));
  } catch (error) {
    console.error("Error fetching ElevenLabs voices:", error.message);
    return VOICE_OPTIONS;
  }
}

// Generate audio from text  
export async function generateAudio(text, voiceId = 'nPczCjzI2devNBz1zQrb', episodeId) {
  if (!ELEVENLABS_API_KEY) {
    throw new Error("ElevenLabs API key not set. Please add ELEVENLABS_API_KEY to your secrets.");
  }
  
  try {
    console.log(`Generating audio with voice ${voiceId} for ${text.length} characters...`);
    
    const response = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5
        }
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ElevenLabs API error: ${response.statusText} - ${error}`);
    }
    
    // Save audio file
    const audioBuffer = await response.arrayBuffer();
    const audioDir = path.join(__dirname, '..', '..', 'podcast-audio');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }
    
    const filename = `podcast-${episodeId}-${Date.now()}.mp3`;
    const filepath = path.join(audioDir, filename);
    
    fs.writeFileSync(filepath, Buffer.from(audioBuffer));
    console.log(`Audio saved to ${filepath}`);
    
    // Return relative path for web access
    return `/podcast-audio/${filename}`;
  } catch (error) {
    console.error("Error generating audio:", error.message);
    throw error;
  }
}

// Combine multiple audio segments into one file
export async function combineAudioSegments(segmentPaths, episodeId) {
  // For now, we'll return the first segment
  // In production, you'd use ffmpeg or similar to combine audio files
  console.log(`Note: Audio combination not implemented. Using first segment only.`);
  return segmentPaths[0];
}

// Check ElevenLabs usage/quota
export async function checkQuota() {
  if (!ELEVENLABS_API_KEY) {
    return { available: false, message: "API key not set" };
  }
  
  try {
    const response = await fetch(`${ELEVENLABS_API_URL}/user`, {
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY
      }
    });
    
    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    const subscription = data.subscription;
    
    return {
      available: true,
      character_count: subscription.character_count,
      character_limit: subscription.character_limit,
      remaining: subscription.character_limit - subscription.character_count
    };
  } catch (error) {
    console.error("Error checking ElevenLabs quota:", error.message);
    return { available: false, message: error.message };
  }
}