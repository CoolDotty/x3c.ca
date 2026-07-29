import { useEffect, useMemo, useRef, useState } from "react";
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

const HISTORY_LENGTH = 12;
const HISTORY_INTERVAL_MS = 4_000;

export default function StatsControlledShader({
	shaderClassName,
	statsClassName,
	interpolationSpeed = 0.03,
}: StatsControlledShaderProps) {
	const { stats, connectionState } = useServerStats();
	const startTimeRef = useRef(performance.now());
	const [errorStartedAt, setErrorStartedAt] = useState(-999);
	const prefersReducedMotion = useReducedMotion();

	useEffect(() => {
		if (connectionState === "error") {
			const elapsed = (performance.now() - startTimeRef.current) / 1000;
			setErrorStartedAt(elapsed);
		}
	}, [connectionState]);

	const targetParams = useMemo(() => statsToShaderParams(stats), [stats]);
	const starDensity = useInterpolatedValue(targetParams.starDensity, interpolationSpeed);
	const connectionValue = connectionState === "connected" ? 1 : connectionState === "error" ? 2 : 0;
	const currentHistorySample = useMemo(
		() => [
			targetParams.turbulence,
			targetParams.coverage,
			targetParams.intensity,
			targetParams.starDensity,
		],
		[targetParams]
	);
	const latestHistorySampleRef = useRef(currentHistorySample);
	const [statHistory, setStatHistory] = useState<number[][]>(() =>
		Array.from({ length: HISTORY_LENGTH }, () => [...currentHistorySample])
	);
	const [historyEpoch, setHistoryEpoch] = useState(0);

	useEffect(() => {
		latestHistorySampleRef.current = currentHistorySample;
		setStatHistory((history) => [[...currentHistorySample], ...history.slice(1)]);
	}, [currentHistorySample]);

	useEffect(() => {
		const snapshotTimer = window.setInterval(() => {
			const elapsed = (performance.now() - startTimeRef.current) / 1000;
			setStatHistory((history) => [
				[...latestHistorySampleRef.current],
				[...history[0]],
				...history.slice(1, HISTORY_LENGTH - 1),
			]);
			setHistoryEpoch(elapsed);
		}, HISTORY_INTERVAL_MS);

		return () => window.clearInterval(snapshotTimer);
	}, []);

	const flattenedStatHistory = useMemo(() => statHistory.flat(), [statHistory]);

	return (
		<>
			<CosmicWavesShaders
				className={shaderClassName}
				starDensity={starDensity}
				statHistory={flattenedStatHistory}
				historyEpoch={historyEpoch}
				connectionState={connectionValue}
				errorStartedAt={errorStartedAt}
				reducedMotion={Boolean(prefersReducedMotion)}
				fadeDelay={0.15}
			/>
			<ServerStatsDisplay
				stats={stats}
				connectionState={connectionState}
				className={statsClassName}
			/>
		</>
	);
}
