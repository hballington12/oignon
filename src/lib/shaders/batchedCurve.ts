// Batched curve shader for rendering multiple curves in one draw call
// Uses a data texture to look up per-curve progress values
// WARNING: Do not modify GLSL shader code without explicit user consent

export const batchedCurveVertex = /* glsl */ `#version 300 es
  precision highp float;

  in vec2 aPosition;
  in vec2 aUV;
  in float aCurveIndex;

  out vec2 vUV;
  out float vCurveIndex;

  uniform mat3 uProjectionMatrix;
  uniform mat3 uWorldTransformMatrix;
  uniform mat3 uTransformMatrix;

  void main() {
    mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
    gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
    vUV = aUV;
    vCurveIndex = aCurveIndex;
  }
`

export const batchedCurveFragment = /* glsl */ `#version 300 es
  precision highp float;

  in vec2 vUV;
  in float vCurveIndex;

  out vec4 finalColor;

  uniform float uAlpha;
  uniform sampler2D uProgressTexture;
  uniform float uProgressTextureWidth;

  void main() {
    // Look up progress for this curve from the data texture
    // Each pixel stores one progress value in the red channel
    float texCoord = (floor(vCurveIndex) + 0.5) / uProgressTextureWidth;
    float progress = texture(uProgressTexture, vec2(texCoord, 0.5)).r;

    // vUV.x holds the progress along the curve (0 = start, 1 = end)
    if (vUV.x > progress) {
      discard;
    }

    // Output white with alpha - colormap filter will post-process this
    // Overlapping curves accumulate alpha, creating intensity variation
    // PixiJS uses premultiplied alpha: rgb must be multiplied by alpha
    finalColor = vec4(uAlpha, uAlpha, uAlpha, uAlpha);
  }
`
