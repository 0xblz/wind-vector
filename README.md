# Wind Vector

3D wind pattern visualization across US states. Live at [wind-vector.blaze.design](https://wind-vector.blaze.design).

## Features

- Interactive 3D wind field rendered with Three.js
- Animated wind-line particles flowing through the scene, speed-scaled by local wind intensity
- Leaflet map panel with multiple tile layers (OpenStreetMap, Satellite, Terrain)
- Resizable split-panel layout
- Weather simulations (thunderstorm, hurricane categories 1–5) selected via radio buttons
- Hover/click flight level slices to isolate and inspect altitude layers; FL200 selected by default
- Date/time controls
- Wind section: wind direction arrows, wind particles + brightness, cube opacity

## Stack

- **Jekyll** (GitHub Pages) — static site generator
- **Three.js** r128 (via CDN) — 3D wind field rendering
- **Leaflet** 1.9.4 (via CDN) — interactive map panel
- **Vanilla JS** — no frameworks, no bundler
- **CSS** — single stylesheet, no preprocessor
- **Font Awesome** — icons (loaded via kit)
- **Ubuntu Mono** — primary font (Google Fonts)

## Project Structure

```
/
  index.html                        # Main page (Jekyll front matter, all UI markup)
  _layouts/default.html             # HTML shell, CDN scripts, GA tag
  _config.yml                       # Jekyll config (title, description)
  assets/
    css/style.css                   # All styles (single file)
    js/
      wind-vector-core.js           # Data, calculations, 3D scene, visualization
      wind-vector-systems.js        # GPU systems: materials, arrows, particles, slabs, storms
      wind-vector-ui.js             # UI controls, events, interaction, splitter
  CNAME                             # Custom domain config
  Gemfile / Gemfile.lock            # Jekyll dependencies
  _site/                            # Jekyll build output (do not edit directly)
```

## Architecture

### JavaScript Organization

Three files loaded in order: `wind-vector-core.js`, `wind-vector-systems.js`, then `wind-vector-ui.js`.

**Core** (`wind-vector-core.js`) — no dependencies on UI or systems:
- `CONSTANTS` — all magic numbers, grid config, colors, thresholds
- `Config` — runtime settings (state, opacity, storm toggles, etc.)
- `AppState` — mutable application state (scene, camera, renderer, cubes, maps, etc.)
- `StateCoordinates` — lat/lng + zoom for all 50 US states
- `Utils` — formatting, color calculation, coordinate transforms
- `WindCalculator` — wind direction/speed generation (regional patterns, storms, altitude)
- `WindGenerator` — creates/clears the 3D cube grid, builds `windFieldMap` and `windSpeedMap`
- `SceneManager` — Three.js scene, camera, renderer, controls, lighting, ground plane, slice outline frames
- `SelectionManager` — flight level selection, arrow/particle visibility toggles
- `LabelsManager` — 3D text sprites (flight levels, compass)
- `MapManager` — Leaflet map init, tile management, texture capture for ground plane
- `AnimationLoop` — requestAnimationFrame loop

**Systems** (`wind-vector-systems.js`) — depends on core:
- `MaterialPool` — 5 shared `MeshLambertMaterial` instances keyed by wind speed bucket
- `ArrowSystem` — `InstancedMesh` of 3D arrow instances per flight level, with wobble animation
- `ParticleSystem` — 100 `LineSegments` wind streaks flowing through the scene; particle speed scales with local wind intensity via `windSpeedMap`
- `SlabSystem` — bilinearly-interpolated canvas heatmap shown on flight level selection
- `StormSystem` — hurricane spiral lines + thunderstorm updraft lines, each with a point light

**UI** (`wind-vector-ui.js`) — depends on core and systems:
- `UIManager` — GUI setup, tooltip, control bindings
- `TimeControls` — date/time navigation
- `StateManager` — state selection handler
- `EventHandlers` — mouse/touch interaction, hover, click, resize
- `Splitter` — resizable split-panel layout (map/canvas + controls)
- `initApp()` — boot sequence

### Key Patterns

- All modules are plain objects with methods (not classes, not ES modules)
- Global namespace — modules reference each other directly (e.g., `AppState.scene`)
- Three.js uses legacy global `THREE` object (r128, not module imports)
- OrbitControls and BufferGeometryUtils loaded from CDN as globals
- Ground plane texture is captured from Leaflet tiles via canvas (`MeshBasicMaterial` — unaffected by scene lighting)
- Wind cubes are `THREE.Mesh` with shared `BoxGeometry` and per-cube cloned `MeshLambertMaterial`
- Wind particles are `THREE.LineSegments` with head/tail vertices updated each frame; tail trails in the opposite of the velocity direction
- `windFieldMap` and `windSpeedMap` are O(1) `Map` lookups built after grid generation
- Storm simulations use `LineSegments` (spiral for hurricane, vertical for thunderstorm) + `PointLight`
- No build step — edit source files directly, Jekyll serves them

### Layout

- Fixed header bar (2.5rem) with logo + blaze.design link
- Left: app container with vertical split (Leaflet map on top, Three.js canvas below)
- Right: fixed control panel (20rem wide on desktop, bottom sheet on mobile)
- Resizable splitters between map/canvas and between app/controls
- Mobile breakpoint at 800px — controls move to bottom half

### CSS Conventions

- CSS custom properties: `--font-family`, `--secondary-color` (#00bfff)
- Font: Ubuntu Mono monospace
- Dark theme (black bg, white text)
- rem units for spacing, no preprocessor variables
- Single file — no partials or imports (besides Google Fonts)

## Development

```bash
# Install dependencies
bundle install

# Serve locally
bundle exec jekyll serve
```

Site builds automatically on GitHub Pages.
