import { Platform } from 'react-native';

// Safe dynamic loader for Expo Audio to prevent module evaluation crashes
let nativeCreateAudioPlayer: any = null;
try {
  const expoAudio = require('expo-audio');
  nativeCreateAudioPlayer = expoAudio.createAudioPlayer;
} catch {
  // Native audio module not bundled or unsupported on this platform
}

// Helper to encode PCM audio samples into a base64 WAV Data URI
function createWavDataUri(sampleRate: number, samples: Float32Array): string {
  const numSamples = samples.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, 'WAVE');

  // FMT sub-chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // SubChunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
  view.setUint16(22, 1, true); // NumChannels (1 = Mono)
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * 2, true); // ByteRate
  view.setUint16(32, 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample (16 bits)

  // DATA sub-chunk
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  // Write 16-bit PCM samples
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  // Convert ArrayBuffer to base64
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  const globalObj = typeof globalThis !== 'undefined' ? (globalThis as any) : {};
  const base64 =
    typeof btoa !== 'undefined'
      ? btoa(binary)
      : globalObj.Buffer
      ? globalObj.Buffer.from(binary, 'binary').toString('base64')
      : '';

  return `data:audio/wav;base64,${base64}`;
}

// Sound synthesizer presets
const SAMPLE_RATE = 22050;

function generateTapWav(): string {
  const duration = 0.08;
  const length = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE;
    const freq = 1400 - (i / length) * 600; // Liquid glass pop frequency sweep
    const env = Math.exp(-t * 50); // fast decay
    samples[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.4;
  }
  return createWavDataUri(SAMPLE_RATE, samples);
}

function generateSwooshWav(): string {
  const duration = 0.16;
  const length = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE;
    const freq = 350 + Math.sin((t / duration) * Math.PI) * 450;
    const env = Math.sin((t / duration) * Math.PI);
    samples[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.25;
  }
  return createWavDataUri(SAMPLE_RATE, samples);
}

function generateCatchWav(): string {
  const duration = 0.35;
  const length = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(length);
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 shimmer arpeggio
  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE;
    const noteIdx = Math.min(notes.length - 1, Math.floor((t / duration) * notes.length));
    const freq = notes[noteIdx];
    const env = Math.sin((t / duration) * Math.PI) * 0.4;
    const shimmer = Math.sin(2 * Math.PI * (freq * 2) * t) * 0.15;
    samples[i] = (Math.sin(2 * Math.PI * freq * t) + shimmer) * env;
  }
  return createWavDataUri(SAMPLE_RATE, samples);
}

function generateCoinWav(): string {
  const duration = 0.22;
  const length = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE;
    const freq = t < 0.08 ? 987.77 : 1318.51; // B5 to E6 chime
    const env = Math.exp(-t * 14);
    samples[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.35;
  }
  return createWavDataUri(SAMPLE_RATE, samples);
}

function generateRadarWav(): string {
  const duration = 0.25;
  const length = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE;
    const freq = 880;
    const env = Math.exp(-t * 12);
    samples[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.3;
  }
  return createWavDataUri(SAMPLE_RATE, samples);
}

function generateBattleWav(): string {
  const duration = 0.18;
  const length = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE;
    const freq = 180 - (i / length) * 90;
    const noise = (Math.random() * 2 - 1) * 0.2;
    const env = Math.exp(-t * 22);
    samples[i] = (Math.sin(2 * Math.PI * freq * t) + noise) * env * 0.5;
  }
  return createWavDataUri(SAMPLE_RATE, samples);
}

// Pre-cached URIs
let tapUri: string | null = null;
let swooshUri: string | null = null;
let catchUri: string | null = null;
let coinUri: string | null = null;
let radarUri: string | null = null;
let battleUri: string | null = null;

const getUri = (type: 'tap' | 'swoosh' | 'catch' | 'coin' | 'radar' | 'battle'): string => {
  if (type === 'tap') return (tapUri = tapUri || generateTapWav());
  if (type === 'swoosh') return (swooshUri = swooshUri || generateSwooshWav());
  if (type === 'catch') return (catchUri = catchUri || generateCatchWav());
  if (type === 'coin') return (coinUri = coinUri || generateCoinWav());
  if (type === 'radar') return (radarUri = radarUri || generateRadarWav());
  return (battleUri = battleUri || generateBattleWav());
};

// Generic safe sound player
const playSoundUri = async (uri: string) => {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && (window as any).Audio) {
        const audio = new (window as any).Audio(uri);
        audio.volume = 0.6;
        audio.play().catch(() => {});
      }
    } else if (nativeCreateAudioPlayer) {
      const player = nativeCreateAudioPlayer(uri);
      player.play();
    }
  } catch {
    // Gracefully handle if audio context is blocked or unavailable
  }
};

export const playTapSound = () => playSoundUri(getUri('tap'));
export const playSwooshSound = () => playSoundUri(getUri('swoosh'));
export const playCatchSound = () => playSoundUri(getUri('catch'));
export const playCoinSound = () => playSoundUri(getUri('coin'));
export const playRadarSound = () => playSoundUri(getUri('radar'));
export const playBattleSound = () => playSoundUri(getUri('battle'));

