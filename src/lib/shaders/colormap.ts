// Colormap shader utilities
// Injects colormap functions into fragment shaders for GPU-based color mapping

/**
 * GLSL colormap functions - matches the legacy ColorMapFilter exactly
 * Each colormap interpolates between 5 color stops at t = 0, 0.25, 0.5, 0.75, 1.0
 */
export const COLORMAP_GLSL = /* glsl */ `
// Freeze colormap (dark, icy blues)
vec4 colormapFreeze(float t) {
  vec4 c0 = vec4(0.0, 0.0, 0.0, 0.0);
  vec4 c1 = vec4(0.2157, 0.1804, 0.4039, 0.25);
  vec4 c2 = vec4(0.1529, 0.4431, 0.8784, 0.5);
  vec4 c3 = vec4(0.4235, 0.7569, 0.8392, 0.75);
  vec4 c4 = vec4(1.0, 1.0, 1.0, 1.0);

  if (t < 0.25) return mix(c0, c1, t / 0.25);
  if (t < 0.5) return mix(c1, c2, (t - 0.25) / 0.25);
  if (t < 0.75) return mix(c2, c3, (t - 0.5) / 0.25);
  return mix(c3, c4, (t - 0.75) / 0.25);
}

// Lavender colormap (dark, purple to green)
vec4 colormapLavender(float t) {
  vec4 c0 = vec4(0.0, 0.0, 0.0, 0.0);
  vec4 c1 = vec4(0.2745, 0.0078, 0.3647, 0.25);
  vec4 c2 = vec4(0.2314, 0.3529, 0.5725, 0.5);
  vec4 c3 = vec4(0.1333, 0.6196, 0.5451, 0.75);
  vec4 c4 = vec4(0.4667, 0.8588, 0.2745, 1.0);

  if (t < 0.25) return mix(c0, c1, t / 0.25);
  if (t < 0.5) return mix(c1, c2, (t - 0.25) / 0.25);
  if (t < 0.75) return mix(c2, c3, (t - 0.5) / 0.25);
  return mix(c3, c4, (t - 0.75) / 0.25);
}

// Voltage colormap (dark, purple electric)
vec4 colormapVoltage(float t) {
  vec4 c0 = vec4(0.0, 0.0, 0.0, 0.0);
  vec4 c1 = vec4(0.3451, 0.0784, 0.349, 0.25);
  vec4 c2 = vec4(0.5098, 0.3137, 0.8941, 0.5);
  vec4 c3 = vec4(0.4745, 0.7255, 0.9725, 0.75);
  vec4 c4 = vec4(1.0, 1.0, 1.0, 1.0);

  if (t < 0.25) return mix(c0, c1, t / 0.25);
  if (t < 0.5) return mix(c1, c2, (t - 0.25) / 0.25);
  if (t < 0.75) return mix(c2, c3, (t - 0.5) / 0.25);
  return mix(c3, c4, (t - 0.75) / 0.25);
}

// Ember colormap (dark, fire)
vec4 colormapEmber(float t) {
  vec4 c0 = vec4(0.0, 0.0, 0.0, 0.0);
  vec4 c1 = vec4(0.3059, 0.102, 0.2392, 0.25);
  vec4 c2 = vec4(0.7255, 0.0471, 0.2078, 0.5);
  vec4 c3 = vec4(0.9255, 0.4627, 0.0039, 0.75);
  vec4 c4 = vec4(0.9451, 0.8824, 0.2431, 1.0);

  if (t < 0.25) return mix(c0, c1, t / 0.25);
  if (t < 0.5) return mix(c1, c2, (t - 0.25) / 0.25);
  if (t < 0.75) return mix(c2, c3, (t - 0.5) / 0.25);
  return mix(c3, c4, (t - 0.75) / 0.25);
}

// Torch colormap (dark, purple to orange)
vec4 colormapTorch(float t) {
  vec4 c0 = vec4(0.0, 0.0, 0.0, 0.0);
  vec4 c1 = vec4(0.1647, 0.1412, 0.5882, 0.25);
  vec4 c2 = vec4(0.6353, 0.3098, 0.5294, 0.5);
  vec4 c3 = vec4(1.0, 0.5529, 0.3059, 0.75);
  vec4 c4 = vec4(1.0, 1.0, 1.0, 1.0);

  if (t < 0.25) return mix(c0, c1, t / 0.25);
  if (t < 0.5) return mix(c1, c2, (t - 0.25) / 0.25);
  if (t < 0.75) return mix(c2, c3, (t - 0.5) / 0.25);
  return mix(c3, c4, (t - 0.75) / 0.25);
}

// Select colormap by index (matches COLORMAPS array order)
vec4 getColormapById(int cm, float t) {
  if (cm == 0) return colormapFreeze(t);
  if (cm == 1) return colormapLavender(t);
  if (cm == 2) return colormapVoltage(t);
  if (cm == 3) return colormapEmber(t);
  if (cm == 4) return colormapTorch(t);
  return colormapFreeze(t);
}

// Apply colormap with smooth blending between adjacent colormaps
// uColormap can be fractional (e.g., 1.5 blends between lavender and voltage)
// Transition fades through black for smooth switching
vec4 applyColormap(float intensity, float uColormap) {
  float t = clamp(intensity, 0.0, 1.0);

  int cmLow = int(floor(uColormap));
  int cmHigh = int(ceil(uColormap));
  float blend = fract(uColormap);

  // No blend needed - return single colormap
  if (blend < 0.001) {
    return getColormapById(cmLow, t);
  }

  // Fade through black: first half fades out, second half fades in
  vec4 colorLow = getColormapById(cmLow, t);
  vec4 colorHigh = getColormapById(cmHigh, t);

  if (blend < 0.5) {
    // Fade out old colormap (blend 0->0.5 maps to fade 1->0)
    float fade = 1.0 - blend * 2.0;
    return vec4(colorLow.rgb * fade, colorLow.a * fade);
  } else {
    // Fade in new colormap (blend 0.5->1 maps to fade 0->1)
    float fade = (blend - 0.5) * 2.0;
    return vec4(colorHigh.rgb * fade, colorHigh.a * fade);
  }
}
`

/**
 * Colormap uniform declaration to inject into shaders
 */
export const COLORMAP_UNIFORM = /* glsl */ `
uniform float uColormap;
`

/**
 * Injects colormap functions and uniform into a fragment shader.
 * The shader should call applyColormap(intensity, uColormap) to get the final color.
 *
 * @param fragmentShader - The original fragment shader source
 * @returns Modified shader with colormap functions injected after precision statement
 */
export function injectColormapFunctions(fragmentShader: string): string {
  // Find the end of precision statements (after "precision highp float;")
  const precisionMatch = fragmentShader.match(/precision\s+\w+\s+float\s*;/)
  if (!precisionMatch) {
    // No precision statement found, inject after #version
    const versionMatch = fragmentShader.match(/#version\s+\d+\s+es\s*\n/)
    if (versionMatch) {
      const insertPos = versionMatch.index! + versionMatch[0].length
      return (
        fragmentShader.slice(0, insertPos) +
        '\n' +
        COLORMAP_UNIFORM +
        '\n' +
        COLORMAP_GLSL +
        '\n' +
        fragmentShader.slice(insertPos)
      )
    }
    // Fallback: prepend
    return COLORMAP_UNIFORM + '\n' + COLORMAP_GLSL + '\n' + fragmentShader
  }

  const insertPos = precisionMatch.index! + precisionMatch[0].length
  return (
    fragmentShader.slice(0, insertPos) +
    '\n' +
    COLORMAP_UNIFORM +
    '\n' +
    COLORMAP_GLSL +
    '\n' +
    fragmentShader.slice(insertPos)
  )
}
