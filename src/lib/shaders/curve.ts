// Curve shader for animated drawing effect
// Uses uProgress uniform to control how much of the curve is visible
// Compatible with PixiJS v8 shader system

export const curveVertex = /* glsl */ `#version 300 es
  precision highp float;

  in vec2 aPosition;
  in vec2 aUV;

  out vec2 vUV;

  uniform mat3 uProjectionMatrix;
  uniform mat3 uWorldTransformMatrix;
  uniform mat3 uTransformMatrix;

  void main() {
    mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
    gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
    vUV = aUV;
  }
`

export const curveFragment = /* glsl */ `#version 300 es
  precision highp float;

  in vec2 vUV;
  out vec4 finalColor;

  uniform float uProgress;
  uniform vec4 uColor;

  void main() {
    // vUV.x holds the progress along the curve (0 = start, 1 = end)
    if (vUV.x > uProgress) {
      discard;
    }

    finalColor = uColor;
  }
`
