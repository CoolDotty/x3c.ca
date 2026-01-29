import { useMemo, useRef, useState, useEffect } from "react";
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

  useEffect(() => {
    if (connectionState === "connected" && fadeDelay === null) {
      const elapsed = (performance.now() - startTimeRef.current) / 1000;
      setFadeDelay(elapsed);
    }
  }, [connectionState, fadeDelay]);

  const targetParams = useMemo(() => statsToShaderParams(stats), [stats]);

  const speed = useInterpolatedValue(targetParams.speed, interpolationSpeed);
  const amplitude = useInterpolatedValue(
    targetParams.amplitude,
    interpolationSpeed
  );
  const frequency = useInterpolatedValue(
    targetParams.frequency,
    interpolationSpeed
  );
  const starDensity = useInterpolatedValue(
    targetParams.starDensity,
    interpolationSpeed
  );
  const colorShift = useInterpolatedValue(
    targetParams.colorShift,
    interpolationSpeed
  );

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
