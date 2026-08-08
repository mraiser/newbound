# nb_three — vendored THREE.js + the `stage` wrapper

The 3D substrate for the bench, wrapping THREE.js the same way
`nb_codemirror` wraps CodeMirror (DESIGN.md §7.2, `docs/flow3d-design.md`
§4.2). **Only `stage.js` imports `three.module.js`; only `floweditor3d`
imports `stage.js`.** No THREE class, vector, or event crosses the
`stage` API in either direction (flow3d-design §7.2, acceptance 5) —
verifiable by grep (see below).

## `three.module.js` — vendored THREE.js r180

`three.module.js` is a one-time build: the upstream `three@0.180.0`
module build (`build/three.module.js` + `build/three.core.js`) bundled
into a single self-contained ESM file, so the bench needs no node
toolchain at runtime and the file resolves no relative specifiers when
served from a library's `_ASSETS` (platform mode). Same posture as
`vendor/nb_codemirror/cm6.js`.

- Upstream package: `three@0.180.0` (r180) from the npm registry
- Built: 2026-07-25
- Command: `npx esbuild@0.25.0 build/three.module.js --bundle --format=esm --minify --banner:js="<license>"` (esbuild 0.25.0)
- sha256(three.module.js): `7c9a2866394787ffd4aa16bc772a9b8577e0e1ef730247584696ad26e37ec534`
- Upstream license: MIT (Copyright 2010-2025 Three.js Authors), preserved as the banner comment.
- `REVISION === "180"` (checked at bundle time).

Only WebGL (not WebGPU) is used: the `three.module.js`/`three.core.js`
pair, never `three.webgpu.js`. `pin a current version` per the task —
r180 was current on the build date.

## `stage.js` — the wrapper

Implements exactly the Appendix-B surface of `docs/flow3d-design.md`:

- `mount(host, opts) → stage` · `upsert(id, spec)` · `patch([spec…])` ·
  `remove(id)` · `clear()`
- KIND vocabulary (the flow visual language, not raw geometry):
  `box · spine-box · capsule · wedge-capsule · cylinder · glass-box ·
  ghost-box · rail · socket · ring · tube · helix · flag · jump-pipe ·
  grid · outline · token`
- Material TOKENS resolved from the bench palette (`tokens.css`):
  `paper · graphite · glass · accent · ghost · ink · hue:<facet> ·
  state:<good|danger|sky|ink>`
- `pick(x,y)` · `onHover(cb)` · `onPick(cb)` · `beginDrag(id, opts)` ·
  `showGizmo`/`hideGizmo`
- camera rig: `frame` · `flyTo` · `getPose`/`setPose` ·
  `setProjection("persp"|"ortho-front")` · `onCameraChange`
- overlay anchoring: `anchor(id, domEl, opts)` · `unanchor(domEl)`
- lifecycle: `setTheme` · `resize` · `screenshot` · `dispose`
- on-demand rendering (renders on state/camera/drag change, never a
  free-running loop) with the bench reduced-motion contract.

### The boundary is grep-checkable

```
# only stage.js may name THREE:
grep -rl "three.module.js" controls/ assets/        # → (nothing)
grep -rln "from \"three\"\|three.module" vendor/nb_three/stage.js   # → the one import
grep -rin "THREE\.\|new Vector3\|Object3D" controls/floweditor3d/   # → (nothing)
```

## Rebuilding THREE

```bash
npm pack three@0.180.0 && tar xzf three-0.180.0.tgz
npx esbuild@0.25.0 package/build/three.module.js \
    --bundle --format=esm --minify \
    --banner:js="$(cat banner.txt)" --outfile=three.module.js
```
`banner.txt` is the license header at the top of the file.
