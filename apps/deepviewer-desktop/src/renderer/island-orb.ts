import type {
  ActivityIslandOrbAnimation,
  ActivityIslandState,
} from '../shared/activity-island.js'

type Color = readonly [number, number, number]

interface ParticleStyle {
  readonly primary: Color
  readonly secondary: Color
  readonly accent: Color
  readonly speed: number
  readonly speedFloor: number
  readonly motionCycle: number
  readonly tempo: number
  readonly response: number
  readonly energy: number
  readonly turbulence: number
  readonly pulse: number
  readonly desaturation: number
  readonly volume: number
  readonly refraction: number
}

interface RippleStyle {
  readonly primary: Color
  readonly secondary: Color
  readonly accent: Color
  readonly upperHighlight: Color
  readonly highlight: Color
  readonly speed: number
  readonly warp: number
  readonly ridgeAmount: number
  readonly sharpness: number
  readonly exposure: number
}

const PARTICLE_STYLES: Record<ActivityIslandState, ParticleStyle> = {
  standby: {
    primary: [0.12, 0.23, 0.42],
    secondary: [0.25, 0.35, 0.58],
    accent: [0.44, 0.56, 0.75],
    speed: 0.045,
    speedFloor: 0.28,
    motionCycle: 16,
    tempo: 0.58,
    response: 1.25,
    energy: 0.5,
    turbulence: 0.12,
    pulse: 0.05,
    desaturation: 0.18,
    volume: 0.44,
    refraction: 0.5,
  },
  thinking: {
    primary: [0.2, 0.12, 0.68],
    secondary: [0.5, 0.23, 0.88],
    accent: [0.34, 0.57, 1],
    speed: 0.14,
    speedFloor: 0.22,
    motionCycle: 11,
    tempo: 0.82,
    response: 1.55,
    energy: 0.86,
    turbulence: 0.34,
    pulse: 0.18,
    desaturation: 0,
    volume: 0.76,
    refraction: 0.74,
  },
  working: {
    primary: [0.04, 0.3, 0.78],
    secondary: [0.02, 0.65, 0.9],
    accent: [0.28, 0.94, 0.84],
    speed: 0.24,
    speedFloor: 0.18,
    motionCycle: 8.5,
    tempo: 1.05,
    response: 1.85,
    energy: 1.02,
    turbulence: 0.58,
    pulse: 0.22,
    desaturation: 0,
    volume: 0.94,
    refraction: 0.84,
  },
  awaitingConfirmation: {
    primary: [0.55, 0.21, 0.02],
    secondary: [0.95, 0.46, 0.05],
    accent: [1, 0.78, 0.22],
    speed: 0.075,
    speedFloor: 0.18,
    motionCycle: 12,
    tempo: 0.72,
    response: 1.45,
    energy: 0.92,
    turbulence: 0.2,
    pulse: 0.46,
    desaturation: 0,
    volume: 0.68,
    refraction: 0.82,
  },
  completed: {
    primary: [0.02, 0.38, 0.22],
    secondary: [0.05, 0.7, 0.4],
    accent: [0.36, 0.95, 0.65],
    speed: 0.055,
    speedFloor: 0.2,
    motionCycle: 13,
    tempo: 0.55,
    response: 1.2,
    energy: 0.82,
    turbulence: 0.12,
    pulse: 0.12,
    desaturation: 0,
    volume: 0.62,
    refraction: 0.68,
  },
  error: {
    primary: [0.55, 0.01, 0.05],
    secondary: [0.92, 0.08, 0.14],
    accent: [1, 0.36, 0.22],
    speed: 0.13,
    speedFloor: 0.22,
    motionCycle: 8,
    tempo: 0.92,
    response: 2.1,
    energy: 0.96,
    turbulence: 0.62,
    pulse: 0.28,
    desaturation: 0,
    volume: 0.82,
    refraction: 0.62,
  },
  unavailable: {
    primary: [0.23, 0.25, 0.3],
    secondary: [0.36, 0.38, 0.43],
    accent: [0.5, 0.53, 0.58],
    speed: 0.015,
    speedFloor: 0.15,
    motionCycle: 18,
    tempo: 0.28,
    response: 1,
    energy: 0.36,
    turbulence: 0.03,
    pulse: 0,
    desaturation: 0.88,
    volume: 0.24,
    refraction: 0.18,
  },
}

const RIPPLE_STYLES: Record<ActivityIslandState, RippleStyle> = {
  standby: {
    primary: [0.12, 0.23, 0.42],
    secondary: [0.25, 0.35, 0.58],
    accent: [0.44, 0.56, 0.75],
    upperHighlight: [0.66, 0.76, 0.94],
    highlight: [0.9, 0.94, 1],
    speed: 0.32,
    warp: 1.9,
    ridgeAmount: 0.28,
    sharpness: 1.8,
    exposure: 1.55,
  },
  thinking: {
    primary: [0.2, 0.12, 0.68],
    secondary: [0.5, 0.23, 0.88],
    accent: [0.34, 0.57, 1],
    upperHighlight: [0.79, 0.48, 1],
    highlight: [0.96, 0.91, 1],
    speed: 0.82,
    warp: 3.2,
    ridgeAmount: 0.5,
    sharpness: 2.2,
    exposure: 2,
  },
  working: {
    primary: [0.04, 0.3, 0.78],
    secondary: [0.02, 0.65, 0.9],
    accent: [0.28, 0.94, 0.84],
    upperHighlight: [0.64, 1, 0.96],
    highlight: [0.92, 1, 1],
    speed: 1.15,
    warp: 3.8,
    ridgeAmount: 0.68,
    sharpness: 2.5,
    exposure: 2.05,
  },
  awaitingConfirmation: {
    primary: [0.55, 0.21, 0.02],
    secondary: [0.95, 0.46, 0.05],
    accent: [1, 0.78, 0.22],
    upperHighlight: [1, 0.56, 0.12],
    highlight: [1, 0.94, 0.72],
    speed: 0.48,
    warp: 2.3,
    ridgeAmount: 0.38,
    sharpness: 2,
    exposure: 1.86,
  },
  completed: {
    primary: [0.02, 0.38, 0.22],
    secondary: [0.05, 0.7, 0.4],
    accent: [0.36, 0.95, 0.65],
    upperHighlight: [0.54, 1, 0.79],
    highlight: [0.9, 1, 0.95],
    speed: 0.36,
    warp: 1.8,
    ridgeAmount: 0.3,
    sharpness: 1.8,
    exposure: 1.7,
  },
  error: {
    primary: [0.55, 0.01, 0.05],
    secondary: [0.92, 0.08, 0.14],
    accent: [1, 0.36, 0.22],
    upperHighlight: [1, 0.58, 0.18],
    highlight: [1, 0.88, 0.82],
    speed: 0.96,
    warp: 3.9,
    ridgeAmount: 0.74,
    sharpness: 2.8,
    exposure: 1.98,
  },
  unavailable: {
    primary: [0.23, 0.25, 0.3],
    secondary: [0.36, 0.38, 0.43],
    accent: [0.5, 0.53, 0.58],
    upperHighlight: [0.62, 0.64, 0.68],
    highlight: [0.78, 0.8, 0.84],
    speed: 0.08,
    warp: 0.8,
    ridgeAmount: 0.08,
    sharpness: 1.4,
    exposure: 1.2,
  },
}

const VERTEX_SHADER = `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  vec2 positions[3] = vec2[3](
    vec2(-1.0, -1.0),
    vec2(3.0, -1.0),
    vec2(-1.0, 3.0)
  );
  vec2 position = positions[gl_VertexID];
  gl_Position = vec4(position, 0.0, 1.0);
  vUv = position * 0.5 + 0.5;
}`

// Direct GLSL ES translation of QuotaView's CodexActivityIsland Metal sphere.
const PARTICLE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragmentColor;

uniform vec2 uResolution;
uniform float uTime;
uniform float uMotionPhase;
uniform float uEnergy;
uniform float uTurbulence;
uniform float uPulse;
uniform float uDesaturation;
uniform float uVolume;
uniform float uRefraction;
uniform float uTempo;
uniform float uMotionEnergy;
uniform vec3 uPrimary;
uniform vec3 uSecondary;
uniform vec3 uAccent;

const float PI = 3.141592653589793;

float saturate(float value) {
  return clamp(value, 0.0, 1.0);
}

float activitySoftBand(float distanceValue, float widthValue) {
  float normalized = distanceValue / max(widthValue, 0.0001);
  return exp(-normalized * normalized);
}

vec2 activityRotate2D(vec2 value, float angle) {
  float cosine = cos(angle);
  float sine = sin(angle);
  return vec2(
    value.x * cosine - value.y * sine,
    value.x * sine + value.y * cosine
  );
}

vec3 activityRotateVolume(vec3 value, float timeValue) {
  value.xz = activityRotate2D(value.xz, timeValue * 0.31 + 0.42);
  value.xy = activityRotate2D(value.xy, -timeValue * 0.23 - 0.18);
  value.yz = activityRotate2D(value.yz, timeValue * 0.17 + 0.28);
  return value;
}

float activityFluidField(vec3 point, float timeValue, float turbulence) {
  vec3 warped = point;
  warped.x += sin(point.y * 3.2 + timeValue * 1.10)
    * (0.10 + turbulence * 0.10);
  warped.y += sin(point.z * 3.8 - timeValue * 0.84)
    * (0.09 + turbulence * 0.12);
  warped.z += cos(point.x * 4.1 + timeValue * 0.72)
    * (0.08 + turbulence * 0.11);

  float broad =
    sin(warped.x * 3.8 + timeValue * 0.55) +
    sin(warped.y * 4.4 - timeValue * 0.47) +
    sin(warped.z * 4.0 + timeValue * 0.38);
  float detail =
    sin((warped.x + warped.y) * 7.2 - timeValue * 0.92) +
    cos((warped.y - warped.z) * 6.1 + timeValue * 0.68);
  return broad * 0.30 + detail * 0.13;
}

void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  p.x *= uResolution.x / max(uResolution.y, 1.0);

  float rotationTime = uMotionPhase * 1.45;
  float fluidTime = uMotionPhase * 2.80;
  float surfaceTime = uMotionPhase * 2.20;
  float radius = length(p);
  float angle = atan(p.y, p.x);
  float animatedTurbulence =
    uTurbulence * (0.84 + uMotionEnergy * 0.20);
  float breathing =
    sin(uTime * uTempo) * (0.006 + uPulse * 0.010);
  float sphereRadius = 0.535 + breathing;
  float sphereDistance = abs(radius - sphereRadius);

  if (radius > sphereRadius + 0.18) {
    fragmentColor = vec4(0.0);
    return;
  }

  float normalizedRadius = radius / max(sphereRadius, 0.001);
  float inside = 1.0 - step(1.0, normalizedRadius);
  float zExtent = sqrt(max(0.0, 1.0 - normalizedRadius * normalizedRadius));
  vec3 normal = normalize(vec3(p / max(sphereRadius, 0.001), zExtent));

  float fresnel = pow(saturate(1.0 - max(normal.z, 0.0)), 2.25);
  float rim = smoothstep(0.10, 0.96, fresnel);
  vec3 keyLight = normalize(vec3(-0.48, 0.64, 0.82));
  float specular = pow(saturate(dot(normal, keyLight)), 38.0);

  vec3 volumeColor = vec3(0.0);
  float volumeAlpha = 0.0;

  for (int index = 0; index < 20; ++index) {
    float samplePosition = (float(index) + 0.5) / 20.0;
    float sampleZ = mix(-zExtent, zExtent, samplePosition);
    vec3 samplePoint = vec3(p / max(sphereRadius, 0.001), sampleZ);
    samplePoint = activityRotateVolume(
      samplePoint,
      rotationTime * (0.72 + animatedTurbulence * 0.42)
    );

    float field = activityFluidField(
      samplePoint * (1.16 + animatedTurbulence * 0.22),
      fluidTime,
      animatedTurbulence
    );
    float ribbon = exp(-abs(field) * (5.6 - uVolume * 1.8));
    float filament = exp(
      -abs(
        field +
        sin(samplePoint.x * 6.0 - samplePoint.z * 4.0 + fluidTime) * 0.20
      ) * 12.0
    );
    float depthFade = 0.46 + 0.54 * sin(samplePosition * PI);
    float density =
      (ribbon * 0.62 + filament * 0.52) *
      depthFade *
      (0.018 + uVolume * 0.020);

    float colorPhase = fract(
      samplePosition * 0.78 +
      field * 0.15 +
      angle / (2.0 * PI) -
      fluidTime * 0.035
    );
    vec3 sampleColor =
      colorPhase < 0.5
      ? mix(uPrimary, uSecondary, colorPhase * 2.0)
      : mix(uSecondary, uAccent, (colorPhase - 0.5) * 2.0);

    float remaining = 1.0 - volumeAlpha;
    volumeColor +=
      remaining *
      sampleColor *
      density *
      (1.65 + uEnergy * 1.12);
    volumeAlpha += remaining * density;
  }

  volumeColor *= inside;
  volumeAlpha *= inside;

  float normalizedX = p.x / max(sphereRadius, 0.001);
  float normalizedY = p.y / max(sphereRadius, 0.001);
  float projectedWaveA =
    normalizedY -
    sin(
      normalizedX * (4.2 + animatedTurbulence * 1.8) +
      surfaceTime * 1.55 +
      zExtent * 2.1
    ) * (0.17 + animatedTurbulence * 0.08);
  float projectedWaveB =
    normalizedX +
    cos(
      normalizedY * (4.8 + animatedTurbulence * 1.2) -
      surfaceTime * 1.12 -
      zExtent * 1.7
    ) * (0.15 + animatedTurbulence * 0.07);
  float projectedRibbonA = activitySoftBand(
    projectedWaveA,
    0.065 + animatedTurbulence * 0.020
  );
  float projectedRibbonB = activitySoftBand(
    projectedWaveB,
    0.080 + animatedTurbulence * 0.018
  );
  float projectedRibbon =
    inside *
    (projectedRibbonA * 0.72 + projectedRibbonB * 0.44) *
    (0.38 + zExtent * 0.62);
  float projectedPhase =
    0.5 +
    0.5 * sin(angle * 2.4 - surfaceTime * 1.3 + zExtent * 3.4);
  vec3 projectedColor = mix(
    mix(uPrimary, uSecondary, projectedPhase),
    uAccent,
    saturate(projectedRibbonB * 0.44)
  );

  float chromaRed = activitySoftBand(
    abs(radius - sphereRadius - 0.006 * uRefraction),
    0.012 + uRefraction * 0.005
  );
  float chromaGreen = activitySoftBand(
    abs(radius - sphereRadius),
    0.011
  );
  float chromaBlue = activitySoftBand(
    abs(radius - sphereRadius + 0.008 * uRefraction),
    0.014 + uRefraction * 0.004
  );
  vec3 chromaticRim = vec3(chromaRed, chromaGreen, chromaBlue);
  chromaticRim *= mix(
    uPrimary,
    uAccent,
    0.5 + 0.5 * sin(angle * 2.0 - surfaceTime * 1.2)
  );

  float caustic =
    pow(
      max(0.0, 0.5 + 0.5 * cos(angle * 1.4 - surfaceTime * 1.8 - 0.7)),
      18.0
    ) *
    activitySoftBand(sphereDistance, 0.026);
  float halo = exp(-sphereDistance * (12.0 - uEnergy * 1.8));

  float glassTint = inside * (0.035 + rim * 0.14 + specular * 0.24);
  vec3 glassColor =
    mix(uPrimary, uAccent, fresnel) * glassTint +
    vec3(0.72, 0.86, 1.0) * specular * 0.54;

  vec3 color =
    volumeColor * (1.18 + uVolume * 0.74) +
    projectedColor * projectedRibbon * (0.32 + uVolume * 0.64) +
    mix(uPrimary, uSecondary, projectedPhase) *
      inside * zExtent * 0.035 * uVolume +
    glassColor +
    chromaticRim * (0.34 + uRefraction * 0.50) +
    uAccent * caustic * (0.60 + uEnergy * 0.72) +
    mix(uPrimary, uSecondary, 0.5) * halo * 0.075 * uEnergy;

  float luma = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(color, vec3(luma), saturate(uDesaturation));

  float alpha =
    volumeAlpha * (0.82 + uVolume * 0.42) +
    projectedRibbon * (0.18 + uVolume * 0.28) +
    rim * inside * (0.24 + uRefraction * 0.30) +
    specular * inside * 0.48 +
    max(max(chromaRed, chromaGreen), chromaBlue) * 0.64 +
    halo * 0.10 * uEnergy;

  alpha *= 1.0 - smoothstep(
    sphereRadius + 0.12,
    sphereRadius + 0.18,
    radius
  );
  color *= 0.94 + 0.06 * sin(uTime * uTempo * 0.78) * uPulse;
  fragmentColor = vec4(max(color, vec3(0.0)), saturate(alpha));
}`

// WebGL translation of QuotaView's style-9 ripple/glass shader contract.
const RIPPLE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragmentColor;

uniform vec2 uResolution;
uniform float uTime;
uniform float uSpeed;
uniform float uWarp;
uniform float uRidgeAmount;
uniform float uSharpness;
uniform float uExposure;
uniform vec3 uPrimary;
uniform vec3 uSecondary;
uniform vec3 uAccent;
uniform vec3 uUpperHighlight;
uniform vec3 uHighlight;

float softBand(float value, float widthValue) {
  float normalized = value / max(widthValue, 0.0001);
  return exp(-normalized * normalized);
}

void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  p.x *= uResolution.x / max(uResolution.y, 1.0);
  float radius = length(p);
  float sphereRadius = 0.535;
  if (radius > sphereRadius + 0.08) {
    fragmentColor = vec4(0.0);
    return;
  }

  float normalizedRadius = radius / sphereRadius;
  float inside = 1.0 - smoothstep(0.985, 1.015, normalizedRadius);
  float z = sqrt(max(0.0, 1.0 - normalizedRadius * normalizedRadius));
  vec3 normal = normalize(vec3(p / sphereRadius, z));
  float timeValue = uTime * uSpeed * 1.5;
  vec2 warped = p;
  warped.x += sin(p.y * (3.2 + uWarp) + timeValue * 1.13) * (0.05 + uWarp * 0.018);
  warped.y += cos(p.x * (3.8 + uWarp) - timeValue * 0.91) * (0.05 + uWarp * 0.016);

  float fieldA = sin((warped.x + warped.y) * (3.0 + uWarp) + timeValue);
  float fieldB = cos((warped.x - warped.y) * (4.2 + uWarp * 0.7) - timeValue * 0.76);
  float fieldC = sin(radius * (13.0 + uWarp) - timeValue * 1.24);
  float liquid = fieldA * 0.46 + fieldB * 0.34 + fieldC * 0.20;
  float ridge = pow(
    clamp(softBand(liquid, 0.32 - uRidgeAmount * 0.12), 0.0, 1.0),
    max(0.7, uSharpness * 0.68)
  );
  float phase = 0.5 + 0.5 * sin(liquid * 2.8 + timeValue * 0.32);
  vec3 body = phase < 0.5
    ? mix(uPrimary, uSecondary, phase * 2.0)
    : mix(uSecondary, uAccent, (phase - 0.5) * 2.0);
  body = mix(body * 0.46, body, ridge);

  float fresnel = pow(clamp(1.0 - max(normal.z, 0.0), 0.0, 1.0), 2.2);
  float rim = smoothstep(0.20, 0.94, fresnel);
  vec3 key = normalize(vec3(-0.48, 0.66, 0.76));
  float specular = pow(max(dot(normal, key), 0.0), 34.0);
  float upper = pow(max(dot(normal.xy, normalize(vec2(-0.55, 0.83))), 0.0), 4.0);
  vec3 color =
    body * (0.56 + z * 0.54) +
    mix(uAccent, uUpperHighlight, upper) * rim * (0.30 + uRidgeAmount * 0.34) +
    uHighlight * specular * 0.78;
  color *= uExposure * 0.72;

  float edge = softBand(abs(radius - sphereRadius), 0.018);
  color += mix(uSecondary, uHighlight, 0.72) * edge * 0.42;
  float alpha = inside * (0.72 + ridge * 0.24) + edge * 0.72;
  fragmentColor = vec4(clamp(color, 0.0, 1.0), clamp(alpha, 0.0, 1.0));
}`

function compileShader(
  context: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = context.createShader(type)
  if (shader === null) throw new Error('QuotaView activity orb shader allocation failed')
  context.shaderSource(shader, source)
  context.compileShader(shader)
  if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
    const message = context.getShaderInfoLog(shader) ?? 'unknown shader error'
    context.deleteShader(shader)
    throw new Error('QuotaView activity orb shader compilation failed: ' + message)
  }
  return shader
}

function createProgram(
  context: WebGL2RenderingContext,
  fragmentSource: string,
): WebGLProgram {
  const vertex = compileShader(context, context.VERTEX_SHADER, VERTEX_SHADER)
  const fragment = compileShader(context, context.FRAGMENT_SHADER, fragmentSource)
  const program = context.createProgram()
  if (program === null) throw new Error('QuotaView activity orb program allocation failed')
  context.attachShader(program, vertex)
  context.attachShader(program, fragment)
  context.linkProgram(program)
  context.deleteShader(vertex)
  context.deleteShader(fragment)
  if (!context.getProgramParameter(program, context.LINK_STATUS)) {
    const message = context.getProgramInfoLog(program) ?? 'unknown link error'
    context.deleteProgram(program)
    throw new Error('QuotaView activity orb program link failed: ' + message)
  }
  return program
}

function cloneParticleStyle(style: ParticleStyle): ParticleStyle {
  return {
    ...style,
    primary: [...style.primary],
    secondary: [...style.secondary],
    accent: [...style.accent],
  }
}

function approach(start: number, end: number, factor: number): number {
  return start + (end - start) * factor
}

function approachColor(start: Color, end: Color, factor: number): Color {
  return [
    approach(start[0], end[0], factor),
    approach(start[1], end[1], factor),
    approach(start[2], end[2], factor),
  ]
}

function approachStyle(
  current: ParticleStyle,
  target: ParticleStyle,
  factor: number,
): ParticleStyle {
  return {
    primary: approachColor(current.primary, target.primary, factor),
    secondary: approachColor(current.secondary, target.secondary, factor),
    accent: approachColor(current.accent, target.accent, factor),
    speed: approach(current.speed, target.speed, factor),
    speedFloor: approach(current.speedFloor, target.speedFloor, factor),
    motionCycle: approach(current.motionCycle, target.motionCycle, factor),
    tempo: approach(current.tempo, target.tempo, factor),
    response: approach(current.response, target.response, factor),
    energy: approach(current.energy, target.energy, factor),
    turbulence: approach(current.turbulence, target.turbulence, factor),
    pulse: approach(current.pulse, target.pulse, factor),
    desaturation: approach(current.desaturation, target.desaturation, factor),
    volume: approach(current.volume, target.volume, factor),
    refraction: approach(current.refraction, target.refraction, factor),
  }
}

function motionSpeedMultiplier(
  elapsed: number,
  speedFloor: number,
  cycle: number,
): number {
  const safeCycle = Math.max(cycle, 0.001)
  const position = (Math.max(elapsed, 0) % safeCycle) / safeCycle
  const envelope = 0.5 - 0.5 * Math.cos(position * 2 * Math.PI)
  const floor = Math.min(Math.max(speedFloor, 0), 1)
  return floor + (1 - floor) * envelope
}

function resizeCanvas(
  context: WebGL2RenderingContext,
  canvas: HTMLCanvasElement,
): readonly [number, number] {
  const bounds = canvas.getBoundingClientRect()
  const scale = Math.min(devicePixelRatio, 2)
  const width = Math.max(1, Math.round(bounds.width * scale))
  const height = Math.max(1, Math.round(bounds.height * scale))
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
  context.viewport(0, 0, width, height)
  return [width, height]
}

function uniform(
  context: WebGL2RenderingContext,
  program: WebGLProgram,
  name: string,
): WebGLUniformLocation {
  const location = context.getUniformLocation(program, name)
  if (location === null) throw new Error('QuotaView activity orb uniform is missing: ' + name)
  return location
}

export class QuotaViewActivityOrbRenderer {
  private readonly context: WebGL2RenderingContext
  private readonly particleProgram: WebGLProgram
  private readonly rippleProgram: WebGLProgram
  private state: ActivityIslandState = 'standby'
  private mode: ActivityIslandOrbAnimation = 'particleOrb'
  private currentStyle = cloneParticleStyle(PARTICLE_STYLES.standby)
  private targetStyle = cloneParticleStyle(PARTICLE_STYLES.standby)
  private stateElapsed = 0
  private motionPhase = 0
  private lastFrameTime = performance.now()
  private readonly startTime = performance.now()

  constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext('webgl2', {
      alpha: true,
      antialias: true,
      depth: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      stencil: false,
    })
    if (context === null) throw new Error('QuotaView activity orb requires WebGL 2')
    this.context = context
    this.particleProgram = createProgram(context, PARTICLE_FRAGMENT_SHADER)
    this.rippleProgram = createProgram(context, RIPPLE_FRAGMENT_SHADER)
    context.enable(context.BLEND)
    context.blendFunc(context.SRC_ALPHA, context.ONE_MINUS_SRC_ALPHA)
    context.clearColor(0, 0, 0, 0)
  }

  setState(state: ActivityIslandState): void {
    if (state !== this.state) {
      this.state = state
      this.stateElapsed = 0
    }
    this.targetStyle = PARTICLE_STYLES[state]
  }

  setMode(mode: ActivityIslandOrbAnimation): void {
    this.mode = mode
  }

  draw(now: number, reduceMotion: boolean): void {
    const context = this.context
    const [width, height] = resizeCanvas(context, this.canvas)
    context.clear(context.COLOR_BUFFER_BIT)
    const delta = Math.min(Math.max((now - this.lastFrameTime) / 1000, 0), 1 / 15)
    this.lastFrameTime = now

    if (reduceMotion) {
      this.currentStyle = cloneParticleStyle(this.targetStyle)
    } else {
      const factor = Math.min(1, delta * Math.max(0.4, this.targetStyle.response))
      this.currentStyle = approachStyle(this.currentStyle, this.targetStyle, factor)
      this.stateElapsed += delta
      const multiplier = motionSpeedMultiplier(
        this.stateElapsed,
        this.currentStyle.speedFloor,
        this.currentStyle.motionCycle,
      )
      this.motionPhase += delta * this.currentStyle.speed * multiplier * 16
      if (this.motionPhase > 4096) this.motionPhase %= 4096
    }

    if (this.mode === 'rippleGlow') {
      this.drawRipple(width, height, now, reduceMotion)
    } else {
      this.drawParticle(width, height, now, reduceMotion)
    }
  }

  private drawParticle(
    width: number,
    height: number,
    now: number,
    reduceMotion: boolean,
  ): void {
    const context = this.context
    const program = this.particleProgram
    const style = this.currentStyle
    context.useProgram(program)
    context.uniform2f(uniform(context, program, 'uResolution'), width, height)
    context.uniform1f(uniform(context, program, 'uTime'), reduceMotion ? 0.35 : (now - this.startTime) / 1000)
    context.uniform1f(uniform(context, program, 'uMotionPhase'), this.motionPhase)
    context.uniform1f(uniform(context, program, 'uEnergy'), style.energy)
    context.uniform1f(uniform(context, program, 'uTurbulence'), reduceMotion ? 0.04 : style.turbulence)
    context.uniform1f(uniform(context, program, 'uPulse'), reduceMotion ? 0 : style.pulse)
    context.uniform1f(uniform(context, program, 'uDesaturation'), style.desaturation)
    context.uniform1f(uniform(context, program, 'uVolume'), style.volume)
    context.uniform1f(uniform(context, program, 'uRefraction'), style.refraction)
    context.uniform1f(uniform(context, program, 'uTempo'), reduceMotion ? 0 : style.tempo)
    context.uniform1f(
      uniform(context, program, 'uMotionEnergy'),
      reduceMotion ? 0 : motionSpeedMultiplier(this.stateElapsed, 0, style.motionCycle),
    )
    context.uniform3fv(uniform(context, program, 'uPrimary'), style.primary)
    context.uniform3fv(uniform(context, program, 'uSecondary'), style.secondary)
    context.uniform3fv(uniform(context, program, 'uAccent'), style.accent)
    context.drawArrays(context.TRIANGLES, 0, 3)
  }

  private drawRipple(
    width: number,
    height: number,
    now: number,
    reduceMotion: boolean,
  ): void {
    const context = this.context
    const program = this.rippleProgram
    const style = RIPPLE_STYLES[this.state]
    context.useProgram(program)
    context.uniform2f(uniform(context, program, 'uResolution'), width, height)
    context.uniform1f(uniform(context, program, 'uTime'), reduceMotion ? 0.35 : (now - this.startTime) / 1000)
    context.uniform1f(uniform(context, program, 'uSpeed'), reduceMotion ? 0 : style.speed)
    context.uniform1f(uniform(context, program, 'uWarp'), style.warp)
    context.uniform1f(uniform(context, program, 'uRidgeAmount'), style.ridgeAmount)
    context.uniform1f(uniform(context, program, 'uSharpness'), style.sharpness)
    context.uniform1f(uniform(context, program, 'uExposure'), style.exposure)
    context.uniform3fv(uniform(context, program, 'uPrimary'), style.primary)
    context.uniform3fv(uniform(context, program, 'uSecondary'), style.secondary)
    context.uniform3fv(uniform(context, program, 'uAccent'), style.accent)
    context.uniform3fv(uniform(context, program, 'uUpperHighlight'), style.upperHighlight)
    context.uniform3fv(uniform(context, program, 'uHighlight'), style.highlight)
    context.drawArrays(context.TRIANGLES, 0, 3)
  }
}
