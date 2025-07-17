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
  { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice', description: 'ElevenLabs Alice voice' },
  { id: 'nPczCjzI2devNBz1zQrb', name: 'Bryan - Professional Narrator', description: 'Warm and confident American male voice, perfect for news and educational content' },
  { id: '9BWtsMINqrJLrRacOk9x', name: 'Aria', description: 'Clear American female voice' },
  { id: 'pqHfZKP75CvOlQylNhV4', name: 'Bill', description: 'Friendly American male voice' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', description: 'Professional female voice' },
  { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', description: 'Crisp American male voice' },
  { id: 'KTPVrSVAEUSJRClDzBw7', name: 'Cowboy Bob VF', description: 'Aged American Storyteller' },
  { id: 'yjJ45q8TVCrtMhEKurxY', name: 'Dr. Von Fusion VF', description: 'Quirky Mad Scientist' },
  { id: '1SM7GgM6IMuvQlz2BwM3', name: 'Mark - ConvoAI', description: 'ConvoAI voice' }
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
export async function generateAudio(text, voiceId = 'Xb7hH8MSUJpSbSDYk0k2', episodeId) {
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
        model_id: 'eleven_turbo_v2',
        voice_settings: {
          stability: 0.4,
          similarity_boost: 0.7, 
          speed: 1.1
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

// Combine multiple audio segments into one file using ffmpeg
export async function combineAudioSegments(segmentPaths, episodeId) {
  if (segmentPaths.length <= 1) {
    console.log(`Only ${segmentPaths.length} segment(s), no combination needed`);
    return segmentPaths[0];
  }

  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  try {
    console.log(`🔧 Combining ${segmentPaths.length} audio segments for episode ${episodeId}`);
    
    const audioDir = path.join(__dirname, '..', '..', 'podcast-audio');
    const combinedFilename = `podcast-${episodeId}-combined-${Date.now()}.mp3`;
    const combinedPath = path.join(audioDir, combinedFilename);
    
    // Convert relative paths to absolute paths for ffmpeg
    const absoluteSegmentPaths = segmentPaths.map(segPath => {
      return path.join(__dirname, '..', '..', segPath);
    });
    
    // Verify all segments exist
    for (const segPath of absoluteSegmentPaths) {
      if (!fs.existsSync(segPath)) {
        throw new Error(`Audio segment not found: ${segPath}`);
      }
    }
    
    // Create a temporary file list for ffmpeg concat
    const fileListPath = path.join(audioDir, `filelist-${episodeId}-${Date.now()}.txt`);
    const fileListContent = absoluteSegmentPaths
      .map(p => `file '${p.replace(/'/g, "'\"'\"'")}'`) // Escape single quotes
      .join('\n');
    
    fs.writeFileSync(fileListPath, fileListContent);
    
    // Use ffmpeg to concatenate audio files
    const ffmpegCommand = `ffmpeg -f concat -safe 0 -i "${fileListPath}" -c copy "${combinedPath}" -y`;
    
    console.log(`⏱️ Running ffmpeg: ${ffmpegCommand}`);
    const { stdout, stderr } = await execAsync(ffmpegCommand);
    
    if (stderr && !stderr.includes('size=')) { // ffmpeg often writes progress to stderr
      console.warn('FFmpeg stderr:', stderr);
    }
    
    // Clean up temporary file list
    fs.unlinkSync(fileListPath);
    
    // Verify the combined file was created
    if (!fs.existsSync(combinedPath)) {
      throw new Error('Combined audio file was not created');
    }
    
    const stats = fs.statSync(combinedPath);
    console.log(`✅ Combined audio created: ${combinedFilename} (${Math.round(stats.size / 1024)}KB)`);
    
    // Clean up individual segment files to save space
    for (const segPath of absoluteSegmentPaths) {
      try {
        fs.unlinkSync(segPath);
        console.log(`🗑️ Cleaned up segment: ${path.basename(segPath)}`);
      } catch (e) {
        console.warn(`Could not delete segment: ${segPath}`);
      }
    }
    
    // Return relative path for web access
    return `/podcast-audio/${combinedFilename}`;
    
  } catch (error) {
    console.error("Error combining audio segments:", error.message);
    console.warn("⚠️ Falling back to first segment only");
    return segmentPaths[0];
  }
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