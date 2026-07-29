import type { Stats } from "@/hooks/useServerStats";

export interface ShaderParams {
	turbulence: number;
	coverage: number;
	intensity: number;
	starDensity: number;
}

function lerp(min: number, max: number, t: number): number {
	return min + (max - min) * Math.max(0, Math.min(1, t));
}

function smoothstep(value: number): number {
	const clamped = Math.max(0, Math.min(1, value));
	return clamped * clamped * (3 - 2 * clamped);
}

export function statsToShaderParams(stats: Stats | null): ShaderParams {
	if (!stats) {
		return {
			turbulence: 0.75,
			coverage: 0.42,
			intensity: 0.82,
			starDensity: 0.9,
		};
	}

	// CPU is normally in the low single digits, so a square-root curve keeps
	// everyday changes legible instead of reserving the whole visual range for spikes.
	const cpuLoad = Math.sqrt(Math.max(0, Math.min(1, stats.cpu.usage / 100)));
	const ramLoad = smoothstep(stats.ram.usage / 100);
	const storageLoad = smoothstep(stats.storage.usage / 100);

	return {
		turbulence: lerp(0.58, 1.7, cpuLoad),
		coverage: lerp(0.28, 0.84, ramLoad),
		intensity: lerp(0.72, 1.32, ramLoad),
		starDensity: lerp(0.55, 1.45, storageLoad),
	};
}
