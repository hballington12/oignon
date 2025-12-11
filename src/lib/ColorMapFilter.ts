import { Filter, GlProgram } from 'pixi.js'

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

const fragment = `
  in vec2 vTextureCoord;
  out vec4 finalColor;

  uniform sampler2D uTexture;
  uniform float uColormap;

  // Freeze colormap (dark, icy blues)
  vec4 freeze(float t) {
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
  vec4 lavender(float t) {
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
  vec4 voltage(float t) {
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
  vec4 ember(float t) {
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
  vec4 torch(float t) {
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

  vec4 getColormapById(int cm, float t) {
    if (cm == 0) return freeze(t);
    if (cm == 1) return lavender(t);
    if (cm == 2) return voltage(t);
    if (cm == 3) return ember(t);
    if (cm == 4) return torch(t);
    return freeze(t);
  }

  vec4 colormap(float t) {
    t = clamp(t, 0.0, 1.0);

    // Support smooth blending between colormaps
    int cmLow = int(floor(uColormap));
    int cmHigh = int(ceil(uColormap));
    float blend = fract(uColormap);

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
