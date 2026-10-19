/**
 * A WAV file made in code: three beeps, as a data URL for an <audio> element. iPhones play
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

/** Tone bursts with gaps, with a short fade so they do not click. */
export function beepSamples(beeps: number, frequency = 880, volume = 0.6) {
  const burst = Math.round(SAMPLE_RATE * 0.22);
  const gap = Math.round(SAMPLE_RATE * 0.16);
  const samples = new Float32Array(beeps * (burst + gap));
  for (let b = 0; b < beeps; b++) {
    for (let i = 0; i < burst; i++) {
      const fade = Math.min(1, i / 400, (burst - i) / 400);
      samples[b * (burst + gap) + i] =
        Math.sign(Math.sin((2 * Math.PI * frequency * i) / SAMPLE_RATE)) * volume * 0.5 * fade;
    }
  }
  return samples;
}

export const beepWavBytes = (beeps = 3) => wav(beepSamples(beeps));
export const beepDataUrl = (beeps = 3) => dataUrl(beepWavBytes(beeps));
/** Almost silent, to be played inside a tap so the element is allowed to play later. */
export const unlockDataUrl = () => dataUrl(wav(new Float32Array(Math.round(SAMPLE_RATE * 0.1))));
