import type { MapTheme } from "@/lib/maps/schema";

export type DayNightMode = "day" | "night";

export function isDayNightMode(v: unknown): v is DayNightMode {
  return v === "day" || v === "night";
}

export interface SceneLighting {
  background: string;
  fog: string;
  ambient: string;
  hemiSky: string;
  hemiGround: string;
  sun: string;
  ambientIntensity: number;
  hemiIntensity: number;
  sunIntensity: number;
  sunPosition: [number, number, number];
  /** Soft fill for night (false stars / sky glow). */
  fillIntensity: number;
  fillColor: string;
  fillPosition: [number, number, number];
  /** 0 = day, 1 = night — for fog pulse / sky opacity. */
  nightAmount: number;
}

/** Map theme → day/night lighting for the arena / editor scene. */
export function resolveSceneLighting(
  theme: MapTheme,
  mode: DayNightMode,
): SceneLighting {
  if (mode === "day") {
    return {
      background: theme.background,
      fog: theme.fog,
      ambient: theme.ambient,
      hemiSky: theme.hemiSky,
      hemiGround: theme.hemiGround,
      sun: theme.sun,
      ambientIntensity: 0.55,
      hemiIntensity: 0.55,
      sunIntensity: 1.15,
      sunPosition: [8, 14, 6],
      fillIntensity: 0,
      fillColor: "#ffffff",
      fillPosition: [0, 8, 0],
      nightAmount: 0,
    };
  }

  return {
    background: mixHex(theme.background, "#0a1020", 0.72),
    fog: mixHex(theme.fog, "#0c1424", 0.68),
    ambient: mixHex(theme.ambient, "#8a96b0", 0.38),
    hemiSky: mixHex(theme.hemiSky, "#243456", 0.55),
    hemiGround: mixHex(theme.hemiGround, "#2a2630", 0.48),
    sun: "#c5d4ff",
    ambientIntensity: 0.42,
    hemiIntensity: 0.48,
    sunIntensity: 0.36,
    sunPosition: [-6, 10, -8],
    fillIntensity: 0.38,
    fillColor: "#9aabd4",
    fillPosition: [0, 7, 0],
    nightAmount: 1,
  };
}

/** Smooth blend between day and night lighting (t = 0 day → 1 night). */
export function lerpSceneLighting(
  theme: MapTheme,
  t: number,
): SceneLighting {
  const u = Math.min(1, Math.max(0, t));
  if (u <= 0.001) return resolveSceneLighting(theme, "day");
  if (u >= 0.999) return resolveSceneLighting(theme, "night");
  const day = resolveSceneLighting(theme, "day");
  const night = resolveSceneLighting(theme, "night");
  return {
    background: mixHex(day.background, night.background, u),
    fog: mixHex(day.fog, night.fog, u),
    ambient: mixHex(day.ambient, night.ambient, u),
    hemiSky: mixHex(day.hemiSky, night.hemiSky, u),
    hemiGround: mixHex(day.hemiGround, night.hemiGround, u),
    sun: mixHex(day.sun, night.sun, u),
    ambientIntensity: lerp(day.ambientIntensity, night.ambientIntensity, u),
    hemiIntensity: lerp(day.hemiIntensity, night.hemiIntensity, u),
    sunIntensity: lerp(day.sunIntensity, night.sunIntensity, u),
    sunPosition: [
      lerp(day.sunPosition[0], night.sunPosition[0], u),
      lerp(day.sunPosition[1], night.sunPosition[1], u),
      lerp(day.sunPosition[2], night.sunPosition[2], u),
    ],
    fillIntensity: lerp(day.fillIntensity, night.fillIntensity, u),
    fillColor: mixHex(day.fillColor, night.fillColor, u),
    fillPosition: [
      lerp(day.fillPosition[0], night.fillPosition[0], u),
      lerp(day.fillPosition[1], night.fillPosition[1], u),
      lerp(day.fillPosition[2], night.fillPosition[2], u),
    ],
    nightAmount: u,
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function mixHex(a: string, b: string, t: number): string {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return t > 0.5 ? b : a;
  const u = Math.min(1, Math.max(0, t));
  const r = Math.round(ca.r + (cb.r - ca.r) * u);
  const g = Math.round(ca.g + (cb.g - ca.g) * u);
  const bl = Math.round(ca.b + (cb.b - ca.b) * u);
  return `#${toHex(r)}${toHex(g)}${toHex(bl)}`;
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.trim().replace("#", "");
  if (h.length === 3) {
    const r = parseInt(h[0]! + h[0]!, 16);
    const g = parseInt(h[1]! + h[1]!, 16);
    const b = parseInt(h[2]! + h[2]!, 16);
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;
    return { r, g, b };
  }
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return { r, g, b };
}

function toHex(n: number): string {
  return n.toString(16).padStart(2, "0");
}
