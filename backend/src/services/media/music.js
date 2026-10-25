/** Small synthesized upbeat loop (no files, no licences): kick, hat, bass, pad and a plucky arpeggio. Returns a 16-bit mono WAV. */
export function makeMusic(seconds, { bpm = 108, rate = 32000 } = {}) {
  const n = Math.ceil(seconds * rate);
  const out = new Float32Array(n);
  const beat = 60 / bpm;
  const roots = [220.0, 174.61, 261.63, 196.0]; // A3 F3 C4 G3 (one chord per bar)
  const chords = [[0, 3, 7], [0, 4, 7], [0, 4, 7], [0, 4, 7]]; // minor, major, major, major
  const minorFirst = [[0, 3, 7], [0, 4, 7], [0, 4, 7], [0, 4, 7]];
  const hz = (f, st) => f * 2 ** (st / 12);
  let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
  let hp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const barLen = beat * 4;
    const bar = Math.floor(t / barLen) % 4;
    const tb = (t % beat) / beat; // 0..1 within a beat
    const tIn = t % beat;
    const root = roots[bar]; const ch = minorFirst[bar] || chords[bar];
    let s = 0;
    // kick on every beat
    s += Math.sin(2 * Math.PI * (45 * tIn + 90 * (1 - Math.exp(-tIn * 28)) / 28 * 0 + 130 * (1 - Math.exp(-tIn * 30)) / 30)) * Math.exp(-tIn * 11) * 0.9;
    // hat on off-beats
    const th = (t + beat / 2) % beat; const nz = rnd(); const hi = nz - hp; hp = nz;
    s += hi * Math.exp(-th * 55) * 0.16;
    // bass on eighth notes
    const te = t % (beat / 2); const bf = root / 2;
    s += Math.sin(2 * Math.PI * bf * t) * Math.exp(-te * 5) * 0.34 * (Math.floor(t / (beat / 2)) % 2 ? 0.7 : 1);
    // pad
    for (const st of ch) s += Math.sin(2 * Math.PI * hz(root, st) * t) * 0.045;
    // arpeggio on sixteenth notes
    const six = beat / 4; const ta = t % six; const idx = Math.floor(t / six) % 4;
    const af = hz(root * 2, [ch[0], ch[1], ch[2], ch[1] + 12][idx]);
    const ph = 2 * Math.PI * af * t;
    s += (Math.sin(ph) + 0.35 * Math.sin(2 * ph)) * Math.exp(-ta * 14) * 0.13;
    out[i] = Math.tanh(s * 1.1);
  }
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(out[i] * 30000))), 44 + i * 2);
  return buf;
}
