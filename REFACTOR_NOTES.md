# Refactor Notes

Things to clean up after getting the port working.

## Completed Optimizations (Animation & Curves)

- [x] **Phase 1.1**: Fixed RenderTexture - now draws directly during animation, only uses texture for final static result
- [x] **Phase 1.2**: Cached curve geometry - `buildCurveCache()` pre-calculates all control points before animation starts
- [x] **Phase 1.3**: Skip unnecessary redraws - only redraws when progress changes by >0.005
- [x] **Phase 2.1**: Ribbon tapering - curves now taper to a point in the last 30% during animation
- [x] **Phase 2.2**: Whippy easing - 3-phase easing (anticipation → snap → settle) instead of linear
- [x] **Phase 2.3**: Timing overlap - curves start 1200ms into node animation for more energetic flow
- [x] **Phase 3.1**: Draw directly during animation - bypasses RenderTexture until animation completes

## Architecture

- [ ] Grid class does too much - split into: NodeManager, CurveRenderer, SelectionManager
- [ ] grid/* modules mutate Grid directly - should return data, let Grid apply it
- [ ] Rendering logic mixed with state - separate concerns

## Curves

- [ ] Multiple curve modes (CURVE1, CURVE2, SANKEY) - pick one, delete others
- [ ] `curveOverhang` / `curveUnderhang` hack to expand canvas - find cleaner solution
- [ ] connectorRenderer.js is 400+ lines - break down
- [ ] bezier.js + controls.js coupling is confusing

## Nodes

- [ ] Node class has Graphics as property - should be render-only data
- [ ] Colormap logic duplicated between Node.js and ColorMapFilter.js

## State

- [ ] Selection animation state lives on Grid - should be in store or composable
- [ ] Callbacks (onNodeHover, onNodeClick, onSelectionChange) - use Vue events instead

## Code Quality

- [ ] Lots of `grid.nodes.values()` iterations - consider index structures
- [ ] Magic numbers everywhere (30 degree angle, 0.75 alpha divisor, etc)
- [ ] Duplicate target filtering logic in multiple places

## To Investigate

- [ ] Why does source node get special left/right split treatment?
- [ ] What's the purpose of the colormap filter on curves?
- [ ] Is the offscreen RenderTexture approach necessary?

## controls.js observations

- curveParams (bulge, tail, density) are UI-tunable but have hardcoded defaults
- getCp1x/getCp2x/getDensity/getInnerBulgeFactor are derived values - could just compute inline
- DOM manipulation mixed with state - classic separation issue
- currentColormap is module-level mutable state - should be in store

## bezier.js observations

- Pure math utilities - these are fine, just need types
- createRotationHelpers returns closures - works but slightly over-engineered
- 30 degree rotation angle is magic number used in connectorRenderer
