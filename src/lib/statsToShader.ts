import type { Stats } from "@/hooks/useServerStats";

export interface ShaderParams {
  speed: number;
  amplitude: number;
  frequency: number;
  starDensity: number;
  colorShift: number;
}

function lerp(min: number, max: number, t: number): number {
  return min + (max - min) * Math.max(0, Math.min(1, t));
}

export function statsToShaderParams(stats: Stats | null): ShaderParams {
  if (!stats) {
    return {
      speed: 1.0,
      amplitude: 1.0,
      frequency: 1.0,
      starDensity: 1.0,
      colorShift: 1.0,
    };
  }

  const cpuNormalized = stats.cpu.usage / 100;
  const ramNormalized = stats.ram.usage / 100;
  const storageNormalized = stats.storage.usage / 100;

  return {
    speed: lerp(0.85, 1.25, cpuNormalized),
    colorShift: lerp(0.85, 1.25, cpuNormalized),
    amplitude: lerp(0.85, 1.25, ramNormalized),
    frequency: 1.0,
    starDensity: lerp(0.85, 1.25, storageNormalized),
  };
}
