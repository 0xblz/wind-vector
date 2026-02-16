# Wind Vector

3D wind pattern visualization across US states. Live at [wind-vector.blaze.design](https://wind-vector.blaze.design).

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
      wind-vector-ui.js             # UI controls, events, interaction, splitter
  CNAME                             # Custom domain config
  Gemfile / Gemfile.lock            # Jekyll dependencies
  _site/                            # Jekyll build output (do not edit directly)
  .claude/
    agents/                         # Agent definitions
      threejs-genius.md             # Creative 3D experimentation agent
      threejs-graphics-engineer.md  # Production 3D engineering agent
      frontend-jekyll-dev.md        # Front-end / Jekyll / UI agent
```

## Architecture

### JavaScript Organization

Two files loaded in order: `wind-vector-core.js` first, then `wind-vector-ui.js`.

**Core** (`wind-vector-core.js`) — no dependencies on UI:
- `CONSTANTS` — all magic numbers, grid config, colors, thresholds
- `Config` — runtime settings (state, opacity, storm toggles, etc.)
- `AppState` — mutable application state (scene, camera, renderer, cubes, etc.)
- `StateCoordinates` — lat/lng + zoom for all 50 US states
- `Utils` — formatting, color calculation, coordinate transforms
- `WindCalculator` — wind direction/speed generation (regional patterns, storms, altitude)
- `WindGenerator` — creates/clears the 3D cube grid
- `SceneManager` — Three.js scene, camera, renderer, controls, lighting, ground plane
- `SelectionManager` — flight level selection, arrow visibility
- `LabelsManager` — 3D text sprites (flight levels, compass)
- `MapManager` — Leaflet map init, tile management, texture capture for ground plane
- `AnimationLoop` — requestAnimationFrame loop

**UI** (`wind-vector-ui.js`) — depends on core:
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
- Ground plane texture is captured from Leaflet tiles via canvas
- Wind cubes are `THREE.Mesh` with `BoxGeometry` and `MeshLambertMaterial`
- Arrow elements are DOM nodes positioned via `worldToScreen` projection
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

## Git Rules

- **Never push without explicit user confirmation** — committing locally is fine

## Agent Routing

- **threejs-genius** — creative direction, experimental 3D techniques, visual critique, data-to-physics concepts
- **threejs-graphics-engineer** — production 3D work: scene optimization, shader development, GPU pipeline, performance, compute
- **frontend-jekyll-dev** — HTML/CSS/JS, Jekyll layouts, responsive design, SEO, accessibility, UI components, mobile/Safari fixes
