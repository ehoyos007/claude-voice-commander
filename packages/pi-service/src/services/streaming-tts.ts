/**
 * Streaming TTS Bridge
 * 
 * Streams ElevenLabs audio to Telnyx call in real-time
 */

import WebSocket from 'ws';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '3sfGn775ryaDXhFWHwBg';

interface StreamOptions {
  text: string;
  callControlId: string;
  telnyxWsUrl: string;
}

export async function streamTTSToCall(options: StreamOptions): Promise<void> {
  const { text, callControlId, telnyxWsUrl } = options;
  
  return new Promise((resolve, reject) => {
    // Connect to Telnyx WebSocket
    const telnyxWs = new WebSocket(telnyxWsUrl);
    
    telnyxWs.on('open', async () => {
      console.log(`[StreamTTS] Connected to Telnyx for call ${callControlId}`);
      
      try {
        // Stream from ElevenLabs
        const response = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream`,
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
              output_format: 'mp3_44100_128', // MP3 format for Telnyx
            }),
          }
        );
        
        if (!response.ok) {
          throw new Error(`ElevenLabs error: ${response.status}`);
        }
        
        // Stream chunks to Telnyx
        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');
        
        const chunks: Uint8Array[] = [];
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        
        // Combine chunks and send as base64 MP3
        const audioBuffer = Buffer.concat(chunks);
        const base64Audio = audioBuffer.toString('base64');
        
        // Send to Telnyx
        telnyxWs.send(JSON.stringify({
          event: 'media',
          media: {
            payload: base64Audio
          }
        }));
        
        console.log(`[StreamTTS] Sent ${audioBuffer.length} bytes to Telnyx`);
        
        // Wait a bit for playback to start, then close
        setTimeout(() => {
          telnyxWs.close();
          resolve();
        }, 500);
        
      } catch (error) {
        console.error('[StreamTTS] Error:', error);
        telnyxWs.close();
        reject(error);
      }
    });
    
    telnyxWs.on('error', (error) => {
      console.error('[StreamTTS] WebSocket error:', error);
      reject(error);
    });
  });
}

// Simpler approach: Use ElevenLabs streaming API with chunked response
export async function getStreamingAudioUrl(text: string): Promise<string> {
  // For now, return a direct URL approach
  // ElevenLabs doesn't provide direct URLs, so we need to generate and host
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
    throw new Error(`ElevenLabs error: ${response.status}`);
  }
  
  // Return audio as data URL (not ideal for large files but works)
  const audioBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(audioBuffer).toString('base64');
  return `data:audio/mpeg;base64,${base64}`;
}
