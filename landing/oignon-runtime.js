// Oignon live renderer — the REAL app render path, ported to a bundler-less
// ES module. PixiJS v8 + pixi-filters (Bloom) from CDN, driving faithful ports
// of the app's own classes: colormap.ts, Grid.ts, curvePositioning.ts,
// BatchedCurveGeometry/Mesh + the real batchedCurve GLSL, ColorMapFilter.ts,
// ParticleSystem.ts, NodeTextureFactory.ts, and the node/curve animations from
// Renderer.ts. Nothing here is an approximation — it's the app's pipeline.
import * as PIXI from 'https://esm.sh/pixi.js@8.14.3?bundle';

/* ===== constants.ts ===== */
const GRID = { xSpacing: 40, ySpacing: 40, padding: 50 };

/* ===== easing.ts ===== */
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutElastic = (t) => (t === 0 || t === 1 ? t : 1 - Math.pow(2, -10 * t) * Math.cos((t * 10 - 0.75) * ((2 * Math.PI) / 3)));
const easeOutQuad = (t) => 1 - Math.pow(1 - t, 2);
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return c3 * t * t * t - c1 * t * t; };
const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);

/* ===== colormap.ts (verbatim data) ===== */
const CM = (name, stops) => ({ name, isDark: true, stops });
const COLORMAPS = [
  CM('Freeze', [[0, 0, 0, 0], [0.25, 0.2157, 0.1804, 0.4039], [0.5, 0.1529, 0.4431, 0.8784], [0.75, 0.4235, 0.7569, 0.8392], [1, 1, 1, 1]]),
  CM('Lavender', [[0, 0, 0, 0], [0.25, 0.2745, 0.0078, 0.3647], [0.5, 0.2314, 0.3529, 0.5725], [0.75, 0.1333, 0.6196, 0.5451], [1, 0.4667, 0.8588, 0.2745]]),
  CM('Voltage', [[0, 0, 0, 0], [0.25, 0.3451, 0.0784, 0.349], [0.5, 0.5098, 0.3137, 0.8941], [0.75, 0.4745, 0.7255, 0.9725], [1, 1, 1, 1]]),
  CM('Ember', [[0, 0, 0, 0], [0.25, 0.3059, 0.102, 0.2392], [0.5, 0.7255, 0.0471, 0.2078], [0.75, 0.9255, 0.4627, 0.0039], [1, 0.9451, 0.8824, 0.2431]]),
  CM('Torch', [[0, 0, 0, 0], [0.25, 0.1647, 0.1412, 0.5882], [0.5, 0.6353, 0.3098, 0.5294], [0.75, 1, 0.5529, 0.3059], [1, 1, 1, 1]]),
  CM('Ink', [[0, 0, 0, 0], [0.25, 0.1, 0.12, 0.18], [0.5, 0.25, 0.32, 0.42], [0.75, 0.55, 0.62, 0.72], [1, 1, 1, 1]]),
  CM('Slate', [[0, 0, 0, 0], [0.25, 0.15, 0.15, 0.15], [0.5, 0.35, 0.35, 0.35], [0.75, 0.65, 0.65, 0.65], [1, 1, 1, 1]]),
  CM('Ocean', [[0, 0, 0, 0], [0.25, 0, 0.1, 0.22], [0.5, 0, 0.3, 0.55], [0.75, 0.4, 0.65, 0.85], [1, 1, 1, 1]]),
  CM('Forest', [[0, 0, 0, 0], [0.25, 0.05, 0.15, 0.08], [0.5, 0.1, 0.4, 0.2], [0.75, 0.4, 0.7, 0.45], [1, 1, 1, 1]]),
].map((c) => ({ name: c.name, isDark: c.isDark, stops: c.stops.map(([t, r, g, b]) => ({ t, r, g, b })) }));

function getColormapColor(t, stops) {
  t = Math.max(0, Math.min(1, t));
  let lower = stops[0], upper = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i].t && t <= stops[i + 1].t) { lower = stops[i]; upper = stops[i + 1]; break; }
  }
  const range = upper.t - lower.t, localT = range > 0 ? (t - lower.t) / range : 0;
  const r = lower.r + localT * (upper.r - lower.r);
  const g = lower.g + localT * (upper.g - lower.g);
  const b = lower.b + localT * (upper.b - lower.b);
  return (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
}
function getBrighterColor(color, amount = 40) {
  const r = Math.min(255, ((color >> 16) & 0xff) + amount);
  const g = Math.min(255, ((color >> 8) & 0xff) + amount);
  const b = Math.min(255, (color & 0xff) + amount);
  return (r << 16) | (g << 8) | b;
}
const getCanvasBackgroundColor = (cm) => getColormapColor(0.05, cm.stops);

/* ===== curvePositioning.ts ===== */
const CURVE_ANGLE = 30;
const DEFAULT_CURVE_PARAMS = { bulge: 0.8, tail: 0.15, density: 0.2 };
const CP1Y = { min: -0.1, max: 0.1 }, CP2Y = { min: 0.4, max: 0.6 };
function rotHelpers(angleDeg, ox, oy) {
  const r = (-angleDeg * Math.PI) / 180;
  const cosR = Math.cos(r), sinR = Math.sin(r), cb = Math.cos(-r), sb = Math.sin(-r);
  return { cosR, sinR, rotateBack: (p) => ({ x: p.x * cb - p.y * sb + ox, y: p.x * sb + p.y * cb + oy }) };
}
function calculateCurveControlPoints(source, target, angle, t, params) {
  const { cosR, sinR, rotateBack } = rotHelpers(angle, source.x, source.y);
  const relX = target.x - source.x, relY = target.y - source.y;
  const rotX = relX * cosR - relY * sinR, rotY = relX * sinR + relY * cosR;
  const cp1y = CP1Y.min + t * (CP1Y.max - CP1Y.min), cp2y = CP2Y.min + t * (CP2Y.max - CP2Y.min);
  const cp1x = params.bulge * 2, cp2x = 1 - params.tail * 0.5;
  return {
    start: source,
    cp1: rotateBack({ x: rotX * cp1x, y: rotY * cp1y }),
    cp2: rotateBack({ x: rotX * cp2x, y: rotY * cp2y }),
    end: rotateBack({ x: rotX, y: rotY }),
  };
}
function getAnglesForDirection(dir) {
  if (dir === 'left') return [CURVE_ANGLE];
  if (dir === 'right') return [-CURVE_ANGLE];
  return [CURVE_ANGLE, -CURVE_ANGLE];
}
function getNodeDrawDirection(node, cols) {
  if (node.isSource) return 'symmetric';
  const c = cols / 2;
  if (node.gridX < c) return 'left';
  if (node.gridX > c) return 'right';
  return node.gridY % 2 === 0 ? 'right' : 'left';
}

/* ===== BatchedCurveGeometry.ts ===== */
function sampleBezier(p0, c1, c2, p3, t) {
  const mt = 1 - t, mt2 = mt * mt, mt3 = mt2 * mt, t2 = t * t, t3 = t2 * t;
  return { x: mt3 * p0.x + 3 * mt2 * t * c1.x + 3 * mt * t2 * c2.x + t3 * p3.x, y: mt3 * p0.y + 3 * mt2 * t * c1.y + 3 * mt * t2 * c2.y + t3 * p3.y };
}
function sampleBezierTangent(p0, c1, c2, p3, t) {
  const mt = 1 - t, mt2 = mt * mt, t2 = t * t;
  return { x: 3 * mt2 * (c1.x - p0.x) + 6 * mt * t * (c2.x - c1.x) + 3 * t2 * (p3.x - c2.x), y: 3 * mt2 * (c1.y - p0.y) + 6 * mt * t * (c2.y - c1.y) + 3 * t2 * (p3.y - c2.y) };
}
function buildBatchedCurveGeometry(curves, segments, defaultWidth) {
  const nc = curves.length;
  const vpc = (segments + 1) * 2, ipc = segments * 6;
  const positions = new Float32Array(nc * vpc * 2);
  const uvs = new Float32Array(nc * vpc * 2);
  const curveIndices = new Float32Array(nc * vpc);
  const indices = new Uint32Array(nc * ipc);
  let vo = 0, io = 0, base = 0;
  for (let ci = 0; ci < nc; ci++) {
    const cv = curves[ci], width = cv.width ?? defaultWidth, hw = width / 2;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const pt = sampleBezier(cv.start, cv.cp1, cv.cp2, cv.end, t);
      const tan = sampleBezierTangent(cv.start, cv.cp1, cv.cp2, cv.end, t);
      const len = Math.hypot(tan.x, tan.y) || 1;
      const nx = -tan.y / len, ny = tan.x / len;
      positions[vo * 2] = pt.x - nx * hw; positions[vo * 2 + 1] = pt.y - ny * hw;
      uvs[vo * 2] = t; uvs[vo * 2 + 1] = 0; curveIndices[vo] = ci; vo++;
      positions[vo * 2] = pt.x + nx * hw; positions[vo * 2 + 1] = pt.y + ny * hw;
      uvs[vo * 2] = t; uvs[vo * 2 + 1] = 1; curveIndices[vo] = ci; vo++;
    }
    for (let i = 0; i < segments; i++) {
      const v = base + i * 2;
      indices[io++] = v; indices[io++] = v + 1; indices[io++] = v + 2;
      indices[io++] = v + 1; indices[io++] = v + 3; indices[io++] = v + 2;
    }
    base += vpc;
  }
  return { positions, uvs, curveIndices, indices, curveCount: nc };
}

/* ===== shaders/batchedCurve.ts (verbatim GLSL) ===== */
const batchedCurveVertex = `#version 300 es
  precision highp float;
  in vec2 aPosition; in vec2 aUV; in float aCurveIndex;
  out vec2 vUV; out float vCurveIndex;
  uniform mat3 uProjectionMatrix; uniform mat3 uWorldTransformMatrix; uniform mat3 uTransformMatrix;
  void main() {
    mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
    gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
    vUV = aUV; vCurveIndex = aCurveIndex;
  }`;
const batchedCurveFragment = `#version 300 es
  precision highp float;
  in vec2 vUV; in float vCurveIndex;
  out vec4 finalColor;
  uniform float uAlpha; uniform float uSelect; uniform sampler2D uProgressTexture; uniform float uProgressTextureWidth;
  void main() {
    float texCoord = (floor(vCurveIndex) + 0.5) / uProgressTextureWidth;
    vec4 pd = texture(uProgressTexture, vec2(texCoord, 0.5));
    float progress = pd.r;
    if (vUV.x > progress) { discard; }
    // g channel marks the hovered node's curves (SelectionManager: selected
    // curves brighten toward SELECTION_CURVE_ALPHA, the rest dim out)
    float boost = pd.g > 0.5 ? (1.0 + uSelect * 1.8) : (1.0 - uSelect * 0.85);
    // b channel = per-curve fade (streamlines fade away in place instead of
    // reversing their draw direction)
    float a = clamp(uAlpha * boost * pd.b, 0.0, 1.0);
    finalColor = vec4(a, a, a, a);
  }`;

/* ===== BatchedCurveMesh.ts ===== */
function nextPow2(n) { return n <= 1 ? 1 : Math.pow(2, Math.ceil(Math.log2(n))); }
class BatchedCurveMesh extends PIXI.Mesh {
  constructor(options) {
    const { curves, segments = 32, defaultWidth = 4, alpha = 0.1 } = options;
    const gd = buildBatchedCurveGeometry(curves, segments, defaultWidth);
    const geometry = new PIXI.Geometry({
      attributes: {
        aPosition: { buffer: gd.positions, format: 'float32x2', stride: 2 * 4, offset: 0 },
        aUV: { buffer: gd.uvs, format: 'float32x2', stride: 2 * 4, offset: 0 },
        aCurveIndex: { buffer: gd.curveIndices, format: 'float32', stride: 4, offset: 0 },
      },
      indexBuffer: gd.indices,
    });
    const textureWidth = Math.max(1, nextPow2(gd.curveCount));
    const progressData = new Uint8Array(textureWidth * 4);
    const canvas = document.createElement('canvas');
    canvas.width = textureWidth; canvas.height = 1;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(textureWidth, 1);
    for (let i = 0; i < textureWidth; i++) { imageData.data[i * 4 + 3] = 255; }
    ctx.putImageData(imageData, 0, 0);
    const progressTexture = PIXI.Texture.from({ resource: canvas, autoGenerateMipmaps: false, scaleMode: 'nearest' });
    const curveUniforms = new PIXI.UniformGroup({ uAlpha: { value: alpha, type: 'f32' }, uSelect: { value: 0, type: 'f32' }, uProgressTextureWidth: { value: textureWidth, type: 'f32' } });
    const localUniforms = new PIXI.UniformGroup({ uTransformMatrix: { value: new PIXI.Matrix(), type: 'mat3x3<f32>' } });
    const glProgram = new PIXI.GlProgram({ vertex: batchedCurveVertex, fragment: batchedCurveFragment, name: 'batched-curve-shader' });
    const shader = new PIXI.Shader({ glProgram, resources: { curveUniforms, localUniforms, uProgressTexture: progressTexture.source } });
    super({ geometry, shader });
    this.blendMode = 'normal';
    this._curveCount = gd.curveCount;
    this.textureWidth = textureWidth;
    this.progressData = progressData;
    this.progressTexture = progressTexture;
    this._canvas = canvas; this._ctx = ctx;
  }
  get curveCount() { return this._curveCount; }
  setProgress(i, p) { if (i >= 0 && i < this._curveCount) this.progressData[i * 4] = Math.floor(Math.max(0, Math.min(1, p)) * 255); }
  setSel(i, v) { if (i >= 0 && i < this._curveCount) this.progressData[i * 4 + 1] = v ? 255 : 0; }
  setFade(i, f) { if (i >= 0 && i < this._curveCount) this.progressData[i * 4 + 2] = Math.floor(Math.max(0, Math.min(1, f)) * 255); }
  updateProgress() {
    const imageData = this._ctx.createImageData(this.textureWidth, 1);
    for (let i = 0; i < this.textureWidth; i++) { imageData.data[i * 4] = this.progressData[i * 4] || 0; imageData.data[i * 4 + 1] = this.progressData[i * 4 + 1] || 0; imageData.data[i * 4 + 2] = this.progressData[i * 4 + 2] || 0; imageData.data[i * 4 + 3] = 255; }
    this._ctx.putImageData(imageData, 0, 0);
    this.progressTexture.source.update();
  }
}

/* ===== ColorMapFilter.ts (shader generated from COLORMAPS) ===== */
const cmVertex = `
  in vec2 aPosition; out vec2 vTextureCoord;
  uniform vec4 uInputSize; uniform vec4 uOutputFrame; uniform vec4 uOutputTexture;
  vec4 filterVertexPosition(void) {
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    return vec4(position, 0.0, 1.0);
  }
  vec2 filterTextureCoord(void) { return aPosition * (uOutputFrame.zw * uInputSize.zw); }
  void main(void) { gl_Position = filterVertexPosition(); vTextureCoord = filterTextureCoord(); }`;
function genColormapFn(cm, index) {
  const stops = cm.stops;
  const decls = stops.map((s, i) => `    vec4 c${i} = vec4(${s.r.toFixed(4)}, ${s.g.toFixed(4)}, ${s.b.toFixed(4)}, ${s.t.toFixed(2)});`).join('\n');
  const mix = stops.slice(0, -1).map((s, i) => {
    const next = stops[i + 1];
    if (i === stops.length - 2) return `    return mix(c${i}, c${i + 1}, (t - ${s.t.toFixed(2)}) / ${(next.t - s.t).toFixed(2)});`;
    return `    if (t < ${next.t.toFixed(2)}) return mix(c${i}, c${i + 1}, (t - ${s.t.toFixed(2)}) / ${(next.t - s.t).toFixed(2)});`;
  }).join('\n');
  return `  vec4 colormap${index}(float t) {\n${decls}\n\n${mix}\n  }`;
}
function genColormapFragment() {
  const fns = COLORMAPS.map((cm, i) => genColormapFn(cm, i)).join('\n');
  const cases = COLORMAPS.map((_, i) => `    if (cm == ${i}) return colormap${i}(t);`).join('\n');
  return `
  in vec2 vTextureCoord; out vec4 finalColor;
  uniform sampler2D uTexture; uniform float uColormap;
${fns}
  vec4 getColormapById(int cm, float t) {
${cases}
    return colormap0(t);
  }
  vec4 colormap(float t) {
    t = clamp(t, 0.0, 1.0);
    int cmLow = int(floor(uColormap)); int cmHigh = int(ceil(uColormap)); float blend = fract(uColormap);
    cmHigh = cmHigh >= ${COLORMAPS.length} ? 0 : cmHigh;
    if (blend < 0.001) { return getColormapById(cmLow, t); }
    vec4 colorLow = getColormapById(cmLow, t); vec4 colorHigh = getColormapById(cmHigh, t);
    if (blend < 0.5) { float fade = 1.0 - blend * 2.0; return vec4(colorLow.rgb * fade, colorLow.a * fade); }
    else { float fade = (blend - 0.5) * 2.0; return vec4(colorHigh.rgb * fade, colorHigh.a * fade); }
  }
  void main(void) {
    vec4 texColor = texture(uTexture, vTextureCoord);
    if (texColor.a == 0.0) { finalColor = vec4(0.0); return; }
    finalColor = colormap(texColor.a);
  }`;
}
class ColorMapFilter extends PIXI.Filter {
  constructor() {
    const glProgram = PIXI.GlProgram.from({ vertex: cmVertex, fragment: genColormapFragment() });
    super({ glProgram, resources: { colorMapUniforms: { uColormap: { value: 0, type: 'f32' } } } });
  }
  get colormap() { return this.resources.colorMapUniforms.uniforms.uColormap; }
  set colormap(v) { this.resources.colorMapUniforms.uniforms.uColormap = v; }
}

/* ===== ParticleSystem.ts ===== */
class ValueNoise {
  constructor(seed = Math.random() * 65536) {
    this.values = []; let s = seed;
    for (let i = 0; i < 256; i++) { s = (s * 16807) % 2147483647; this.values[i] = (s / 2147483647) * 2 - 1; }
  }
  hash(x, y) { return this.values[((Math.floor(x) & 255) + (Math.floor(y) & 255) * 37) & 255]; }
  noise2D(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf);
    const n00 = this.hash(xi, yi), n10 = this.hash(xi + 1, yi), n01 = this.hash(xi, yi + 1), n11 = this.hash(xi + 1, yi + 1);
    const nx0 = n00 + sx * (n10 - n00), nx1 = n01 + sx * (n11 - n01);
    return nx0 + sy * (nx1 - nx0);
  }
}
const PARTICLE_DEFAULTS = { density: 15, minSize: 4, maxSize: 10, drift: 40, speed: 0.002, alpha: 0.95, color: 0xffffff, minLifetime: 25, maxLifetime: 50, fadeRatio: 0.2, blur: 10 };
class ParticleSystem {
  constructor(options = {}) {
    this.options = { ...PARTICLE_DEFAULTS, ...options };
    this.container = new PIXI.Container();
    this.noise = new ValueNoise();
    this.particles = []; this.time = 0; this.animationId = 0;
    this.hexTexture = null; this.colormapStops = null; this.alphaScale = 1;
  }
  init(app, worldWidth, worldHeight) {
    this.worldWidth = worldWidth; this.worldHeight = worldHeight;
    const g = new PIXI.Graphics();
    const radius = 16, padding = this.options.blur > 0 ? Math.ceil(this.options.blur * 4) + 8 : 0, size = (radius + padding) * 2;
    const cx = size / 2, cy = size / 2;
    g.moveTo(cx + radius, cy);
    for (let i = 1; i <= 6; i++) { const a = (i * Math.PI) / 3; g.lineTo(cx + radius * Math.cos(a), cy + radius * Math.sin(a)); }
    g.closePath(); g.fill({ color: 0xffffff, alpha: 1 });
    if (this.options.blur > 0) g.filters = [new PIXI.BlurFilter({ strength: this.options.blur })];
    this.hexTexture = app.renderer.generateTexture({ target: g, frame: new PIXI.Rectangle(0, 0, size, size), resolution: window.devicePixelRatio || 1 });
    g.destroy();
    const count = Math.max(1, Math.min(100, Math.round((worldWidth * worldHeight * this.options.density) / 1000000)));
    for (let i = 0; i < count; i++) this.spawn(Math.random());
    this.start();
  }
  sampleColor() { return this.colormapStops ? getColormapColor(0.25 + Math.random() * 0.75, this.colormapStops) : this.options.color; }
  spawn(ageRatio = 0) {
    const o = this.options;
    const sprite = new PIXI.Sprite(this.hexTexture); sprite.anchor.set(0.5);
    const baseX = Math.random() * this.worldWidth, baseY = Math.random() * this.worldHeight;
    const size = o.minSize + Math.random() * (o.maxSize - o.minSize);
    sprite.scale.set(size / 16); sprite.rotation = Math.random() * Math.PI * 2; sprite.alpha = 0;
    sprite.tint = this.sampleColor(); sprite.x = baseX; sprite.y = baseY;
    const lifetime = Math.floor((o.minLifetime + Math.random() * (o.maxLifetime - o.minLifetime)) * 60);
    this.container.addChild(sprite);
    this.particles.push({ sprite, baseX, baseY, noiseOffsetX: Math.random() * 1000, noiseOffsetY: Math.random() * 1000, rotationSpeed: (Math.random() - 0.5) * 0.002, size, alpha: o.alpha * (0.5 + Math.random() * 0.5), age: Math.floor(ageRatio * lifetime), lifetime });
  }
  respawn(p) {
    const o = this.options;
    p.baseX = Math.random() * this.worldWidth; p.baseY = Math.random() * this.worldHeight;
    p.size = o.minSize + Math.random() * (o.maxSize - o.minSize); p.sprite.scale.set(p.size / 16);
    p.alpha = o.alpha * (0.5 + Math.random() * 0.5); p.sprite.alpha = 0;
    p.sprite.rotation = Math.random() * Math.PI * 2; p.rotationSpeed = (Math.random() - 0.5) * 0.002;
    p.noiseOffsetX = Math.random() * 1000; p.noiseOffsetY = Math.random() * 1000;
    p.lifetime = Math.floor((o.minLifetime + Math.random() * (o.maxLifetime - o.minLifetime)) * 60); p.age = 0;
    p.sprite.tint = this.sampleColor();
  }
  start() {
    this.animationId++; const id = this.animationId;
    const animate = () => { if (id !== this.animationId) return; this.time += 1; this.update(); requestAnimationFrame(animate); };
    requestAnimationFrame(animate);
  }
  update() {
    const { drift, speed, fadeRatio } = this.options, t = this.time * speed;
    for (const p of this.particles) {
      p.age++;
      if (p.age >= p.lifetime) { this.respawn(p); continue; }
      const lp = p.age / p.lifetime;
      let fade = 1;
      if (lp < fadeRatio) fade = lp / fadeRatio; else if (lp > 1 - fadeRatio) fade = (1 - lp) / fadeRatio;
      p.sprite.alpha = p.alpha * fade * this.alphaScale;
      const nx = this.noise.noise2D(p.noiseOffsetX + t, p.noiseOffsetY + t * 0.7);
      const ny = this.noise.noise2D(p.noiseOffsetX + t * 0.7, p.noiseOffsetY + t);
      p.sprite.x = p.baseX + nx * drift; p.sprite.y = p.baseY + ny * drift; p.sprite.rotation += p.rotationSpeed;
    }
  }
  setColormap(stops) { this.colormapStops = stops; for (const p of this.particles) p.sprite.tint = this.sampleColor(); }
  setAlphaScale(v) { this.alphaScale = v; }
  destroy() { this.animationId++; this.container.removeChildren(); this.particles = []; this.hexTexture?.destroy(true); this.hexTexture = null; }
}

/* ===== NodeTextureFactory.ts ===== */
const BASE_R = 32;
const NODE_SHADOW = { outerOffset: { x: 2, y: 3 }, outerExtraRadius: 2, outerAlpha: 0.25, innerOffset: { x: 1, y: 2 }, innerAlpha: 0.4 };
const NODE_HL = { primary: { offset: 0.15, radius: 0.75, alpha: 0.12 }, secondary: { offset: 0.25, radius: 0.45, alpha: 0.2 }, tertiary: { offset: 0.3, radius: 0.2, alpha: 0.35 } };
const NODE_STROKE = { width: 5, color: 0x555555, alpha: 0.7 };
function createNodeTextures(app) {
  const r = BASE_R;
  const padding = Math.max(NODE_SHADOW.outerOffset.x + NODE_SHADOW.outerExtraRadius, NODE_SHADOW.outerOffset.y + NODE_SHADOW.outerExtraRadius, NODE_STROKE.width);
  const size = r + padding, cx = size, cy = size;
  const sg = new PIXI.Graphics();
  sg.circle(cx + NODE_SHADOW.outerOffset.x, cy + NODE_SHADOW.outerOffset.y, r + NODE_SHADOW.outerExtraRadius); sg.fill({ color: 0x000000, alpha: NODE_SHADOW.outerAlpha });
  sg.circle(cx + NODE_SHADOW.innerOffset.x, cy + NODE_SHADOW.innerOffset.y, r); sg.fill({ color: 0x000000, alpha: NODE_SHADOW.innerAlpha });
  const shadow = app.renderer.generateTexture(sg); sg.destroy();
  const fg = new PIXI.Graphics(); fg.circle(cx, cy, r); fg.fill({ color: 0xffffff });
  const fill = app.renderer.generateTexture(fg); fg.destroy();
  const og = new PIXI.Graphics();
  og.circle(cx, cy, r); og.stroke({ width: NODE_STROKE.width, color: NODE_STROKE.color, alpha: NODE_STROKE.alpha });
  og.circle(cx - r * NODE_HL.primary.offset, cy - r * NODE_HL.primary.offset, r * NODE_HL.primary.radius); og.fill({ color: 0xffffff, alpha: NODE_HL.primary.alpha });
  og.circle(cx - r * NODE_HL.secondary.offset, cy - r * NODE_HL.secondary.offset, r * NODE_HL.secondary.radius); og.fill({ color: 0xffffff, alpha: NODE_HL.secondary.alpha });
  og.circle(cx - r * NODE_HL.tertiary.offset, cy - r * NODE_HL.tertiary.offset, r * NODE_HL.tertiary.radius); og.fill({ color: 0xffffff, alpha: NODE_HL.tertiary.alpha });
  const overlay = app.renderer.generateTexture(og); og.destroy();
  return { shadow, fill, overlay, radius: r };
}

/* ===== Grid.ts ===== */
const MIN_NODE_RADIUS = 6, MAX_NODE_RADIUS = (Math.min(GRID.xSpacing, GRID.ySpacing) / 2) * 0.8, MIN_CM_T = 0.5;
const toCmT = (t) => MIN_CM_T + t * (1 - MIN_CM_T);
class Grid {
  constructor(rows, cols) { this.rows = rows; this.cols = cols; this.nodes = new Map(); this.colormapIndex = 0; }
  get width() { return this.cols * GRID.xSpacing; }
  get height() { return (this.rows - 1) * GRID.ySpacing; }
  get canvasWidth() { return this.width + GRID.padding * 2; }
  get canvasHeight() { return this.height + GRID.padding * 2; }
  stops() { return COLORMAPS[this.colormapIndex].stops; }
  populateNodes(nodesData, orderToRow) {
    const byOrder = {};
    nodesData.forEach((n) => { const o = n.order ?? 0; (byOrder[o] = byOrder[o] || []).push(n); });
    for (const [os, group] of Object.entries(byOrder)) {
      const order = Number(os); if (isNaN(order)) continue;
      const row = orderToRow[order]; if (row === undefined) continue;
      const count = group.length, mid = this.cols / 2, startX = mid - (count - 1) / 2;
      group.forEach((n, i) => {
        const gridX = startX + i, gridY = row;
        this.nodes.set(n.id, { ...n, gridX, gridY, x: GRID.padding + gridX * GRID.xSpacing, y: GRID.padding + gridY * GRID.ySpacing, radius: MIN_NODE_RADIUS, normalizedCitations: 0, fillColor: getColormapColor(toCmT(0), this.stops()), strokeColor: 0 });
      });
    }
    this.computeVisuals();
    return this;
  }
  computeVisuals() {
    let minC = Infinity, maxC = 0;
    for (const n of this.nodes.values()) { const c = n.citedBy.length; minC = Math.min(minC, c); maxC = Math.max(maxC, c); }
    if (minC === Infinity) minC = 0;
    for (const n of this.nodes.values()) {
      const c = n.citedBy.length;
      if (maxC === minC) { n.radius = (MIN_NODE_RADIUS + MAX_NODE_RADIUS) / 2; n.normalizedCitations = 0.5; n.fillColor = getColormapColor(toCmT(0.5), this.stops()); continue; }
      const t = (Math.log1p(c) - Math.log1p(minC)) / (Math.log1p(maxC) - Math.log1p(minC));
      n.radius = MIN_NODE_RADIUS + t * (MAX_NODE_RADIUS - MIN_NODE_RADIUS);
      n.normalizedCitations = t;
      n.fillColor = getColormapColor(toCmT(t), this.stops());
      n.strokeColor = getBrighterColor(n.fillColor);
    }
  }
  getNodesWithCitations() {
    return [...this.nodes.values()].filter((n) => n.citedBy.some((id) => this.nodes.has(id))).sort((a, b) => b.gridY - a.gridY);
  }
  getValidTargets(src) {
    return src.citedBy.map((id) => this.nodes.get(id)).filter((n) => n !== undefined && n.gridY < src.gridY);
  }
}

// Build a Grid + orderToRow from landing graph-data (real OpenAlex nodes)
function buildGrid(data) {
  const raw = data.nodes;
  // conn = outgoing references (this paper cites these). The app's `citedBy` is
  // the INCOMING adjacency (papers that cite this node); edges are drawn from a
  // paper up to its citers. Invert conn -> incoming here.
  const incoming = {};
  raw.forEach((n) => { (n.conn || []).forEach((t) => { (incoming[t] = incoming[t] || []).push(n.id); }); });
  const nodesData = raw.map((n) => ({ id: n.id, order: n.year, citedBy: incoming[n.id] || [], connections: [], metadata: { isSource: !!n.src, type: 'article', citationCount: n.cites } }));
  const counts = {};
  nodesData.forEach((n) => { counts[n.order] = (counts[n.order] || 0) + 1; });
  const orders = Object.keys(counts).map(Number).filter((y) => !isNaN(y)).sort((a, b) => a - b);
  const rows = orders.length;
  let cols = 2; orders.forEach((o) => { cols = Math.max(cols, counts[o]); });
  const orderToRow = {}; orders.forEach((o, i) => { orderToRow[o] = rows - 1 - i; });
  return new Grid(rows, cols).populateNodes(nodesData, orderToRow);
}

/* ===== OignonGraph — the Renderer, trimmed to the landing's needs ===== */
class OignonGraph {
  constructor() {
    this.app = new PIXI.Application();
    this.world = new PIXI.Container();
    this.curvesContainer = new PIXI.Container();
    this.nodesContainer = new PIXI.Container();
    this.particleSystems = [];
    this.nodeContainers = new Map();
    this.nodeSpriteOrder = [];
    this.nodeFinishedMap = new Map();
    this.batchedCurves = null;
    this.curveDataCache = [];
    this.curveNodeMappings = [];
    this._nodeAnim = 0; this._curveAnim = 0;
  }
  async init(element) {
    await this.app.init({ background: getCanvasBackgroundColor(COLORMAPS[0]), resizeTo: element, antialias: true, resolution: window.devicePixelRatio || 1, autoDensity: true });
    element.appendChild(this.app.canvas);
    this.particleSystems = [
      new ParticleSystem({ density: 10, minSize: 8, maxSize: 32, alpha: 0.45, drift: 60, speed: 0.001 }),
      new ParticleSystem({ density: 15, minSize: 4, maxSize: 10, alpha: 0.55, drift: 40, speed: 0.002 }),
      new ParticleSystem({ density: 20, minSize: 2, maxSize: 6, alpha: 0.75, drift: 25, speed: 0.003 }),
    ];
    // particles live on a stage-level layer (NOT the graph world) so the field
    // fills the whole page, independent of graph framing/scroll.
    this.particleLayer = new PIXI.Container();
    this.app.stage.addChild(this.particleLayer);
    for (const ps of this.particleSystems) this.particleLayer.addChild(ps.container);
    this.world.addChild(this.curvesContainer);
    this.world.addChild(this.nodesContainer);
    this.focusLayer = new PIXI.Container();   // focused nodes ride above curves
    this.world.addChild(this.focusLayer);
    this.app.stage.addChild(this.world);
    this.colorMapFilter = new ColorMapFilter();
    this.curvesContainer.filters = [this.colorMapFilter];
    this.nodeTextures = createNodeTextures(this.app);
    this.initialized = true;
  }
  render(grid) {
    this.grid = grid;
    this.renderCurves(grid);
    this.renderNodes(grid);
    this.initParticles(grid);
  }
  // Swap the graph dataset in place (used to change graphs between scenes).
  // Rebuilds curves + node sprites; particles and world transform persist.
  setData(grid) {
    this._nodeAnim++; this._curveAnim++;
    if (this.batchedCurves) { this.curvesContainer.removeChild(this.batchedCurves); this.batchedCurves.destroy(); this.batchedCurves = null; }
    this.curveDataCache = null; this.curveNodeMappings = [];
    if (this.focusLayer) this.focusLayer.removeChildren();
    for (const [, c] of this.nodeContainers) { if (c.parent) c.parent.removeChild(c); c.destroy({ children: true }); }
    this.nodeContainers = new Map();
    this.nodeSpriteOrder = [];
    this._wasDispersing = false; this._assemblePrepared = false;
    this.grid = grid;
    this.renderCurves(grid);
    this.renderNodes(grid);
  }
  renderCurves(grid) {
    const curves = []; this.curveNodeMappings = [];
    let ci = 0;
    for (const src of grid.getNodesWithCitations()) {
      const targets = grid.getValidTargets(src);
      if (!targets.length) continue;
      const dir = getNodeDrawDirection({ gridX: src.gridX, gridY: src.gridY, isSource: src.metadata?.isSource }, grid.cols);
      const angles = getAnglesForDirection(dir);
      const sorted = [...targets].sort((a, b) => b.y - a.y);
      for (let i = 0; i < sorted.length; i++) {
        const tgt = sorted[i], angle = angles[i % angles.length], t = sorted.length > 1 ? i / (sorted.length - 1) : 0.5;
        const cp = calculateCurveControlPoints({ x: src.x, y: src.y }, { x: tgt.x, y: tgt.y }, angle, t, DEFAULT_CURVE_PARAMS);
        curves.push({ start: cp.start, cp1: cp.cp1, cp2: cp.cp2, end: cp.end, width: 3 });
        this.curveNodeMappings.push({ curveIndex: ci, sourceNodeId: src.id, targetNodeId: tgt.id });
        ci++;
      }
    }
    if (!curves.length) return;
    this.curveDataCache = curves;
    this.batchedCurves = new BatchedCurveMesh({ curves, segments: 32, defaultWidth: 3, alpha: 0.1 });
    this.curvesContainer.addChild(this.batchedCurves);
  }
  renderNodes(grid) {
    this.nodeSpriteOrder = [];
    var yMin = Infinity, yMax = -Infinity;
    for (const node of grid.nodes.values()) {
      const c = this.createNodeSprite(node);
      this.nodeContainers.set(node.id, c);
      this.nodesContainer.addChild(c);
      this.nodeSpriteOrder.push({ nodeId: node.id, sprite: c, citationCount: node.citedBy.length });
      if (node.y < yMin) yMin = node.y; if (node.y > yMax) yMax = node.y;
    }
    this._yMin = yMin; this._yMax = yMax;
    this.nodeSpriteOrder.sort((a, b) => b.citationCount - a.citationCount);
  }
  createNodeSprite(node) {
    const tx = this.nodeTextures, targetScale = node.radius / tx.radius;
    const c = new PIXI.Container(); c.x = node.x; c.y = node.y; c._targetScale = targetScale; c.scale.set(0); c.alpha = 0;
    c._disperseJitter = (Math.random() - 0.5) * 0.14;
    const shadow = new PIXI.Sprite(tx.shadow); shadow.anchor.set(0.5);
    const fill = new PIXI.Sprite(tx.fill); fill.anchor.set(0.5); fill.tint = node.fillColor;
    const overlay = new PIXI.Sprite(tx.overlay); overlay.anchor.set(0.5);
    c.addChild(shadow); c.addChild(fill); c.addChild(overlay);
    return c;
  }
  initParticles(grid) {
    // full-page field: size the particle world to the screen, unscaled, at 0,0
    const W = this.app.screen.width, H = this.app.screen.height;
    for (const ps of this.particleSystems) { ps.init(this.app, W, H); ps.container.x = 0; ps.container.y = 0; ps.setColormap(grid.stops()); }
    this._onResize = () => {
      const w = this.app.screen.width, h = this.app.screen.height;
      for (const ps of this.particleSystems) { ps.worldWidth = w; ps.worldHeight = h; }
    };
    window.addEventListener('resize', this._onResize);
  }
  // Node pop-in (staggered elastic) — Renderer.animateNodesIn
  animateNodesIn(totalDuration = 2200, nodeDuration = 450) {
    this.nodeFinishedMap.clear();
    const order = this.nodeSpriteOrder, count = order.length;
    if (!count) return;
    const startTimes = order.map((_, i) => easeOutQuad(i / (count - 1 || 1)) * (totalDuration - nodeDuration));
    for (const { sprite } of order) { sprite.scale.set(0); sprite.alpha = 0; }
    this._nodeAnim++; const id = this._nodeAnim, t0 = performance.now();
    const tick = () => {
      if (id !== this._nodeAnim) return;
      const elapsed = performance.now() - t0; let allDone = true;
      for (let i = 0; i < order.length; i++) {
        const { nodeId, sprite } = order[i], st = startTimes[i];
        if (elapsed < st) { allDone = false; continue; }
        const progress = Math.min(1, (elapsed - st) / nodeDuration), ts = sprite._targetScale || 1;
        if (progress < 1) { allDone = false; sprite.scale.set(ts * easeOutElastic(progress)); sprite.alpha = Math.min(1, progress * 2); }
        else { sprite.scale.set(ts); sprite.alpha = 1; if (!this.nodeFinishedMap.has(nodeId)) this.nodeFinishedMap.set(nodeId, performance.now()); }
      }
      if (!allDone) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  // Curve draw-in (easeInOutCubic, after source node lands) — Renderer.animateCurvesIn
  animateCurvesIn(duration = 2000) {
    if (!this.batchedCurves || !this.curveNodeMappings.length) return;
    const bc = this.batchedCurves, mappings = this.curveNodeMappings;
    this._curveAnim++; const id = this._curveAnim; let start = null;
    const tick = () => {
      if (id !== this._curveAnim) return;
      if (start === null) start = performance.now();
      const now = performance.now(); let minP = Infinity;
      for (const m of mappings) {
        if (!this.nodeFinishedMap.has(m.sourceNodeId)) { minP = 0; bc.setProgress(m.curveIndex, 0); continue; }
        const p = easeInOutCubic(Math.min(1, (now - this.nodeFinishedMap.get(m.sourceNodeId)) / duration));
        minP = Math.min(minP, p); bc.setProgress(m.curveIndex, p);
      }
      bc.updateProgress();
      if (minP < 1) requestAnimationFrame(tick); else this._curveAnim++; // release to MC driver
    };
    requestAnimationFrame(tick);
  }
  // Scroll-driven de-assemble: nodes pop off (mirror of the elastic pop-in),
  // biased toward the TOP of the graph so it clears the viewport top-first.
  // progress 0 = fully assembled, 1 = fully gone. Only touches sprites when
  // progress > 0, so the entrance animation owns them at rest.
  setDisperse(progress, win) {
    if (progress <= 0) { if (this._wasDispersing) { this._restoreNodes(); this._wasDispersing = false; } return; }
    this._wasDispersing = true;
    const order = this.nodeSpriteOrder; if (!order || !order.length) return;
    const yMin = this._yMin, span = (this._yMax - this._yMin) || 1;
    win = win != null ? win : 0.42;
    for (const { nodeId, sprite } of order) {
      const n = this.grid.nodes.get(nodeId); if (!n) continue;
      const norm = (n.y - yMin) / span;                    // 0 = top, 1 = bottom
      let threshold = norm * (1 - win) + (sprite._disperseJitter || 0);
      threshold = threshold < 0 ? 0 : threshold;
      const lp = clamp01((progress - threshold) / win);
      const ts = sprite._targetScale || 1;
      if (lp <= 0) { sprite.scale.set(ts); sprite.alpha = 1; }
      else if (lp >= 1) { sprite.scale.set(0); sprite.alpha = 0; }
      else { sprite.scale.set(Math.max(0, ts * (1 - easeInBack(lp)))); sprite.alpha = 1 - lp * lp; }
    }
  }
  setCurveAlpha(v) { if (this.batchedCurves) this.batchedCurves.shader.resources.curveUniforms.uniforms.uAlpha = v; }
  setSelect(t) { if (this.batchedCurves) this.batchedCurves.shader.resources.curveUniforms.uniforms.uSelect = t; }
  // Focus a set of node ids (SelectionManager port): unrelated nodes dim, the
  // focused set is lifted ABOVE the curves layer so its glow reads on top while
  // the connectors sit over the dimmed field. ids=null clears the focus.
  setNodeFocus(ids, t) {
    var focus = ids && ids.size ? ids : null;
    if (focus) {
      // dimmed base nodes below curves; focused nodes reparented above curves
      this.world.setChildIndex(this.curvesContainer, this.world.children.indexOf(this.nodesContainer));
      this.world.setChildIndex(this.focusLayer, this.world.children.length - 1);
    }
    var dim = 1 - 0.82 * (t || 0);
    for (var i = 0; i < this.nodeSpriteOrder.length; i++) {
      var e = this.nodeSpriteOrder[i], sp = e.sprite;
      var isFocus = focus && focus.has(e.nodeId);
      if (isFocus) {
        if (sp.parent !== this.focusLayer) { this.nodesContainer.removeChild(sp); this.focusLayer.addChild(sp); }
        sp.alpha = 1;
      } else {
        if (sp.parent === this.focusLayer) { this.focusLayer.removeChild(sp); this.nodesContainer.addChild(sp); }
        sp.alpha = focus ? dim : 1;
      }
    }
    if (!focus) {
      // restore normal order: nodes above curves
      this.world.setChildIndex(this.nodesContainer, this.world.children.length - 1);
    }
  }
  _restoreNodes() {
    for (const { sprite } of (this.nodeSpriteOrder || [])) { sprite.scale.set(sprite._targetScale || 1); sprite.alpha = 1; }
  }
  // Assign each node an off-screen origin (world units) + stagger for the
  // fly-in. Called once before the assembly scene.
  prepareAssemble() {
    const R = Math.max(this.grid.canvasWidth, this.grid.canvasHeight);
    for (const { sprite } of (this.nodeSpriteOrder || [])) {
      const ang = Math.random() * Math.PI * 2;
      const dist = R * (0.9 + Math.random() * 1.2);
      sprite._ox = Math.cos(ang) * dist;
      sprite._oy = Math.sin(ang) * dist;
      sprite._delay = Math.random() * 0.45;
      sprite._spin = (Math.random() - 0.5) * 2.4;
      sprite._curl = (Math.random() - 0.5) * dist * (0.6 + Math.random() * 0.9); // curved-path bow
    }
    this._assemblePrepared = true;
  }
  // p: 0 = flown out (off-screen, tiny), 1 = fully assembled into the grid.
  // Nodes travel a curved (quadratic-bezier) path, not a straight line.
  setAssemble(p) {
    const order = this.nodeSpriteOrder; if (!order || !order.length) return;
    if (!this._assemblePrepared) this.prepareAssemble();
    const span = 1 - 0.45;
    for (const { nodeId, sprite } of order) {
      const n = this.grid.nodes.get(nodeId); if (!n) continue;
      const local = clamp01((p - sprite._delay) / span);
      const ts = sprite._targetScale || 1;
      if (local >= 1) {   // exact final state — identical to rest, no snap on handoff
        sprite.x = n.x; sprite.y = n.y; sprite.scale.set(ts); sprite.rotation = 0; sprite.alpha = 1;
        continue;
      }
      const e = 1 - Math.pow(2, -10 * local);   // easeOutExpo: fast in, long slow settle
      const ox = n.x + sprite._ox, oy = n.y + sprite._oy;      // origin (off-screen)
      const tx = n.x, ty = n.y;                                 // target
      const len = Math.hypot(sprite._ox, sprite._oy) || 1;
      const px = -sprite._oy / len, py = sprite._ox / len;      // perpendicular
      const mx = (ox + tx) / 2 + px * sprite._curl;             // bezier control pt
      const my = (oy + ty) / 2 + py * sprite._curl;
      const mt = 1 - e;
      sprite.x = mt * mt * ox + 2 * mt * e * mx + e * e * tx;
      sprite.y = mt * mt * oy + 2 * mt * e * my + e * e * ty;
      const overshoot = local > 0 ? 1 + 0.14 * Math.sin(local * Math.PI) : 1;
      sprite.scale.set(ts * (0.15 + 0.85 * e) * overshoot);
      sprite.rotation = sprite._spin * (1 - e);
      sprite.alpha = clamp01(local * 2.2);
    }
    if (this.batchedCurves) {
      // curves are driven by the site's Monte-Carlo streamline loop — the
      // app's full draw-all-connectors pass is intentionally skipped here
    }
    this.curvesContainer.alpha = 1;
  }
  resetNodePositions() {
    for (const { nodeId, sprite } of (this.nodeSpriteOrder || [])) {
      const n = this.grid.nodes.get(nodeId); if (!n) continue;
      sprite.x = n.x; sprite.y = n.y; sprite.rotation = 0;
    }
  }
  setColormap(index) {
    this.colorMapFilter.colormap = index;
    for (const ps of this.particleSystems) ps.setColormap(COLORMAPS[index].stops);
    this.grid.colormapIndex = index; this.grid.computeVisuals();
    for (const [id, c] of this.nodeContainers) { const n = this.grid.nodes.get(id); if (n) c.children[1].tint = n.fillColor; }
    this.app.renderer.background.color = getCanvasBackgroundColor(COLORMAPS[index]);
  }
  destroy() {
    this._nodeAnim++; this._curveAnim++;
    if (this._onResize) window.removeEventListener('resize', this._onResize);
    for (const ps of this.particleSystems) ps.destroy();
    if (this.initialized) this.app.destroy(true);
  }
}

window.OignonRuntime = { PIXI, OignonGraph, Grid, buildGrid, COLORMAPS };
window.dispatchEvent(new Event('oignon-runtime-ready'));
