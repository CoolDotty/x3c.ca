import { useMemo, useRef, useState, useEffect } from "react";
import { useReducedMotion } from "motion/react";
import { useServerStats } from "@/hooks/useServerStats";
import { useInterpolatedValue } from "@/hooks/useInterpolatedValue";
import { statsToShaderParams } from "@/lib/statsToShader";
import { CosmicWavesShaders } from "./CosmicWavesShaders";
import ServerStatsDisplay from "./ServerStatsDisplay";

interface StatsControlledShaderProps {
	shaderClassName?: string;
	statsClassName?: string;
	interpolationSpeed?: number;
}

export default function StatsControlledShader({
	shaderClassName,
	statsClassName,
	interpolationSpeed = 0.03,
}: StatsControlledShaderProps) {
	const { stats, connectionState } = useServerStats();
	const startTimeRef = useRef(performance.now());
	const [fadeDelay, setFadeDelay] = useState<number | null>(null);
	const prefersReducedMotion = useReducedMotion();

	useEffect(() => {
		if (connectionState === "connected" && fadeDelay === null) {
			const elapsed = (performance.now() - startTimeRef.current) / 1000;
			setFadeDelay(elapsed);
		}
	}, [connectionState, fadeDelay]);

	const targetParams = useMemo(() => statsToShaderParams(stats), [stats]);

	const targetSpeed = prefersReducedMotion ? 0 : targetParams.speed;
	const targetColorShift = prefersReducedMotion ? 0 : targetParams.colorShift;
	const targetStarDensity = prefersReducedMotion ? 0 : targetParams.starDensity;

	const speed = useInterpolatedValue(targetSpeed, interpolationSpeed);
	const amplitude = useInterpolatedValue(targetParams.amplitude, interpolationSpeed);
	const frequency = useInterpolatedValue(targetParams.frequency, interpolationSpeed);
	const starDensity = useInterpolatedValue(targetStarDensity, interpolationSpeed);
	const colorShift = useInterpolatedValue(targetColorShift, interpolationSpeed);

	return (
		<>
			<CosmicWavesShaders
				className={shaderClassName}
				speed={speed}
				amplitude={amplitude}
				frequency={frequency}
				starDensity={starDensity}
				colorShift={colorShift}
				fadeDelay={fadeDelay ?? 9999}
			/>
			<ServerStatsDisplay
				stats={stats}
				connectionState={connectionState}
				className={statsClassName}
			/>
		</>
	);
}
