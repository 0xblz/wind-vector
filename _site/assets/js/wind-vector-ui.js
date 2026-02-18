// =============================================================================
// WIND VECTOR - UI
// User interface, controls, events, and interaction handling
// Depends on: wind-vector-core.js, wind-vector-systems.js (must be loaded first)
// =============================================================================

// =============================================================================
// UI MANAGER
// =============================================================================

const UIManager = {
  init() {
    this.setupGUI();
    this.createTooltip();
    TimeControls.updateDisplay();
  },

  createTooltip() {
    AppState.tooltip    = document.createElement('div');
    AppState.tooltip.id = 'tooltip';
    document.body.appendChild(AppState.tooltip);
  },

  showTooltip(cube, clientX, clientY) {
    const stateData = getStateData(Config.settings.state);
    if (!stateData) return;

    const bounds      = stateData.bounds;
    const normalizedX = Utils.normalizeGridPosition(cube.position.x);
    const normalizedZ = Utils.normalizeGridPosition(cube.position.z);

    const lat = bounds[0][0] + (bounds[1][0] - bounds[0][0]) * (1 - normalizedZ);
    const lon = bounds[0][1] + (bounds[1][1] - bounds[0][1]) * normalizedX;

    const windDir      = cube.userData.windDirection;
    const windAngle    = Math.atan2(windDir.z, windDir.x) * 180 / Math.PI;
    const windDirection = ((windAngle + 360) % 360).toFixed(0);

    const latStr = Math.abs(lat).toFixed(2) + '°' + (lat >= 0 ? 'N' : 'S');
    const lonStr = Math.abs(lon).toFixed(2) + '°' + (lon >= 0 ? 'E' : 'W');

    AppState.tooltip.innerHTML =
      `FL${String(cube.userData.flightLevel).padStart(3, '0')}<br/>` +
      `Wind: ${cube.userData.speed} kt @ ${windDirection}°<br/>` +
      `${latStr} ${lonStr}`;
    AppState.tooltip.className    = 'visible';
    AppState.tooltip.style.left   = (clientX + 10) + 'px';
    AppState.tooltip.style.top    = (clientY - 10) + 'px';
  },

  hideTooltip() {
    if (AppState.tooltip) {
      AppState.tooltip.className = '';
    }
  },

  setupGUI() {
    this.setupStateSelect();
    this.setupMapStyleSelect();
this.setupWindParticlesToggle();
    this.setupWindArrowsToggle();
    this.setupCubeOpacitySlider();
    this.setupParticleOpacitySlider();
    this.setupStormControls();
    TimeControls.setupControls();
  },

  setupStateSelect() {
    const stateSelect = document.getElementById('gui-state');
    if (!stateSelect) return;

    Object.keys(StateCoordinates).forEach(stateName => {
      const option      = document.createElement('option');
      option.value      = stateName;
      option.textContent = stateName;
      option.selected   = stateName === Config.settings.state;
      stateSelect.appendChild(option);
    });

    stateSelect.addEventListener('change', (e) => StateManager.updateState(e.target.value));
  },

  setupMapStyleSelect() {
    const mapStyleSelect = document.getElementById('gui-map-style');
    if (!mapStyleSelect) return;

    mapStyleSelect.value = Config.settings.mapStyle;
    mapStyleSelect.addEventListener('change', (e) => {
      Config.settings.mapStyle = e.target.value;
      MapManager.updateStyle(e.target.value);
    });
  },

  setupWindParticlesToggle() {
    const checkbox       = document.getElementById('gui-wind-particles');
    const brightnessCtrl = document.getElementById('gui-particle-opacity-control');
    if (!checkbox) return;

    checkbox.checked = Config.settings.showWindParticles;
    checkbox.addEventListener('change', (e) => {
      SelectionManager.toggleWindParticles(e.target.checked);
      if (brightnessCtrl) brightnessCtrl.style.display = e.target.checked ? '' : 'none';
    });
  },

  setupWindArrowsToggle() {
    const windArrowsCheckbox = document.getElementById('gui-wind-arrows');
    if (!windArrowsCheckbox) return;

    windArrowsCheckbox.checked = Config.settings.showWindArrows;
    windArrowsCheckbox.addEventListener('change', (e) => {
      Config.settings.showWindArrows = e.target.checked;
      SelectionManager.toggleWindArrows(e.target.checked);
    });
  },

  setupCubeOpacitySlider() {
    const cubeOpacitySlider = document.getElementById('gui-cube-opacity');
    const cubeOpacityValue  = document.getElementById('gui-cube-opacity-value');
    if (!cubeOpacitySlider || !cubeOpacityValue) return;

    cubeOpacitySlider.value       = Config.settings.cubeOpacity;
    cubeOpacityValue.textContent  = Config.settings.cubeOpacity.toFixed(2);

    cubeOpacitySlider.addEventListener('input', (e) => {
      Config.settings.cubeOpacity  = parseFloat(e.target.value);
      cubeOpacityValue.textContent = Config.settings.cubeOpacity.toFixed(2);
      // Update each cube's cloned material directly
      if (AppState.selectedFlightLevel === null) {
        AppState.windCubes.forEach(cube => {
          cube.material.opacity = Config.settings.cubeOpacity;
        });
      } else {
        AppState.windCubes.forEach(cube => {
          if (cube.userData.yLevel !== AppState.selectedFlightLevel) {
            cube.material.opacity = Config.settings.cubeOpacity;
          }
        });
      }
    });
  },

  setupParticleOpacitySlider() {
    const slider = document.getElementById('gui-particle-opacity');
    const value  = document.getElementById('gui-particle-opacity-value');
    if (!slider || !value) return;

    slider.addEventListener('input', (e) => {
      const opacity    = parseFloat(e.target.value);
      value.textContent = opacity.toFixed(2);
      ParticleSystem.setOpacity(opacity);
    });
  },

  setupStormControls() {
    const stormRadios = document.querySelectorAll('[name="storm-mode"]');
    stormRadios.forEach((radio) => {
      radio.addEventListener('change', (e) => {
        const mode = e.target.value;
        Config.settings.thunderstormActive = mode === 'thunderstorm';
        Config.settings.hurricaneActive    = mode === 'hurricane';
        if (mode === 'none') {
          this.onStormToggle(null, false);
        } else {
          this.onStormToggle(mode, true);
        }
      });
    });

    const hurricaneIntensitySlider = document.getElementById('gui-hurricane-intensity');
    const hurricaneIntensityValue  = document.getElementById('gui-hurricane-intensity-value');
    if (hurricaneIntensitySlider && hurricaneIntensityValue) {
      hurricaneIntensitySlider.value       = Config.settings.hurricaneIntensity;
      hurricaneIntensityValue.textContent  = Config.settings.hurricaneIntensity;

      hurricaneIntensitySlider.addEventListener('input', (e) => {
        Config.settings.hurricaneIntensity = parseInt(e.target.value, 10);
        hurricaneIntensityValue.textContent = Config.settings.hurricaneIntensity;
        this.onHurricaneIntensityChange();
      });
    }
  },

  onStormToggle(stormType, isActive) {
    const positionKey = stormType === 'hurricane' ? 'hurricanePosition' : 'thunderstormPosition';

    if (isActive) {
      Config.settings[positionKey] = Utils.getRandomPosition();
      WindGenerator.regenerate();
      StormSystem.build(stormType);
    } else {
      StormSystem.dispose();
      WindGenerator.regenerate();
    }
  },

  onHurricaneIntensityChange() {
    if (Config.settings.hurricaneActive) {
      WindGenerator.regenerate();
      StormSystem.dispose();
      StormSystem.build('hurricane');
    }
  },

};

// =============================================================================
// TIME CONTROLS
// =============================================================================

const TimeControls = {
  setupControls() {
    const controls = [
      { id: 'gui-date-prev', handler: () => this.changeDate(-1) },
      { id: 'gui-date-next', handler: () => this.changeDate(1)  },
      { id: 'gui-time-prev', handler: () => this.changeTime(-1) },
      { id: 'gui-time-next', handler: () => this.changeTime(1)  }
    ];

    controls.forEach(({ id, handler }) => {
      const element = document.getElementById(id);
      if (element) element.addEventListener('click', handler);
    });

    this.updateDisplay();
  },

  updateDisplay() {
    const dateValue = document.getElementById('gui-date-value');
    const timeValue = document.getElementById('gui-time-value');

    if (dateValue) dateValue.textContent = Utils.formatDate(AppState.currentDate);
    if (timeValue) timeValue.textContent = Utils.formatTime(AppState.currentTime);
  },

  changeDate(days) {
    const newDate = new Date(AppState.currentDate);
    newDate.setDate(newDate.getDate() + days);
    AppState.currentDate = newDate;
    this.updateDisplay();
    WindGenerator.regenerate();
  },

  changeTime(hours) {
    AppState.currentTime.hour += hours;

    if (AppState.currentTime.hour >= 24) {
      AppState.currentTime.hour = 0;
      this.changeDate(1);
      return;
    }

    if (AppState.currentTime.hour < 0) {
      AppState.currentTime.hour = 23;
      this.changeDate(-1);
      return;
    }

    this.updateDisplay();
    WindGenerator.regenerate();
  }
};

// =============================================================================
// STATE MANAGER
// =============================================================================

const StateManager = {
  updateState(stateName) {
    Config.settings.state = stateName;
    const stateData = getStateData(stateName);
    if (!stateData) return;

    MapManager.updateState(stateData);
    WindGenerator.regenerate();
  }
};

// =============================================================================
// EVENT HANDLERS
// =============================================================================

const EventHandlers = {
  init() {
    const canvas = AppState.renderer?.domElement;
    if (!canvas) return;

    canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
    canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
    canvas.addEventListener('mouseup',   this.onMouseUp.bind(this));
    canvas.addEventListener('click',     this.onMouseClick.bind(this));

    canvas.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
    canvas.addEventListener('touchmove',  this.onTouchMove.bind(this),  { passive: false });
    canvas.addEventListener('touchend',   this.onTouchEnd.bind(this),   { passive: false });

    window.addEventListener('resize', this.onWindowResize.bind(this));
  },

  updateMousePosition(clientX, clientY) {
    const canvas = AppState.renderer.domElement;
    const rect   = canvas.getBoundingClientRect();

    AppState.mouse.x =  ((clientX - rect.left) / rect.width)  * 2 - 1;
    AppState.mouse.y = -((clientY - rect.top)  / rect.height) * 2 + 1;
  },

  onMouseMove(event) {
    this.updateMousePosition(event.clientX, event.clientY);
    this.handleHover(event);
  },

  onMouseDown(event) {
    AppState.mouseDownPosition = { x: event.clientX, y: event.clientY };
    AppState.isDragging        = false;
  },

  onMouseUp(event) {
    const deltaX   = Math.abs(event.clientX - AppState.mouseDownPosition.x);
    const deltaY   = Math.abs(event.clientY - AppState.mouseDownPosition.y);
    AppState.isDragging = deltaX > 5 || deltaY > 5;
  },

  onMouseClick(event) {
    if (AppState.isDragging) return;
    this.updateMousePosition(event.clientX, event.clientY);
    this.handleClick();
  },

  onTouchStart(event) {
    event.preventDefault();
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      AppState.mouseDownPosition = { x: touch.clientX, y: touch.clientY };
      AppState.isDragging        = false;
    }
  },

  onTouchMove(event) {
    event.preventDefault();
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      this.updateMousePosition(touch.clientX, touch.clientY);
      this.handleHover(event);
    }
  },

  onTouchEnd(event) {
    event.preventDefault();
    if (event.changedTouches.length === 1) {
      const touch  = event.changedTouches[0];
      const deltaX = Math.abs(touch.clientX - AppState.mouseDownPosition.x);
      const deltaY = Math.abs(touch.clientY - AppState.mouseDownPosition.y);
      AppState.isDragging = deltaX > 5 || deltaY > 5;

      if (!AppState.isDragging) {
        this.updateMousePosition(touch.clientX, touch.clientY);
        this.handleClick();
      }

      UIManager.hideTooltip();
      AppState.isHovering = false;
    }
  },

  onWindowResize() {
    const canvas = AppState.renderer?.domElement;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    AppState.camera.aspect = rect.width / rect.height;
    AppState.camera.updateProjectionMatrix();
    AppState.renderer.setSize(rect.width, rect.height);
  },

  handleHover(event) {
    if (AppState.windCubes.length === 0) return;

    AppState.raycaster.setFromCamera(AppState.mouse, AppState.camera);
    const intersects = AppState.raycaster.intersectObjects(AppState.windCubes);

    if (intersects.length > 0) {
      const hoveredCube = intersects[0].object;
      let cubeToShow    = hoveredCube;

      if (AppState.selectedFlightLevel !== null) {
        const targetCube = AppState.windCubes.find(cube =>
          cube.position.x === hoveredCube.position.x &&
          cube.position.z === hoveredCube.position.z &&
          cube.userData.yLevel === AppState.selectedFlightLevel
        );
        if (targetCube) cubeToShow = targetCube;
      }

      AppState.isHovering = true;
      AppState.renderer.domElement.style.cursor = 'pointer';
      UIManager.showTooltip(cubeToShow, event.clientX, event.clientY);

      if (AppState.hoverOutline) {
        AppState.hoverOutline.position.y = hoveredCube.userData.yLevel * CONSTANTS.GRID.SPACING + 1.05;
        AppState.hoverOutline.visible = true;
      }

      if (AppState.selectedFlightLevel === null) {
        this.applyHoverEffects(hoveredCube.userData.yLevel);
      }
    } else {
      this.handleHoverEnd();
    }
  },

  handleHoverEnd() {
    AppState.isHovering = false;
    if (AppState.renderer) {
      AppState.renderer.domElement.style.cursor = 'move';
    }
    UIManager.hideTooltip();
    if (AppState.hoverOutline) AppState.hoverOutline.visible = false;

    if (AppState.selectedFlightLevel === null) {
      AppState.windCubes.forEach(cube => {
        cube.material.opacity = Config.settings.cubeOpacity;
      });
      MapManager.clearHoverEffects();
    }
  },

  applyHoverEffects(hoveredYLevel) {
    AppState.windCubes.forEach(cube => {
      cube.material.opacity = cube.userData.yLevel === hoveredYLevel
        ? 0.4
        : Config.settings.cubeOpacity;
    });

    MapManager.addWindCubesToMap(hoveredYLevel);
  },

  handleClick() {
    AppState.raycaster.setFromCamera(AppState.mouse, AppState.camera);
    const intersects = AppState.raycaster.intersectObjects(AppState.windCubes);

    if (intersects.length > 0) {
      const clickedCube   = intersects[0].object;
      const clickedYLevel = clickedCube.userData.yLevel;

      if (AppState.selectedFlightLevel === clickedYLevel) {
        SelectionManager.deselectFlightLevel();
      } else {
        SelectionManager.selectFlightLevel(clickedYLevel);
      }
    }
  }
};

// =============================================================================
// SPLITTER
// =============================================================================

const Splitter = {
  isDragging:          false,
  isControlsDragging:  false,
  startX:              0,
  startY:              0,
  startMapHeight:      0,
  startControlsWidth:  0,
  startControlsHeight: 0,
  resizeTimeout:       null,

  constraints: {
    minWidth:  240,
    maxWidth:  480,
    minHeight: 100
  },

  isMobile() {
    return window.innerWidth <= 800;
  },

  init() {
    this.bindSplitter('splitter',          this.startDrag.bind(this));
    this.bindSplitter('controls-splitter', this.startControlsDrag.bind(this));

    document.addEventListener('mousemove', this.drag.bind(this));
    document.addEventListener('touchmove', this.drag.bind(this), { passive: false });
    document.addEventListener('mouseup',   this.stopDrag.bind(this));
    document.addEventListener('touchend',  this.stopDrag.bind(this));

    setTimeout(() => this.notifyResize(), 100);
  },

  bindSplitter(id, handler) {
    const element = document.getElementById(id);
    if (!element) return;

    element.addEventListener('mousedown',  handler);
    element.addEventListener('touchstart', handler, { passive: false });
  },

  getEventPosition(event) {
    const isTouch  = event.type.startsWith('touch');
    const source   = isTouch ? event.touches[0] : event;
    return { x: source.clientX, y: source.clientY };
  },

  startDrag(event) {
    event.preventDefault();
    this.isDragging = true;

    const mapPanel = document.getElementById('map-panel');
    const { y }    = this.getEventPosition(event);

    this.startY          = y;
    this.startMapHeight  = mapPanel.offsetHeight;

    document.body.style.userSelect = 'none';
    document.body.style.cursor     = 'ns-resize';
  },

  startControlsDrag(event) {
    event.preventDefault();
    this.isControlsDragging = true;

    const guiPanel    = document.querySelector('.custom-gui');
    const { x, y }    = this.getEventPosition(event);

    this.startX              = x;
    this.startY              = y;
    this.startControlsWidth  = guiPanel.offsetWidth;
    this.startControlsHeight = guiPanel.offsetHeight;

    document.body.style.userSelect = 'none';
    document.body.style.cursor     = this.isMobile() ? 'ns-resize' : 'ew-resize';
  },

  drag(event) {
    if (!this.isDragging && !this.isControlsDragging) return;
    event.preventDefault();

    const { x: currentX, y: currentY } = this.getEventPosition(event);
    const deltaX = currentX - this.startX;
    const deltaY = currentY - this.startY;

    if (this.isDragging)         this.handleMapDrag(deltaY);
    if (this.isControlsDragging) this.handleControlsDrag(deltaX, deltaY);

    this.scheduleResize();
  },

  handleMapDrag(deltaY) {
    const mapPanel   = document.getElementById('map-panel');
    const container  = document.getElementById('app-container');

    const newHeight       = this.startMapHeight + deltaY;
    const containerHeight = container.offsetHeight;
    const minHeight       = Math.min(150, containerHeight * 0.2);
    const maxHeight       = containerHeight - minHeight - 12;

    if (newHeight >= minHeight && newHeight <= maxHeight) {
      const heightPercentage = (newHeight / containerHeight) * 100;
      mapPanel.style.setProperty('height', `${heightPercentage}%`, 'important');
    }
  },

  handleControlsDrag(deltaX, deltaY) {
    const guiPanel         = document.querySelector('.custom-gui');
    const controlsSplitter = document.getElementById('controls-splitter');
    const appContainer     = document.getElementById('app-container');

    if (this.isMobile()) {
      const windowHeight = window.innerHeight;
      const newHeight    = this.startControlsHeight - deltaY;
      const maxHeight    = windowHeight - this.constraints.minHeight;

      if (newHeight >= this.constraints.minHeight && newHeight <= maxHeight) {
        guiPanel.style.setProperty('height', `${newHeight}px`, 'important');
        controlsSplitter.style.setProperty('bottom', `${newHeight}px`, 'important');
      }
    } else {
      const newWidth = this.startControlsWidth - deltaX;

      if (newWidth >= this.constraints.minWidth && newWidth <= this.constraints.maxWidth) {
        guiPanel.style.setProperty('width', `${newWidth}px`, 'important');
        controlsSplitter.style.setProperty('right', `${newWidth}px`, 'important');
        appContainer.style.setProperty('width', `calc(100vw - ${newWidth}px - 12px)`, 'important');
      }
    }
  },

  scheduleResize() {
    if (this.resizeTimeout) clearTimeout(this.resizeTimeout);
    this.resizeTimeout = setTimeout(() => this.notifyResize(), 16);
  },

  stopDrag() {
    if (!this.isDragging && !this.isControlsDragging) return;

    this.isDragging         = false;
    this.isControlsDragging = false;
    document.body.style.userSelect = '';
    document.body.style.cursor     = '';

    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = null;
    }

    setTimeout(() => {
      this.notifyResize();
      if (AppState.renderer && AppState.scene && AppState.camera) {
        AppState.renderer.render(AppState.scene, AppState.camera);
      }
    }, 10);
  },

  notifyResize() {
    this.syncLayout();
    this.updateRenderer();
  },

  syncLayout() {
    const guiPanel         = document.querySelector('.custom-gui');
    const controlsSplitter = document.getElementById('controls-splitter');
    const appContainer     = document.getElementById('app-container');

    if (!guiPanel || !controlsSplitter || !appContainer) return;

    if (this.isMobile()) {
      const guiHeight = guiPanel.offsetHeight;
      controlsSplitter.style.setProperty('bottom', `${guiHeight}px`, 'important');
      appContainer.style.setProperty('height', `calc(100dvh - ${guiHeight}px - 12px)`, 'important');
    } else {
      const guiWidth = guiPanel.offsetWidth;
      controlsSplitter.style.setProperty('right', `${guiWidth}px`, 'important');
      appContainer.style.setProperty('width', `calc(100vw - ${guiWidth}px - 12px)`, 'important');
    }
  },

  updateRenderer() {
    if (AppState.leafletMap) {
      AppState.leafletMap.invalidateSize();
    }

    if (!AppState.renderer || !AppState.camera) return;

    const canvasPanel = document.getElementById('canvas-panel');
    if (!canvasPanel) return;

    const rect = canvasPanel.getBoundingClientRect();

    AppState.camera.aspect = rect.width / rect.height;
    AppState.camera.updateProjectionMatrix();
    AppState.renderer.setSize(rect.width, rect.height);
    AppState.renderer.setPixelRatio(window.devicePixelRatio);

    if (AppState.controls) AppState.controls.update();
    if (AppState.scene)    AppState.renderer.render(AppState.scene, AppState.camera);
  }
};

// =============================================================================
// APPLICATION INITIALIZATION
// =============================================================================

function initApp() {
  SceneManager.init();         // renderer, camera, scene, lighting, ground plane, arrow geometry
  SceneManager.createSliceOutlines();
  MaterialPool.build();        // 5 shared materials — must come before WindGenerator
  MapManager.init();
  WindGenerator.generateGrid(); // cubes + windFieldMap
  ParticleSystem.build();      // flow particles (reads windFieldMap)
  ArrowSystem.build();         // instanced arrows (uses arrowGeometry from SceneManager)
  SlabSystem.build();          // flight-level heatmap slab (hidden by default)
  LabelsManager.create();
  SelectionManager.selectFlightLevel(3); // FL200 selected by default
  UIManager.init();
  EventHandlers.init();
  Splitter.init();
  AnimationLoop.start();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
