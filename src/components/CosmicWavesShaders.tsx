// Via: https://www.dov.me/
import type React from "react";
import { forwardRef } from "react";
import { Shader } from "react-shaders";
import { cn } from "@/lib/utils";

export interface CosmicWavesShadersProps extends React.HTMLAttributes<HTMLDivElement> {
	/**
	 * Twelve vec4 samples ordered newest to oldest:
	 * turbulence, coverage, intensity, and star density
	 */
	statHistory?: number[];

	/**
	 * Shader-relative time of the latest history queue shift
	 * @default 0
	 */
	historyEpoch?: number;

	/**
	 * Star quantity and brightness
	 * @default 1.0
	 */
	starDensity?: number;

	/**
	 * 0 = connecting, 1 = connected, 2 = error
	 * @default 1
	 */
	connectionState?: number;

	/**
	 * Seconds since shader mount when the latest error began
	 * @default -999
	 */
	errorStartedAt?: number;

	/**
	 * Freeze time-based movement while preserving stat-driven form
	 * @default false
	 */
	reducedMotion?: boolean;

	/**
	 * Duration of fade-in from black in seconds
	 * @default 2.0
	 */
	fadeDuration?: number;

	/**
	 * Delay before fade-in starts in seconds
	 * @default 0.0
	 */
	fadeDelay?: number;
}

const fragmentShader = `
float saturate(float value) {
  return clamp(value, 0.0, 1.0);
}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float auroraPath(float z) {
  return sin(z * 0.112) * 2.25 + sin(z * 0.041 + 1.8) * 1.15;
}

mat3 lookAt(vec3 origin, vec3 target) {
  vec3 forward = normalize(target - origin);
  vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(right, forward);
  return mat3(right, up, forward);
}

const float STREAM_SPEED = 0.82;
const float HISTORY_INTERVAL = 4.0;
const float CURTAIN_BOTTOM = 0.62;
const float CURTAIN_TOP = 8.4;
const float CURTAIN_LAYERS = 14.0;
const float CURTAIN_VANISH_HEIGHT = 0.74;
const float CURTAIN_MERGE_START = 20.0;
const float CURTAIN_MERGE_END = 56.0;

float smoothWave(float coordinate, float seed) {
  return 0.50
    + sin(coordinate + seed) * 0.27
    + sin(coordinate * 1.73 + seed * 1.31) * 0.15
    + sin(coordinate * 3.11 - seed * 0.73) * 0.08;
}

float ribbonCenterAt(vec3 position, float layer, float turbulence) {
  float broadWave = smoothWave(position.z * 0.18, layer * 1.7);
  float center = auroraPath(position.z);
  center += (broadWave - 0.5) * (0.42 + turbulence * 0.46);
  center += sin(position.z * 0.37 + layer * 1.1) * 0.11;
  return center;
}

float curtainSurfaceHeight(float baseHeight, float depth) {
  float heightRetention = 1.0 - smoothstep(
    CURTAIN_MERGE_START,
    CURTAIN_MERGE_END,
    depth
  );
  return mix(CURTAIN_VANISH_HEIGHT, baseHeight, heightRetention);
}

float curtainRayDistance(
  float baseHeight,
  vec3 origin,
  vec3 direction,
  float cameraZ
) {
  float lowDistance = 0.0;
  float highDistance = 76.0;

  // Solve the intersection with a curtain whose rows continuously converge
  // toward one shared horizon height. Bisection is stable for this monotonic
  // surface and the final interpolation removes any visible stepping.
  for (int solveIndex = 0; solveIndex < 6; solveIndex++) {
    float middleDistance = (lowDistance + highDistance) * 0.5;
    float middleDepth = max(
      origin.z + direction.z * middleDistance - cameraZ,
      0.0
    );
    float surfaceHeight = curtainSurfaceHeight(baseHeight, middleDepth);
    float rayHeight = origin.y + direction.y * middleDistance;
    float rayIsBelow = step(rayHeight, surfaceHeight);
    lowDistance = mix(lowDistance, middleDistance, rayIsBelow);
    highDistance = mix(middleDistance, highDistance, rayIsBelow);
  }

  float lowDepth = max(
    origin.z + direction.z * lowDistance - cameraZ,
    0.0
  );
  float highDepth = max(
    origin.z + direction.z * highDistance - cameraZ,
    0.0
  );
  float lowDifference = origin.y + direction.y * lowDistance
    - curtainSurfaceHeight(baseHeight, lowDepth);
  float highDifference = origin.y + direction.y * highDistance
    - curtainSurfaceHeight(baseHeight, highDepth);
  float rootBlend = saturate(
    -lowDifference / max(highDifference - lowDifference, 0.001)
  );
  return mix(lowDistance, highDistance, rootBlend);
}

vec4 statHistoryAtDepth(float depth, float historyPhase) {
  float segmentLength = STREAM_SPEED * HISTORY_INTERVAL;
  float historyCoordinate = clamp(
    depth / segmentLength - historyPhase,
    0.0,
    11.0
  );
  float currentSlot = floor(historyCoordinate);
  float olderSlot = min(currentSlot + 1.0, 11.0);
  float slotBlend = smoothstep(0.16, 0.84, fract(historyCoordinate));
  vec4 currentStats = vec4(0.0);
  vec4 olderStats = vec4(0.0);

  // WebGL 1 requires constant array indices, so select the two neighboring
  // history records without dynamically indexing the uniform array.
  for (int historyIndex = 0; historyIndex < 12; historyIndex++) {
    float indexValue = float(historyIndex);
    float selectCurrent = 1.0 - step(0.5, abs(indexValue - currentSlot));
    float selectOlder = 1.0 - step(0.5, abs(indexValue - olderSlot));
    currentStats = mix(currentStats, u_statHistory[historyIndex], selectCurrent);
    olderStats = mix(olderStats, u_statHistory[historyIndex], selectOlder);
  }

  return mix(currentStats, olderStats, slotBlend);
}

float starLayer(vec2 coordinates, float threshold, float seed) {
  vec2 cell = floor(coordinates);
  vec2 local = fract(coordinates) - 0.5;
  float randomValue = hash21(cell + seed);
  float exists = step(threshold, randomValue);
  float radius = mix(0.035, 0.095, hash21(cell + seed + 12.4));
  float core = 1.0 - smoothstep(0.0, radius, length(local));
  float sparkle = exp(-abs(local.x) * 45.0) * exp(-abs(local.y) * 9.0);
  sparkle += exp(-abs(local.y) * 45.0) * exp(-abs(local.x) * 9.0);
  return exists * (core + sparkle * 0.09);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
  vec2 uv = fragCoord.xy / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  float connected = 1.0 - smoothstep(0.1, 0.4, abs(u_connectionState - 1.0));
  float errorState = 1.0 - smoothstep(0.1, 0.4, abs(u_connectionState - 2.0));
  float motion = 1.0 - u_reducedMotion;
  float streamTime = iTime * motion;
  float cameraZ = -streamTime * STREAM_SPEED;
  float historyPhase = fract(
    max(streamTime - u_historyEpoch * motion, 0.0) / HISTORY_INTERVAL
  );

  // The camera stays below the curtain and moves backwards at one constant
  // speed. Stats affect new material, never the transport itself.
  vec3 cameraOrigin = vec3(auroraPath(cameraZ) - 2.15, -0.62, cameraZ);
  vec3 cameraTarget = vec3(auroraPath(cameraZ + 21.0) - 0.30, 2.24, cameraZ + 21.0);
  mat3 camera = lookAt(cameraOrigin, cameraTarget);
  vec2 screen = (uv - 0.5) * vec2(aspect, 1.0);
  vec3 rayDirection = camera * normalize(vec3(screen, 1.28));

  float horizon = exp(-abs(rayDirection.y) * 12.0);
  float skyHeight = saturate(rayDirection.y * 1.7 + 0.42);
  vec3 finalColor = mix(vec3(0.001, 0.003, 0.010), vec3(0.005, 0.019, 0.042), skyHeight);
  finalColor += vec3(0.006, 0.025, 0.041) * horizon * 0.7;

  vec2 starCoordinates = vec2(
    atan(rayDirection.x, rayDirection.z) * 78.0,
    rayDirection.y * 96.0
  );
  float starThreshold = mix(0.992, 0.968, saturate((u_starDensity - 0.45) / 1.05));
  float stars = starLayer(starCoordinates, starThreshold, 2.4);
  stars += starLayer(starCoordinates * 1.37 + vec2(4.2, 1.3), starThreshold + 0.009, 9.7);
  finalColor += vec3(0.45, 0.68, 0.95) * stars * mix(0.34, 0.62, connected);

  vec4 accumulatedAurora = vec4(0.0);

  // Intersect the view ray with several exact, translucent ribbon sheets.
  // Their analytic edges remain stable from frame to frame, unlike a dithered
  // volume march, and naturally get cheaper toward the horizon.
  for (int layerIndex = 0; layerIndex < 14; layerIndex++) {
    float layer = (float(layerIndex) + 0.5) / CURTAIN_LAYERS;
    float sheetHeight = mix(CURTAIN_BOTTOM, CURTAIN_TOP, layer);
    float rayDistance = curtainRayDistance(
      sheetHeight,
      cameraOrigin,
      rayDirection,
      cameraZ
    );
    float visibleRay = smoothstep(0.012, 0.040, rayDirection.y);
    visibleRay *= 1.0 - smoothstep(68.0, 76.0, rayDistance);
    vec3 sheetPosition = cameraOrigin + rayDirection * rayDistance;
    float depth = max(sheetPosition.z - cameraZ, 0.0);
    float horizonMerge = smoothstep(
      CURTAIN_MERGE_START,
      CURTAIN_MERGE_END,
      depth
    );
    vec4 sampleStats = statHistoryAtDepth(depth, historyPhase);
    float sampleTurbulence = sampleStats.x;
    float sampleCoverage = sampleStats.y;
    float sampleIntensity = sampleStats.z;
    float sampleStorage = saturate((sampleStats.w - 0.55) / 0.90);

    float pathCenter = ribbonCenterAt(
      sheetPosition,
      mix(layer, 0.5, horizonMerge),
      sampleTurbulence
    );

    float baseRibbonWidth = mix(0.25, 0.68, sampleCoverage);
    baseRibbonWidth *= 0.94 + layer * 0.24;

    // Estimate how far this sheet's center moves before the next height slice.
    // A ribbon radius of 58% of the center spacing gives neighboring rows a
    // controlled overlap. Taking the maximum instead of adding widths avoids
    // a lower row growing far enough to swallow the row above it.
    float layerStep = 1.0 / CURTAIN_LAYERS;
    float heightStep = (CURTAIN_TOP - CURTAIN_BOTTOM) * layerStep;
    float neighborRayDistance = curtainRayDistance(
      sheetHeight + heightStep,
      cameraOrigin,
      rayDirection,
      cameraZ
    );
    vec3 neighborPosition = cameraOrigin + rayDirection * neighborRayDistance;
    float neighborCenter = ribbonCenterAt(
      neighborPosition,
      mix(min(layer + layerStep, 1.0), 0.5, horizonMerge),
      sampleTurbulence
    );
    float currentOffset = sheetPosition.x - pathCenter;
    float neighborOffset = neighborPosition.x - neighborCenter;
    float rowSpacing = abs(neighborOffset - currentOffset);
    float overlapRatio = mix(0.66, 0.94, horizonMerge);
    float overlapMatchedWidth = rowSpacing * overlapRatio;
    float ribbonWidth = max(baseRibbonWidth, overlapMatchedWidth);
    float widthExpansion = ribbonWidth / max(baseRibbonWidth, 0.001);

    float lateralDistance = abs(sheetPosition.x - pathCenter);
    float worldPixel = max(0.012, rayDistance * 1.55 / max(iResolution.y, 1.0));
    float ribbonCore = 1.0 - smoothstep(
      ribbonWidth * 0.54 - worldPixel,
      ribbonWidth * 1.04 + worldPixel,
      lateralDistance
    );
    float ribbonBody = exp(
      -pow(lateralDistance / max(ribbonWidth, 0.001), 2.0) * 1.92
    );
    float surroundingGlow = exp(
      -lateralDistance / max(ribbonWidth * 2.8, 0.001)
    );

    float coverageLimit = mix(0.46, 1.0, sampleCoverage);
    float coverageEnvelope = 1.0 - smoothstep(
      coverageLimit - 0.13,
      coverageLimit + 0.08,
      layer
    );
    float flowingSheen = smoothWave(
      sheetPosition.z * (0.56 + sampleTurbulence * 0.11),
      layer * 13.1
    );
    flowingSheen = mix(0.68, 1.18, smoothstep(0.12, 0.88, flowingSheen));
    flowingSheen = mix(flowingSheen, 1.0, horizonMerge);
    float storageSheen = mix(
      0.95,
      1.10,
      smoothWave(sheetPosition.z * 1.03, layer * 17.3) * sampleStorage
    );
    float distanceFade = exp(-rayDistance * 0.016);
    float layerEnvelope = sin(layer * 3.14159265);
    float sampleAlpha = (
      ribbonBody * flowingSheen * 0.21
      + ribbonCore * 0.085
      + surroundingGlow * 0.018
    );
    sampleAlpha *= sampleIntensity
      * storageSheen
      * coverageEnvelope
      * mix(0.72, 1.0, layerEnvelope)
      * distanceFade
      * visibleRay;
    sampleAlpha *= mix(1.0, 0.14, horizonMerge);
    // Conserve approximately the same light energy when a side-on ribbon has
    // to widen, preventing the expanded lower rows from overpowering the rest.
    sampleAlpha /= sqrt(widthExpansion);
    sampleAlpha *= 1.0 - accumulatedAurora.a * 0.72;

    vec3 auroraGreen = vec3(0.055, 1.00, 0.48);
    vec3 auroraCyan = vec3(0.045, 0.54, 1.00);
    vec3 auroraViolet = vec3(0.46, 0.14, 1.00);
    vec3 sampleColor = mix(
      auroraGreen,
      auroraCyan,
      smoothstep(0.18, 0.78, layer)
    );
    sampleColor = mix(
      sampleColor,
      auroraViolet,
      smoothstep(0.72, 1.0, layer) * 0.44
    );
    sampleColor = mix(sampleColor, vec3(0.055, 0.78, 0.80), horizonMerge);

    accumulatedAurora.rgb += sampleColor * sampleAlpha;
    accumulatedAurora.a += sampleAlpha * (1.0 - accumulatedAurora.a);
  }

  float connectionEnergy = mix(0.34, 1.0, connected);
  float connectionSaturation = mix(0.32, 1.0, connected);
  float auroraLuma = dot(accumulatedAurora.rgb, vec3(0.2126, 0.7152, 0.0722));
  vec3 aurora = mix(vec3(auroraLuma), accumulatedAurora.rgb, connectionSaturation);
  finalColor += aurora * connectionEnergy * 2.8;

  float errorAge = max(0.0, iTime - u_errorStartedAt);
  float errorPulse = errorState * sin(3.14159265 * saturate(errorAge / 1.4)) * exp(-errorAge * 0.9);
  finalColor += vec3(0.23, 0.012, 0.018) * errorPulse * (0.35 + accumulatedAurora.a);

  // Keep the typography and telemetry readable when a bright fold passes beneath.
  float leftTextMask = (1.0 - smoothstep(0.08, 0.58, uv.x)) * smoothstep(0.40, 0.72, uv.y);
  float rightStatsMask = smoothstep(0.64, 0.96, uv.x)
    * (1.0 - smoothstep(0.10, 0.33, abs(uv.y - 0.50)));
  finalColor *= 1.0 - leftTextMask * 0.38 - rightStatsMask * 0.24;

  float vignette = smoothstep(0.92, 0.18, length((uv - 0.5) * vec2(0.82, 1.0)));
  finalColor *= mix(0.48, 1.0, vignette);

  finalColor = vec3(1.0) - exp(-finalColor * 1.24);
  finalColor = pow(max(finalColor, vec3(0.0)), vec3(0.92));

  float fadeTime = max(0.0, iTime - u_fadeDelay);
  float fadeIn = smoothstep(0.0, u_fadeDuration, fadeTime);
  finalColor *= fadeIn;

  fragColor = vec4(finalColor, 1.0);
}
`;

export const CosmicWavesShaders = forwardRef<HTMLDivElement, CosmicWavesShadersProps>(
	(
		{
			className,
			starDensity = 1.0,
			statHistory = Array.from({ length: 12 }, () => [1.0, 0.5, 1.0, 1.0]).flat(),
			historyEpoch = 0,
			connectionState = 1,
			errorStartedAt = -999,
			reducedMotion = false,
			fadeDuration = 2.0,
			fadeDelay = 0.0,
			...props
		},
		ref
	) => {
		// Render at full CSS-pixel resolution on every display. The shader uses
		// procedural distance LOD so nearby aurora detail stays crisp.
		const dpr = 1;

		return (
			<div className={cn("h-full w-full", className)} ref={ref} {...(props as any)}>
				<Shader
					fs={fragmentShader}
					devicePixelRatio={dpr}
					style={{ width: "100%", height: "100%" } as CSSStyleDeclaration}
					uniforms={{
						u_starDensity: { type: "1f", value: starDensity },
						u_statHistory: { type: "4fv", value: statHistory },
						u_historyEpoch: { type: "1f", value: historyEpoch },
						u_connectionState: { type: "1f", value: connectionState },
						u_errorStartedAt: { type: "1f", value: errorStartedAt },
						u_reducedMotion: { type: "1f", value: reducedMotion ? 1 : 0 },
						u_fadeDuration: { type: "1f", value: fadeDuration },
						u_fadeDelay: { type: "1f", value: fadeDelay },
					}}
				/>
			</div>
		);
	}
);

CosmicWavesShaders.displayName = "CosmicWavesShaders";

export default CosmicWavesShaders;
