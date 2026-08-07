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
    };
  }

  return {
    background: mixHex(theme.background, "#0a1020", 0.82),
    fog: mixHex(theme.fog, "#0c1424", 0.78),
    ambient: mixHex(theme.ambient, "#6a7a9a", 0.55),
    hemiSky: mixHex(theme.hemiSky, "#1a2744", 0.7),
    hemiGround: mixHex(theme.hemiGround, "#1a1820", 0.65),
    sun: "#c5d4ff",
    ambientIntensity: 0.22,
    hemiIntensity: 0.28,
    sunIntensity: 0.38,
    sunPosition: [-6, 10, -8],
    fillIntensity: 0.18,
    fillColor: "#7a8ec4",
    fillPosition: [4, 6, 2],
  };
}

function mixHex(a: string, b: string, t: number): string {
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
