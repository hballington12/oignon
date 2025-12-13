import { Filter, GlProgram } from 'pixi.js'
import { COLORMAPS, type Colormap } from './colormap'

const vertex = `
  in vec2 aPosition;
  out vec2 vTextureCoord;

  uniform vec4 uInputSize;
  uniform vec4 uOutputFrame;
  uniform vec4 uOutputTexture;

  vec4 filterVertexPosition(void) {
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    return vec4(position, 0.0, 1.0);
  }

  vec2 filterTextureCoord(void) {
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
  }

  void main(void) {
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
  }
`

/**
 * Generate GLSL function for a single colormap
 */
function generateColormapFunction(colormap: Colormap, index: number): string {
  const fnName = `colormap${index}`
  const stops = colormap.stops

  // Generate vec4 declarations for each stop
  const stopDecls = stops
    .map(
      (s, i) =>
        `    vec4 c${i} = vec4(${s.r.toFixed(4)}, ${s.g.toFixed(4)}, ${s.b.toFixed(4)}, ${s.t.toFixed(2)});`,
    )
    .join('\n')

  // Generate mix chain for interpolation
  const mixChain = stops
    .slice(0, -1)
    .map((s, i) => {
      const next = stops[i + 1]!
      if (i === stops.length - 2) {
        return `    return mix(c${i}, c${i + 1}, (t - ${s.t.toFixed(2)}) / ${(next.t - s.t).toFixed(2)});`
      }
      return `    if (t < ${next.t.toFixed(2)}) return mix(c${i}, c${i + 1}, (t - ${s.t.toFixed(2)}) / ${(next.t - s.t).toFixed(2)});`
    })
    .join('\n')

  return `
  // ${colormap.name}
  vec4 ${fnName}(float t) {
${stopDecls}

${mixChain}
  }`
}

/**
 * Generate the getColormapById switch function
 */
function generateColormapSwitch(count: number): string {
  const cases = Array.from(
    { length: count },
    (_, i) => `    if (cm == ${i}) return colormap${i}(t);`,
  ).join('\n')

  return `
  vec4 getColormapById(int cm, float t) {
${cases}
    return colormap0(t);
  }`
}

/**
 * Generate complete fragment shader from COLORMAPS
 */
function generateFragmentShader(): string {
  const colormapFunctions = COLORMAPS.map((cm, i) => generateColormapFunction(cm, i)).join('\n')
  const colormapSwitch = generateColormapSwitch(COLORMAPS.length)

  return `
  in vec2 vTextureCoord;
  out vec4 finalColor;

  uniform sampler2D uTexture;
  uniform float uColormap;
${colormapFunctions}
${colormapSwitch}

  vec4 colormap(float t) {
    t = clamp(t, 0.0, 1.0);

    // Support smooth blending between colormaps
    int cmLow = int(floor(uColormap));
    int cmHigh = int(ceil(uColormap));
    float blend = fract(uColormap);

    // Wrap around for smooth looping
    cmHigh = cmHigh >= ${COLORMAPS.length} ? 0 : cmHigh;

    // If no blend needed, just return the colormap
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

  void main(void) {
    vec4 texColor = texture(uTexture, vTextureCoord);

    if (texColor.a == 0.0) {
      finalColor = vec4(0.0, 0.0, 0.0, 0.0);
      return;
    }

    float intensity = texColor.a;
    finalColor = colormap(intensity);
  }
`
}

const fragment = generateFragmentShader()

export class ColorMapFilter extends Filter {
  constructor() {
    const glProgram = GlProgram.from({
      vertex,
      fragment,
    })

    super({
      glProgram,
      resources: {
        colorMapUniforms: {
          uColormap: { value: 0, type: 'f32' },
        },
      },
    })
  }

  get colormap(): number {
    return this.resources.colorMapUniforms.uniforms.uColormap
  }

  set colormap(value: number) {
    this.resources.colorMapUniforms.uniforms.uColormap = value
  }
}
