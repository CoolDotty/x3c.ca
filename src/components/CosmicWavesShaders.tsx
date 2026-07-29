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

mat2 rotate2d(float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat2(c, -s, s, c);
}

float foldedNoise(vec2 p) {
  float result = 0.0;
  float weight = 0.56;
  mat2 octaveRotation = mat2(0.80, -0.60, 0.60, 0.80);

  for (int octave = 0; octave < 3; octave++) {
    vec2 cell = abs(fract(p) - 0.5);
    float ridge = 1.0 - saturate((cell.x + cell.y) * 1.65);
    result += ridge * ridge * weight;
    p = octaveRotation * p * 1.87 + vec2(1.7, 2.9);
    weight *= 0.54;
  }

  return saturate(result);
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
  float historyPhase = fract(streamTime / HISTORY_INTERVAL);

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
  float pixelJitter = hash21(fragCoord) * 0.7;

  // A short volume integration through a world-space curtain. Non-linear
  // spacing gives the horizon more samples without oversampling nearby space.
  for (int sampleIndex = 0; sampleIndex < 24; sampleIndex++) {
    float sampleProgress = (float(sampleIndex) + 0.35 + pixelJitter) / 24.0;
    float rayDistance = 0.8 + pow(sampleProgress, 1.42) * 52.0;
    vec3 samplePosition = cameraOrigin + rayDirection * rayDistance;
    vec4 sampleStats = u_statHistory[sampleIndex / 2];
    if (sampleIndex >= 2) {
      // As a snapshot interval elapses, younger material advances into this
      // depth slot. The array shift at the interval boundary is then seamless.
      sampleStats = mix(
        sampleStats,
        u_statHistory[(sampleIndex - 2) / 2],
        historyPhase
      );
    }
    float sampleTurbulence = sampleStats.x;
    float sampleCoverage = sampleStats.y;
    float sampleIntensity = sampleStats.z;
    float sampleStorage = saturate((sampleStats.w - 0.55) / 0.90);
    float coverageHeight = mix(2.5, 6.8, sampleCoverage);

    float pathCenter = auroraPath(samplePosition.z);
    float ribbonWarp = (foldedNoise(vec2(
      samplePosition.z * 0.105,
      samplePosition.y * 0.19 + 1.7
    )) - 0.36) * (0.52 + sampleTurbulence * 0.34);
    float lateralDistance = abs(samplePosition.x - pathCenter - ribbonWarp);

    float ribbonFalloff = mix(3.0, 1.65, sampleCoverage);
    float ribbon = exp(-lateralDistance * ribbonFalloff);
    float surroundingGlow = exp(-lateralDistance * 0.72) * 0.045;
    float heightEnvelope = smoothstep(0.20, 0.72, samplePosition.y);
    heightEnvelope *= exp(-max(samplePosition.y - 0.9, 0.0) / coverageHeight);

    // Noise varies mainly along the path, so the resulting structures remain
    // vertically coherent like real auroral rays.
    float filaments = foldedNoise(vec2(
      samplePosition.z * (0.31 + sampleTurbulence * 0.055),
      3.1
    ));
    filaments = pow(saturate((filaments - 0.08) * 1.42), 2.2);
    float fineRays = pow(
      0.5 + 0.5 * sin(samplePosition.z * (3.2 + sampleTurbulence) + ribbonWarp * 5.0),
      8.0
    );
    float lowerEdge = 0.79
      + sin(samplePosition.z * 0.19 + sin(samplePosition.z * 0.071) * 1.3) * 0.09;
    float luminousSpine = exp(-abs(samplePosition.y - lowerEdge) * 7.5);
    float density = heightEnvelope * (
      ribbon * (0.07 + filaments * 1.72 + fineRays * 0.42)
      + surroundingGlow * (0.08 + filaments * 0.32)
    );
    density += ribbon * luminousSpine * (0.62 + fineRays * 0.55);

    float distanceFade = exp(-rayDistance * 0.018);
    float sampleAlpha = density * sampleIntensity * mix(0.14, 0.34, sampleProgress) * distanceFade;
    float storedSpark = step(
      mix(0.996, 0.958, sampleStorage),
      hash21(floor(samplePosition.zy * vec2(2.2, 2.8)))
    );
    sampleAlpha += storedSpark * ribbon * heightEnvelope * 0.09;
    sampleAlpha *= 1.0 - accumulatedAurora.a;

    float colorHeight = saturate((samplePosition.y - 0.55) / max(coverageHeight, 0.1));
    vec3 auroraGreen = vec3(0.075, 1.00, 0.50);
    vec3 auroraCyan = vec3(0.06, 0.58, 1.00);
    vec3 auroraViolet = vec3(0.48, 0.16, 1.00);
    vec3 sampleColor = mix(auroraGreen, auroraCyan, saturate(colorHeight * 1.7));
    sampleColor = mix(sampleColor, auroraViolet, pow(colorHeight, 2.8) * 0.42);

    accumulatedAurora.rgb += sampleColor * sampleAlpha;
    accumulatedAurora.a += sampleAlpha;
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

  float grain = hash21(fragCoord) - 0.5;
  finalColor += grain * 0.008;
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
			connectionState = 1,
			errorStartedAt = -999,
			reducedMotion = false,
			fadeDuration = 2.0,
			fadeDelay = 0.0,
			...props
		},
		ref
	) => {
		// Motion clarity matters more than supersampling here; the grain and soft
		// volume hide the lower framebuffer resolution on high-DPI displays.
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
