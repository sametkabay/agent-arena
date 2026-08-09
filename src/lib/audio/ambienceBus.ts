/**
 * Royalty-free ambient audio via Web Audio API synthesis only.
 * No samples / third-party audio files — fully generated noise + oscillators.
 */
import type { AmbienceId } from "@/lib/maps/ambience";
import type { DayNightMode } from "@/lib/dayNight";

type BusState = {
  ctx: AudioContext | null;
  master: GainNode | null;
  nodes: AudioNode[];
  timers: number[];
  profile: AmbienceId;
  enabled: boolean;
  volume: number;
  dayNight: DayNightMode;
  started: boolean;
};

const state: BusState = {
  ctx: null,
  master: null,
  nodes: [],
  timers: [],
  profile: "none",
  enabled: true,
  volume: 0.35,
  dayNight: "day",
  started: false,
};

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!state.ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    state.ctx = new AC();
    state.master = state.ctx.createGain();
    state.master.gain.value = 0;
    state.master.connect(state.ctx.destination);
  }
  return state.ctx;
}

function clearGraph() {
  for (const t of state.timers) window.clearInterval(t);
  state.timers = [];
  for (const n of state.nodes) {
    try {
      n.disconnect();
    } catch {
      /* ignore */
    }
  }
  state.nodes = [];
}

function noiseBuffer(ctx: AudioContext, seconds = 2): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    // Brown-ish noise (gentler than white)
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }
  return buf;
}

function makeNoiseSource(
  ctx: AudioContext,
  filterType: BiquadFilterType,
  freq: number,
  q: number,
  gain: number,
): { source: AudioBufferSourceNode; gainNode: GainNode } {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx, 2.5);
  source.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const gainNode = ctx.createGain();
  gainNode.gain.value = gain;
  source.connect(filter);
  filter.connect(gainNode);
  state.nodes.push(source, filter, gainNode);
  return { source, gainNode };
}

function makeTone(
  ctx: AudioContext,
  type: OscillatorType,
  freq: number,
  gain: number,
): { osc: OscillatorNode; gainNode: GainNode } {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const gainNode = ctx.createGain();
  gainNode.gain.value = gain;
  osc.connect(gainNode);
  state.nodes.push(osc, gainNode);
  return { osc, gainNode };
}

function nightMul(): number {
  return state.dayNight === "night" ? 0.72 : 1;
}

function buildProfile(profile: AmbienceId) {
  const ctx = state.ctx;
  const master = state.master;
  if (!ctx || !master || profile === "none") return;

  const nm = nightMul();

  if (profile === "nature") {
    const wind = makeNoiseSource(ctx, "lowpass", 420, 0.7, 0.12 * nm);
    wind.gainNode.connect(master);
    wind.source.start();

    const leaves = makeNoiseSource(ctx, "bandpass", 1800, 0.9, 0.045 * nm);
    leaves.gainNode.connect(master);
    leaves.source.start();

    // Soft bird-like chirps (day only) — short sine blips, not recordings
    if (state.dayNight === "day") {
      const timer = window.setInterval(() => {
        if (!state.ctx || state.profile !== "nature" || state.dayNight !== "day") return;
        const c = state.ctx;
        const m = state.master;
        if (!c || !m) return;
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = "sine";
        const f0 = 2200 + Math.random() * 1400;
        osc.frequency.setValueAtTime(f0, c.currentTime);
        osc.frequency.exponentialRampToValueAtTime(f0 * 1.35, c.currentTime + 0.08);
        g.gain.setValueAtTime(0.0001, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.03, c.currentTime + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.14);
        osc.connect(g);
        g.connect(m);
        osc.start();
        osc.stop(c.currentTime + 0.16);
      }, 2800 + Math.random() * 2200);
      state.timers.push(timer);
    }

    // Night cricket-ish pulse (filtered noise ticks)
    if (state.dayNight === "night") {
      const timer = window.setInterval(() => {
        if (!state.ctx || state.profile !== "nature") return;
        const c = state.ctx;
        const m = state.master;
        if (!c || !m) return;
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = "triangle";
        osc.frequency.value = 4800 + Math.random() * 600;
        g.gain.setValueAtTime(0.0001, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.018, c.currentTime + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.05);
        osc.connect(g);
        g.connect(m);
        osc.start();
        osc.stop(c.currentTime + 0.06);
      }, 180);
      state.timers.push(timer);
    }
    return;
  }

  if (profile === "office") {
    const hvac = makeNoiseSource(ctx, "lowpass", 280, 0.5, 0.09 * nm);
    hvac.gainNode.connect(master);
    hvac.source.start();
    const hum = makeTone(ctx, "sine", 58, 0.012 * nm);
    hum.gainNode.connect(master);
    hum.osc.start();
    const hum2 = makeTone(ctx, "sine", 116, 0.006 * nm);
    hum2.gainNode.connect(master);
    hum2.osc.start();
    return;
  }

  if (profile === "factory") {
    const drone = makeNoiseSource(ctx, "lowpass", 180, 0.4, 0.11 * nm);
    drone.gainNode.connect(master);
    drone.source.start();
    const motor = makeTone(ctx, "sawtooth", 42, 0.008 * nm);
    const motorFilter = ctx.createBiquadFilter();
    motorFilter.type = "lowpass";
    motorFilter.frequency.value = 220;
    motor.osc.connect(motorFilter);
    motorFilter.connect(motor.gainNode);
    motor.gainNode.connect(master);
    motor.osc.start();
    state.nodes.push(motorFilter);

    // Occasional soft clank (synth, not sample)
    const timer = window.setInterval(() => {
      if (!state.ctx || state.profile !== "factory") return;
      if (Math.random() > 0.35) return;
      const c = state.ctx;
      const m = state.master;
      if (!c || !m) return;
      const osc = c.createOscillator();
      const g = c.createGain();
      const f = c.createBiquadFilter();
      osc.type = "square";
      osc.frequency.value = 90 + Math.random() * 40;
      f.type = "bandpass";
      f.frequency.value = 400;
      f.Q.value = 4;
      g.gain.setValueAtTime(0.0001, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.04, c.currentTime + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.22);
      osc.connect(f);
      f.connect(g);
      g.connect(m);
      osc.start();
      osc.stop(c.currentTime + 0.25);
    }, 4500);
    state.timers.push(timer);
    return;
  }

  if (profile === "mars") {
    const wind = makeNoiseSource(ctx, "bandpass", 220, 0.55, 0.08 * nm);
    wind.gainNode.connect(master);
    wind.source.start();

    // Thin beacon ping
    const timer = window.setInterval(() => {
      if (!state.ctx || state.profile !== "mars") return;
      const c = state.ctx;
      const m = state.master;
      if (!c || !m) return;
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, c.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, c.currentTime + 0.35);
      g.gain.setValueAtTime(0.0001, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.035 * nm, c.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.4);
      osc.connect(g);
      g.connect(m);
      osc.start();
      osc.stop(c.currentTime + 0.45);
    }, 3200);
    state.timers.push(timer);
  }
}

function applyMasterGain() {
  if (!state.master || !state.ctx) return;
  const target =
    state.enabled && state.profile !== "none" ? state.volume : 0;
  state.master.gain.cancelScheduledValues(state.ctx.currentTime);
  state.master.gain.linearRampToValueAtTime(
    target,
    state.ctx.currentTime + 0.35,
  );
}

function rebuild() {
  clearGraph();
  if (!state.enabled || state.profile === "none") {
    applyMasterGain();
    return;
  }
  buildProfile(state.profile);
  applyMasterGain();
}

/** Call from a user gesture (or after first interaction) so AudioContext can start. */
export async function unlockAmbience(): Promise<void> {
  const ctx = ensureCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      /* autoplay policy */
    }
  }
  if (!state.started) {
    state.started = true;
    rebuild();
  }
}

export function setAmbienceProfile(profile: AmbienceId) {
  ensureCtx();
  if (state.profile === profile) {
    applyMasterGain();
    return;
  }
  state.profile = profile;
  if (state.started) rebuild();
}

export function setAmbienceDayNight(mode: DayNightMode) {
  if (state.dayNight === mode) return;
  state.dayNight = mode;
  if (state.started) rebuild();
}

export function setAmbienceEnabled(enabled: boolean) {
  state.enabled = enabled;
  ensureCtx();
  if (state.started) rebuild();
  else applyMasterGain();
}

export function setAmbienceVolume(volume: number) {
  state.volume = Math.min(1, Math.max(0, volume));
  applyMasterGain();
}

export function getAmbienceState() {
  return {
    enabled: state.enabled,
    volume: state.volume,
    profile: state.profile,
    dayNight: state.dayNight,
  };
}
