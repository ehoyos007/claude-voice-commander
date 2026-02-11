/**
 * TTS Routes - Generate and serve audio files
 * 
 * Eliminates Supabase upload latency by serving audio directly
 */

import { Hono } from 'hono';
import { randomUUID } from 'crypto';

const app = new Hono();

// In-memory audio cache (with TTL)
const audioCache = new Map<string, { data: Buffer; expiresAt: number }>();

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '3sfGn775ryaDXhFWHwBg';

// Clean up expired audio every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [id, audio] of audioCache) {
    if (audio.expiresAt < now) {
      audioCache.delete(id);
    }
  }
}, 60000);

// Generate audio and return a URL to fetch it
app.post('/generate', async (c) => {
  const { text } = await c.req.json();
  
  if (!text) {
    return c.json({ error: 'Missing text' }, 400);
  }
  
  console.log(`[TTS] Generating audio for: "${text.slice(0, 50)}..."`);
  const startTime = Date.now();
  
  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      console.error(`[TTS] ElevenLabs error: ${error}`);
      return c.json({ error: 'TTS generation failed' }, 500);
    }
    
    const audioBuffer = Buffer.from(await response.arrayBuffer());
    const audioId = randomUUID();
    
    // Cache for 5 minutes
    audioCache.set(audioId, {
      data: audioBuffer,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });
    
    const elapsed = Date.now() - startTime;
    console.log(`[TTS] Generated ${audioBuffer.length} bytes in ${elapsed}ms`);
    
    // Return URL to fetch the audio
    const host = c.req.header('host') || 'localhost:3000';
    const protocol = c.req.header('x-forwarded-proto') || 'http';
    const audioUrl = `${protocol}://${host}/tts/audio/${audioId}.mp3`;
    
    return c.json({ 
      audioUrl,
      audioId,
      duration: elapsed,
      size: audioBuffer.length 
    });
    
  } catch (error) {
    console.error('[TTS] Error:', error);
    return c.json({ error: 'TTS generation failed' }, 500);
  }
});

// Serve cached audio
app.get('/audio/:id', (c) => {
  const id = c.req.param('id').replace('.mp3', '');
  const audio = audioCache.get(id);
  
  if (!audio) {
    return c.json({ error: 'Audio not found or expired' }, 404);
  }
  
  return new Response(audio.data, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Length': audio.data.length.toString(),
      'Cache-Control': 'public, max-age=300',
    },
  });
});

export default app;
