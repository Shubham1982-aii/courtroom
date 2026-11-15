// Web Audio API procedural sound synthesizer (Zero external asset dependencies)
let ctx = null;

function getAudioContext() {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    ctx = new AudioCtx();
  }
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

export function playSound(name) {
  try {
    const audio = getAudioContext();
    const now = audio.currentTime;

    if (name === 'gavel') {
      // Powerful wooden thud & resonant crack
      const osc1 = audio.createOscillator();
      const osc2 = audio.createOscillator();
      const gain = audio.createGain();

      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(130, now);
      osc1.frequency.exponentialRampToValueAtTime(35, now + 0.18);

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(80, now);
      osc2.frequency.exponentialRampToValueAtTime(20, now + 0.35);

      gain.gain.setValueAtTime(0.8, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(audio.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.35);
      osc2.stop(now + 0.35);

      // Repeat second thud 180ms later for double gavel strike
      setTimeout(() => {
        try {
          const t2 = audio.currentTime;
          const o1 = audio.createOscillator();
          const g1 = audio.createGain();
          o1.type = 'triangle';
          o1.frequency.setValueAtTime(140, t2);
          o1.frequency.exponentialRampToValueAtTime(30, t2 + 0.2);
          g1.gain.setValueAtTime(0.9, t2);
          g1.gain.exponentialRampToValueAtTime(0.01, t2 + 0.25);
          o1.connect(g1);
          g1.connect(audio.destination);
          o1.start(t2);
          o1.stop(t2 + 0.25);
        } catch {}
      }, 160);
    } else if (name === 'objection') {
      // Dramatic brassy chord hit
      const freqs = [220, 277.18, 329.63, 440]; // A major dissonant chord
      freqs.forEach((f, i) => {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f, now);
        osc.frequency.exponentialRampToValueAtTime(f * 0.9, now + 0.6);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

        osc.connect(gain);
        gain.connect(audio.destination);

        osc.start(now);
        osc.stop(now + 0.65);
      });
    } else if (name === 'bell') {
      // Clean high chime
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now); // A5

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      osc.connect(gain);
      gain.connect(audio.destination);

      osc.start(now);
      osc.stop(now + 1.2);
    } else if (name === 'vote') {
      // Tactile wooden tick
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.05);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

      osc.connect(gain);
      gain.connect(audio.destination);

      osc.start(now);
      osc.stop(now + 0.05);
    }
  } catch (e) {
    // Audio autoplay restrictions or context error
  }
}
