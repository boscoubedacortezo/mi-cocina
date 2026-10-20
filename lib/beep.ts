/**
 * A WAV file made in code: a soft chime, as a data URL for an <audio> element. iPhones play
 * a normal <audio> element once it has been started by a tap, which is not the case for
 * sound generated on the fly.
 */
const SAMPLE_RATE = 22_050;

function wav(samples: Float32Array) {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) =>
    [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, i) => view.setInt16(44 + i * 2, Math.round(sample * 32767), true));
  return bytes;
}

function dataUrl(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

/** A soft rising chime: C, E, G, C, each note a bell-like tone (a sine with two quiet overtones) that fades out by itself. */
export const CHIME_NOTES = [523.25, 659.25, 783.99, 1046.5];
const NOTE_GAP = 0.3;
const NOTE_LENGTH = 1.1;

export function beepSamples(volume = 0.5) {
  const total = Math.round(SAMPLE_RATE * (NOTE_GAP * (CHIME_NOTES.length - 1) + NOTE_LENGTH));
  const samples = new Float32Array(total);
  CHIME_NOTES.forEach((frequency, n) => {
    const start = Math.round(SAMPLE_RATE * NOTE_GAP * n);
    const length = Math.round(SAMPLE_RATE * NOTE_LENGTH);
    for (let i = 0; i < length && start + i < total; i++) {
      const t = i / SAMPLE_RATE;
      const attack = Math.min(1, t / 0.008);
      const body =
        Math.sin(2 * Math.PI * frequency * t) * Math.exp(-t * 4.2) +
        0.3 * Math.sin(2 * Math.PI * frequency * 2 * t) * Math.exp(-t * 7) +
        0.1 * Math.sin(2 * Math.PI * frequency * 3 * t) * Math.exp(-t * 11);
      samples[start + i] += body * attack * volume * 0.5;
    }
  });
  // The notes overlap: keep the sum below clipping.
  const peak = samples.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
  if (peak > 0.85) for (let i = 0; i < samples.length; i++) samples[i] *= 0.85 / peak;
  return samples;
}

export const beepWavBytes = () => wav(beepSamples());
export const beepDataUrl = () => dataUrl(beepWavBytes());
/** Almost silent, to be played inside a tap so the element is allowed to play later. */
export const unlockDataUrl = () => dataUrl(wav(new Float32Array(Math.round(SAMPLE_RATE * 0.1))));
