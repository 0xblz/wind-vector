// =============================================================================
// WIND VECTOR - CORE
// Data, calculations, 3D scene, and visualization logic
// =============================================================================

// =============================================================================
// CONSTANTS & CONFIGURATION
// =============================================================================

const CONSTANTS = {
  GRID: {
    SIZE: 10,
    RANGE: 9,
    SPACING: 2,
    VERTICAL_SCALE: 2
  },
  FLIGHT_LEVELS: {
    MIN: 50,
    MAX: 500,
    INCREMENT: 50,
    COUNT: 10
  },
  COLORS: {
    WIND_SPEED: {
      CALM:        0x0d7a54,
      LIGHT:       0x1db87e,
      MODERATE:    0xc8a800,
      STRONG:      0xe05c00,
      VERY_STRONG: 0xcc0020
    },
    HURRICANE: {
      EYE:              0x87CEEB,
      EYEWALL:          0xFF00FF,
      EYEWALL_INTENSE:  0x8B0000
    },
    ARROW: 0x00ddff,
    BACKGROUND: {
      DARK:  0x000000,
      LIGHT: 0xffffff
    }
  },
  HURRICANE: {
    CATEGORY_WINDS:    [0, 74, 96, 111, 131, 157],
    EYE_BASE_RADIUS:   0.5,
    EYE_RADIUS_SCALE:  0.2,
    EYEWALL_OFFSET:    0.8,
    SPIRAL_BASE_RADIUS: 8,
    SPIRAL_RADIUS_SCALE: 2
  },
  WIND_SPEED: {
    THRESHOLDS: [20, 35, 50, 65],
    BASE_ALTITUDE_FACTOR: 2.5,
    MIN: 5,
    MAX: 100
  },
  ANIMATION: {
    OSCILLATION_SPEED:     1.5,
    OSCILLATION_AMPLITUDE: 0.03,
    MINI_MAP_OSCILLATION:  2
  },
  MAP: {
    TEXTURE_SIZE: 512,
    GROUND_SIZE:  20
  }
};

const Config = {
  settings: {
    state:                'Florida',
    cubeOpacity:          0.05,
    mapStyle:             'Terrain',
    darkBackground:       true,
    showWindArrows:       true,
    currentDate:          'Oct 15, 2024',
    currentTime:          '14:00',
    thunderstormActive:   false,
    thunderstormPosition: { x: 0, z: 0 },
    hurricaneActive:      false,
    hurricanePosition:    { x: 0, z: 0 },
    hurricaneIntensity:   3
  }
};

// =============================================================================
// APPLICATION STATE
// =============================================================================

const AppState = {
  scene:    null,
  camera:   null,
  renderer: null,
  controls: null,

  // Wind cubes
  windCubes:    [],
  windArrows:   [], // kept for compatibility; CSS arrows are removed
  groundPlane:  null,
  arrowGeometry: null,
  arrowMaterial: null,

  // Instanced mesh systems
  arrowInstancedMesh: null,
  particleSystem:     null,
  particleData:       null,
  stormParticleSystem: null,
  stormParticleData:   null,

  // Wind field lookup (populated after generateGrid)
  windFieldMap: null,

  // Shared materials
  sharedMaterials:         [],
  sharedWireframeMaterial: null,

  // Lights (stored for dynamic updates)
  hemiLight: null,
  dirLight:  null,
  fillLight: null,

  // Interaction
  raycaster:         new THREE.Raycaster(),
  mouse:             new THREE.Vector2(),
  isHovering:        false,
  selectedFlightLevel: null,
  selectedCubes:     [],
  isDragging:        false,
  mouseDownPosition: { x: 0, y: 0 },
  tooltip:           null,

  // Map
  leafletMap:      null,
  mapCanvas:       null,
  mapContext:      null,
  mapTexture:      null,
  windDataBounds:  null,
  windMapMarkers:  [],

  // Time
  currentDate: new Date(),
  currentTime: {
    hour:   new Date().getHours(),
    minute: new Date().getMinutes()
  }
};

// Shared geometry for all cubes (single allocation)
const _sharedBoxGeometry = new THREE.BoxGeometry(2, 2, 2);

// =============================================================================
// STATE COORDINATES
// =============================================================================

const StateCoordinates = {
  'Alabama':       { center: [32.806671,  -86.791130], zoom: 7 },
  'Alaska':        { center: [61.370716, -152.404419], zoom: 4 },
  'Arizona':       { center: [33.729759, -111.431221], zoom: 7 },
  'Arkansas':      { center: [34.969704,  -92.373123], zoom: 7 },
  'California':    { center: [36.116203, -119.681564], zoom: 6 },
  'Colorado':      { center: [39.059811, -105.311104], zoom: 7 },
  'Connecticut':   { center: [41.597782,  -72.755371], zoom: 8 },
  'Delaware':      { center: [39.318523,  -75.507141], zoom: 8 },
  'Florida':       { center: [27.766279,  -81.686783], zoom: 6 },
  'Georgia':       { center: [33.040619,  -83.643074], zoom: 7 },
  'Hawaii':        { center: [21.094318, -157.498337], zoom: 7 },
  'Idaho':         { center: [44.240459, -114.478828], zoom: 6 },
  'Illinois':      { center: [40.349457,  -88.986137], zoom: 7 },
  'Indiana':       { center: [39.849426,  -86.258278], zoom: 7 },
  'Iowa':          { center: [42.011539,  -93.210526], zoom: 7 },
  'Kansas':        { center: [38.526600,  -96.726486], zoom: 7 },
  'Kentucky':      { center: [37.668140,  -84.670067], zoom: 7 },
  'Louisiana':     { center: [31.169546,  -91.867805], zoom: 7 },
  'Maine':         { center: [44.693947,  -69.381927], zoom: 7 },
  'Maryland':      { center: [39.063946,  -76.802101], zoom: 8 },
  'Massachusetts': { center: [42.230171,  -71.530106], zoom: 8 },
  'Michigan':      { center: [43.326618,  -84.536095], zoom: 7 },
  'Minnesota':     { center: [45.694454,  -93.900192], zoom: 7 },
  'Mississippi':   { center: [32.741646,  -89.678696], zoom: 7 },
  'Missouri':      { center: [38.456085,  -92.288368], zoom: 7 },
  'Montana':       { center: [46.921925, -110.454353], zoom: 6 },
  'Nebraska':      { center: [41.125370,  -98.268082], zoom: 7 },
  'Nevada':        { center: [38.313515, -117.055374], zoom: 6 },
  'New Hampshire': { center: [43.452492,  -71.563896], zoom: 8 },
  'New Jersey':    { center: [40.298904,  -74.521011], zoom: 8 },
  'New Mexico':    { center: [34.840515, -106.248482], zoom: 7 },
  'New York':      { center: [42.165726,  -74.948051], zoom: 7 },
  'North Carolina':{ center: [35.630066,  -79.806419], zoom: 7 },
  'North Dakota':  { center: [47.528912,  -99.784012], zoom: 7 },
  'Ohio':          { center: [40.388783,  -82.764915], zoom: 7 },
  'Oklahoma':      { center: [35.565342,  -96.928917], zoom: 7 },
  'Oregon':        { center: [44.572021, -122.070938], zoom: 6 },
  'Pennsylvania':  { center: [40.590752,  -77.209755], zoom: 7 },
  'Rhode Island':  { center: [41.680893,  -71.511780], zoom: 9 },
  'South Carolina':{ center: [33.856892,  -80.945007], zoom: 7 },
  'South Dakota':  { center: [44.299782,  -99.438828], zoom: 7 },
  'Tennessee':     { center: [35.747845,  -86.692345], zoom: 7 },
  'Texas':         { center: [31.054487,  -97.563461], zoom: 6 },
  'Utah':          { center: [40.150032, -111.862434], zoom: 7 },
  'Vermont':       { center: [44.045876,  -72.710686], zoom: 8 },
  'Virginia':      { center: [37.769337,  -78.169968], zoom: 7 },
  'Washington':    { center: [47.400902, -121.490494], zoom: 7 },
  'West Virginia': { center: [38.491226,  -80.954453], zoom: 7 },
  'Wisconsin':     { center: [44.268543,  -89.616508], zoom: 7 },
  'Wyoming':       { center: [42.755966, -107.302490], zoom: 7 }
};

function calculateSquareBounds(center, size) {
  const latSize = size;
  const lngSize = size / Math.cos(center[0] * Math.PI / 180);
  return [
    [center[0] - latSize / 2, center[1] - lngSize / 2],
    [center[0] + latSize / 2, center[1] + lngSize / 2]
  ];
}

function getStateData(stateName) {
  const state = StateCoordinates[stateName];
  if (!state) return null;

  const sizeMap = { 4: 20, 6: 10, 7: 5, 8: 2.5, 9: 1.25 };
  const boundsSize = sizeMap[state.zoom] || 5;
  const bounds = calculateSquareBounds(state.center, boundsSize);

  return {
    center:      state.center,
    zoom:        state.zoom,
    bounds:      bounds,
    windPattern: determineWindPattern(state.center)
  };
}

function determineWindPattern(center) {
  const [lat, lng] = center;
  if (lng < -120)              return 'pacific';
  if (lat > 40 && lng > -85)   return 'nor_easter';
  if (lat < 35 && lng > -90)   return 'gulf_stream';
  if (lng > -105 && lng < -90) return 'plains';
  if (lat < 40 && lng < -105)  return 'desert';
  return 'continental';
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

const Utils = {
  formatDate: (date) => date.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  }),

  formatTime: (timeObj) =>
    `${timeObj.hour.toString().padStart(2, '0')}:${timeObj.minute.toString().padStart(2, '0')}`,

  getWindSpeedColor(speed, stormType, distanceFromCenter, isStormCore) {
    distanceFromCenter = distanceFromCenter !== undefined ? distanceFromCenter : Infinity;
    isStormCore        = isStormCore || false;

    if (stormType === 'hurricane') {
      const { EYE_BASE_RADIUS, EYE_RADIUS_SCALE, EYEWALL_OFFSET, SPIRAL_BASE_RADIUS, SPIRAL_RADIUS_SCALE } = CONSTANTS.HURRICANE;
      const eyeRadius    = EYE_BASE_RADIUS + (Config.settings.hurricaneIntensity * EYE_RADIUS_SCALE);
      const eyeWallRadius = eyeRadius + EYEWALL_OFFSET;
      const spiralRadius  = SPIRAL_BASE_RADIUS + (Config.settings.hurricaneIntensity * SPIRAL_RADIUS_SCALE);

      if (distanceFromCenter < eyeRadius)    return new THREE.Color(CONSTANTS.COLORS.HURRICANE.EYE);
      if (distanceFromCenter < eyeWallRadius) {
        const intensity = 1 - ((distanceFromCenter - eyeRadius) / (eyeWallRadius - eyeRadius));
        return new THREE.Color(CONSTANTS.COLORS.HURRICANE.EYEWALL)
          .lerp(new THREE.Color(CONSTANTS.COLORS.HURRICANE.EYEWALL_INTENSE), intensity);
      }
      if (distanceFromCenter < spiralRadius) {
        const bandIntensity = 1 - ((distanceFromCenter - eyeWallRadius) / (spiralRadius - eyeWallRadius));
        if (speed > 60) return new THREE.Color(0xFF0000).lerp(new THREE.Color(0xFF8800), 1 - bandIntensity);
        if (speed > 40) return new THREE.Color(0xFF8800).lerp(new THREE.Color(0xFFFF00), 1 - bandIntensity);
        return new THREE.Color(0xFFFF00).lerp(new THREE.Color(0x66FF66), 1 - bandIntensity);
      }
    }

    if (stormType === 'thunderstorm') {
      if (isStormCore) {
        return new THREE.Color(CONSTANTS.COLORS.WIND_SPEED.VERY_STRONG);
      }
      if (distanceFromCenter < 5) {
        const intensity = Math.max(0.5, 1 - (distanceFromCenter / 5));
        return new THREE.Color(CONSTANTS.COLORS.WIND_SPEED.STRONG)
          .lerp(new THREE.Color(CONSTANTS.COLORS.WIND_SPEED.VERY_STRONG), intensity);
      }
    }

    const { THRESHOLDS } = CONSTANTS.WIND_SPEED;
    const { WIND_SPEED: COLORS } = CONSTANTS.COLORS;

    if (speed < THRESHOLDS[0]) return COLORS.CALM;
    if (speed < THRESHOLDS[1]) return COLORS.LIGHT;
    if (speed < THRESHOLDS[2]) return COLORS.MODERATE;
    if (speed < THRESHOLDS[3]) return COLORS.STRONG;
    return COLORS.VERY_STRONG;
  },

  normalizeGridPosition: (worldPos) =>
    (worldPos + CONSTANTS.GRID.RANGE + 1) / (2 * CONSTANTS.GRID.RANGE + 2),

  calculateDistance: (pos1, pos2) =>
    Math.sqrt((pos1.x - pos2.x) ** 2 + (pos1.z - pos2.z) ** 2),

  getRandomPosition: () => ({ x: Math.random() * 16 - 8, z: Math.random() * 16 - 8 }),

  worldToScreen(position, camera, renderer) {
    const vector = new THREE.Vector3().copy(position).project(camera);
    const canvas = renderer.domElement;
    const rect   = canvas.getBoundingClientRect();

    const screenX = (vector.x * 0.5 + 0.5) * rect.width  + rect.left;
    const screenY = (-vector.y * 0.5 + 0.5) * rect.height + rect.top;

    return (vector.z < 1 && screenX >= rect.left && screenX <= rect.right &&
            screenY >= rect.top  && screenY <= rect.bottom)
      ? { x: screenX, y: screenY }
      : null;
  }
};

// =============================================================================
// WIND CALCULATOR
// =============================================================================

const WindCalculator = {
  generateDirection(x, y, z, windPattern) {
    const flightLevel = CONSTANTS.FLIGHT_LEVELS.MIN +
      ((y / CONSTANTS.GRID.SPACING) * CONSTANTS.FLIGHT_LEVELS.INCREMENT);
    let directionAngle = 0;

    if (Config.settings.hurricaneActive) {
      directionAngle += this.calculateHurricaneEffect(x, y, z);
    } else if (Config.settings.thunderstormActive) {
      directionAngle += this.calculateThunderstormEffect(x, y, z);
    }

    directionAngle += this.getAltitudeWindPattern(flightLevel, x, z);
    directionAngle += this.getRegionalWindPattern(windPattern, x, y, z);
    directionAngle += this.getTimeBasedVariation(x, y, z);

    const angleRad = (directionAngle * Math.PI) / 180;
    const hx = Math.cos(angleRad);
    const hz = Math.sin(angleRad);
    const vy = this.calculateVerticalComponent(x, y, z);

    return new THREE.Vector3(hx, vy, hz).normalize();
  },

  calculateVerticalComponent(x, y, z) {
    if (Config.settings.hurricaneActive) {
      return this.hurricaneVertical(x, y, z);
    }
    if (Config.settings.thunderstormActive) {
      return this.thunderstormVertical(x, y, z);
    }
    // Normal conditions: thermal lifting and subsidence zones across the grid.
    // Range ~±0.35 gives ~17° of visible tilt after normalization.
    const maxY       = CONSTANTS.FLIGHT_LEVELS.COUNT * CONSTANTS.GRID.SPACING;
    const altFraction = y / maxY;
    // Spatial pattern: alternating rising/sinking columns, stronger at low altitude
    const pattern = Math.sin(x * 0.5 + z * 0.4) * 0.25
                  + Math.cos(x * 0.35 - z * 0.5) * 0.15;
    return pattern * (1 - altFraction * 0.5);
  },

  hurricaneVertical(x, y, z) {
    const dist = Utils.calculateDistance({ x, z }, Config.settings.hurricanePosition);
    const { EYE_BASE_RADIUS, EYE_RADIUS_SCALE, EYEWALL_OFFSET, SPIRAL_BASE_RADIUS, SPIRAL_RADIUS_SCALE } = CONSTANTS.HURRICANE;
    const eyeR     = EYE_BASE_RADIUS + Config.settings.hurricaneIntensity * EYE_RADIUS_SCALE;
    const eyeWallR = eyeR + EYEWALL_OFFSET;
    const spiralR  = SPIRAL_BASE_RADIUS + Config.settings.hurricaneIntensity * SPIRAL_RADIUS_SCALE;
    const maxY     = CONSTANTS.FLIGHT_LEVELS.COUNT * CONSTANTS.GRID.SPACING;

    if (dist < eyeR) {
      // Eye: warm-core subsidence — air sinks strongly
      return -0.6;
    }
    if (dist < eyeWallR) {
      // Eyewall: powerful updraft, strongest near surface, weakens aloft
      const altFactor = 1 - (y / maxY) * 0.5;
      return 0.9 * altFactor;
    }
    if (dist < spiralR) {
      // Spiral rain bands: moderate updraft
      const bandIntensity = 1 - ((dist - eyeWallR) / (spiralR - eyeWallR));
      return 0.5 * bandIntensity;
    }
    // Upper outflow: arrows tilt downward and outward
    if (y > maxY * 0.7) return -0.35;
    // Low-level inflow: slight downward convergence
    return -0.1;
  },

  thunderstormVertical(x, y, z) {
    const dist           = Utils.calculateDistance({ x, z }, Config.settings.thunderstormPosition);
    const maxY           = CONSTANTS.FLIGHT_LEVELS.COUNT * CONSTANTS.GRID.SPACING;
    const stormInfluence = Math.exp(-dist / 3);
    // Updraft strongest at mid-altitude (anvil shape)
    const altFactor      = Math.sin((y / maxY) * Math.PI);

    if (dist < 2) {
      // Core: dramatic vertical arrow tilt
      return 0.95 * altFactor + 0.2;
    }
    if (dist < 5) {
      return 0.6 * stormInfluence * altFactor;
    }
    // Compensating subsidence surrounds the storm
    return -0.25 * stormInfluence;
  },

  calculateHurricaneEffect(x, y, z) {
    const dx = x - Config.settings.hurricanePosition.x;
    const dz = z - Config.settings.hurricanePosition.z;
    const distanceFromCenter = Utils.calculateDistance({ x, z }, Config.settings.hurricanePosition);

    const { EYE_BASE_RADIUS, EYE_RADIUS_SCALE, EYEWALL_OFFSET, SPIRAL_BASE_RADIUS, SPIRAL_RADIUS_SCALE } = CONSTANTS.HURRICANE;
    const eyeRadius     = EYE_BASE_RADIUS + (Config.settings.hurricaneIntensity * EYE_RADIUS_SCALE);
    const eyeWallRadius = eyeRadius + EYEWALL_OFFSET;
    const spiralRadius  = SPIRAL_BASE_RADIUS + (Config.settings.hurricaneIntensity * SPIRAL_RADIUS_SCALE);

    if (distanceFromCenter < eyeRadius) return Math.random() * 60 - 30;

    const hurricaneAngle = Math.atan2(dz, dx) * 180 / Math.PI;

    if (distanceFromCenter < eyeWallRadius) {
      const spiralAngle  = hurricaneAngle + 90 - 15;
      const altitudeEffect = Math.sin((y / 10) * Math.PI) * 10;
      return spiralAngle + altitudeEffect;
    }

    if (distanceFromCenter < spiralRadius) {
      const spiralIntensity = 1 - ((distanceFromCenter - eyeWallRadius) / (spiralRadius - eyeWallRadius));
      const spiralAngle   = hurricaneAngle + 90 - (30 * spiralIntensity);
      const bandEffect    = Math.sin(distanceFromCenter * 2 + hurricaneAngle * 0.1) * 15;
      const shearEffect   = (y > 6) ? (y - 6) * 5 : 0;
      return spiralAngle + bandEffect + shearEffect;
    }

    if (y > 8) {
      const outflowAngle     = hurricaneAngle - 90;
      const outflowIntensity = Math.exp(-(distanceFromCenter - spiralRadius) / 3);
      return outflowAngle * outflowIntensity * 0.3;
    }

    return 0;
  },

  calculateThunderstormEffect(x, y, z) {
    const dx = x - Config.settings.thunderstormPosition.x;
    const dz = z - Config.settings.thunderstormPosition.z;
    const distanceFromStorm = Utils.calculateDistance({ x, z }, Config.settings.thunderstormPosition);

    const stormAngle       = Math.atan2(dz, dx) * 180 / Math.PI;
    const rotationStrength = Math.exp(-distanceFromStorm / 3) * 180;
    const verticalComponent = Math.sin((y / 10) * Math.PI) * 45;
    const turbulence       = (Math.sin(x * 3 + y * 2 + z * 2.5) + Math.cos(x * 2 + y * 2.5 + z * 2)) * 30;

    let effect = stormAngle + rotationStrength + verticalComponent + turbulence;
    if (distanceFromStorm < 3) effect += Math.random() * 60 - 30;

    return effect;
  },

  getAltitudeWindPattern(flightLevel, x, z) {
    const patterns = [
      { max: 100,      fn: () => Math.sin((x + z) * 0.6) * 25 + Math.cos(x * 0.8) * 15 },
      { max: 200,      fn: () => Math.sin((x - z) * 0.4) * 20 + Math.cos(z * 0.7) * 18 },
      { max: 300,      fn: () => Math.cos((x + z) * 0.3) * 15 + Math.sin(x * 0.5) * 12 },
      { max: 400,      fn: () => 30 + Math.sin(z * 0.2) * 10 + Math.cos(x * 0.3) * 8  },
      { max: Infinity, fn: () => 45 + Math.cos((x - z) * 0.2) * 12 + Math.sin(x * 0.25) * 6 }
    ];
    return patterns.find(p => flightLevel <= p.max).fn();
  },

  getRegionalWindPattern(pattern, x, y, z) {
    const timeSeed    = AppState.currentDate.getTime() + AppState.currentTime.hour;
    const seededRandom = (Math.sin(timeSeed + x * 1000 + y * 100 + z * 10) + 1) / 2;
    const randomFactor = Math.sin(timeSeed * 0.001 + x * 0.3 + y * 0.5 + z * 0.7) * 15;

    const patterns = {
      'nor_easter':  () => (z * 2) + Math.sin(y * 0.8) * 15 + (seededRandom * 18 - 9),
      'gulf_stream': () => (x * 1.2) + Math.cos(y * 0.6) * 12 + (seededRandom * 16 - 8),
      'continental': () => (x + z) * 0.8 + Math.sin(y * 0.5) * 18 + (seededRandom * 22 - 11),
      'desert': () => {
        const thermalEffect = Math.max(0, 1 - (y / 10));
        return Math.sin(x * 0.4) * 10 * thermalEffect + Math.cos(y * 0.7) * 20 + (seededRandom * 14 - 7);
      },
      'pacific': () => {
        const jetStreamEffect = Math.min(1, y / 8);
        return 25 * jetStreamEffect + (z * 1.5) + Math.sin(y * 0.4) * 25 + (seededRandom * 16 - 8);
      },
      'plains': () => (x - z) * 1.2 + Math.cos(y * 0.6) * 16 + (seededRandom * 25 - 12.5)
    };

    return randomFactor + (patterns[pattern] ? patterns[pattern]() : 0);
  },

  getTimeBasedVariation(x, y, z) {
    const timeSeed = AppState.currentDate.getTime() + AppState.currentTime.hour;
    return Math.sin(timeSeed + x * 30 + y * 40 + z * 35) * (5 + y * 2);
  },

  calculateSpeed(pattern, x, y, z) {
    const baseSpeed = 10 + (y * CONSTANTS.WIND_SPEED.BASE_ALTITUDE_FACTOR);
    let speed = baseSpeed;

    const hourFactor   = Math.sin((AppState.currentTime.hour / 24) * 2 * Math.PI) * 5;
    const dayOfYear    = Math.floor((AppState.currentDate - new Date(AppState.currentDate.getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
    const seasonalFactor = Math.cos((dayOfYear / 365) * 2 * Math.PI) * 8;

    if (Config.settings.hurricaneActive) {
      speed = this.calculateHurricaneSpeed(x, y, z);
    } else if (Config.settings.thunderstormActive) {
      speed += this.calculateThunderstormSpeed(x, y, z);
    }

    speed += this.getRegionalSpeedModifier(pattern, x, y, z) + hourFactor + seasonalFactor;

    return Math.max(CONSTANTS.WIND_SPEED.MIN, Math.min(CONSTANTS.WIND_SPEED.MAX, speed));
  },

  calculateHurricaneSpeed(x, y, z) {
    const distanceFromCenter = Utils.calculateDistance({ x, z }, Config.settings.hurricanePosition);
    const { EYE_BASE_RADIUS, EYE_RADIUS_SCALE, EYEWALL_OFFSET, SPIRAL_BASE_RADIUS, SPIRAL_RADIUS_SCALE, CATEGORY_WINDS } = CONSTANTS.HURRICANE;
    const eyeRadius     = EYE_BASE_RADIUS + (Config.settings.hurricaneIntensity * EYE_RADIUS_SCALE);
    const eyeWallRadius = eyeRadius + EYEWALL_OFFSET;
    const spiralRadius  = SPIRAL_BASE_RADIUS + (Config.settings.hurricaneIntensity * SPIRAL_RADIUS_SCALE);
    const maxWind       = CATEGORY_WINDS[Config.settings.hurricaneIntensity];

    if (distanceFromCenter < eyeRadius)     return 5 + Math.random() * 10;

    if (distanceFromCenter < eyeWallRadius) {
      const eyeWallIntensity = 1 - ((distanceFromCenter - eyeRadius) / (eyeWallRadius - eyeRadius));
      let speed = maxWind * 0.7 + (maxWind * 0.3 * eyeWallIntensity);
      const turbulence = (Math.sin(x * 3 + y * 2 + z * 2.5) + Math.cos(x * 2 + y * 2.5 + z * 2)) * 20;
      speed += turbulence;
      const verticalProfile = Math.sin((y / 10) * Math.PI);
      return speed * (0.7 + verticalProfile * 0.3);
    }

    if (distanceFromCenter < spiralRadius) {
      const bandIntensity  = 1 - ((distanceFromCenter - eyeWallRadius) / (spiralRadius - eyeWallRadius));
      let speed = maxWind * 0.3 + (maxWind * 0.4 * bandIntensity);
      const bandVariation  = Math.sin(distanceFromCenter * 1.5) * 15;
      const feederBandEffect = Math.cos(distanceFromCenter * 0.8) * 10;
      return speed + bandVariation + feederBandEffect;
    }

    let speed = 10 + (y * 2.5);
    if (y > 8) {
      const outflowIntensity = Math.exp(-(distanceFromCenter - spiralRadius) / 4);
      speed += outflowIntensity * 25;
    } else {
      const inflowIntensity = Math.exp(-(distanceFromCenter - spiralRadius) / 6);
      speed += inflowIntensity * 15;
    }
    return Math.max(5, speed);
  },

  calculateThunderstormSpeed(x, y, z) {
    const distanceFromStorm = Utils.calculateDistance({ x, z }, Config.settings.thunderstormPosition);
    const stormInfluence    = Math.exp(-distanceFromStorm / 4);
    const verticalDevelopment = Math.sin((y / 10) * Math.PI) * 30;
    const turbulence        = (Math.sin(x * 2.5 + y * 1.8 + z * 2.2) + Math.cos(x * 1.8 + y * 2.2 + z * 1.5)) * 15;
    const stormEffect       = (verticalDevelopment + turbulence) * stormInfluence;

    let additionalSpeed = stormEffect;
    if (distanceFromStorm < 3 && y > 2) {
      additionalSpeed = Math.max(additionalSpeed, 60 + (Math.random() * 20));
    }

    return additionalSpeed;
  },

  getRegionalSpeedModifier(pattern, x, y, z) {
    const timeSeed     = AppState.currentDate.getTime() + AppState.currentTime.hour;
    const seededRandom = (Math.sin(timeSeed + x * 1000 + y * 100 + z * 10) + 1) / 2;

    const patterns = {
      'nor_easter':  () => (x + 10) * 1.8 + Math.sin(z * 0.4) * 8 + (seededRandom * 18 - 9),
      'gulf_stream': () => Math.sin((z + 10) * 0.3) * 12 + (seededRandom * 16 - 8),
      'continental': () => Math.cos(x * 0.6) * Math.sin(z * 0.5) * 15 + (seededRandom * 22 - 11),
      'desert': () => {
        const thermalEffect = Math.abs(x) + Math.abs(z);
        const thermalBoost  = AppState.currentTime.hour >= 10 && AppState.currentTime.hour <= 16 ? 8 : 0;
        return thermalEffect * 0.8 + Math.sin(y * 0.4) * 10 + (seededRandom * 14 - 7) + thermalBoost;
      },
      'pacific': () => (10 - x) * 2.0 + Math.cos(y * 0.3) * 6 + (seededRandom * 16 - 8),
      'plains':  () => Math.sin((x + z) * 0.4) * 12 + (seededRandom * 25 - 12.5)
    };

    return patterns[pattern] ? patterns[pattern]() : 0;
  }
};

// =============================================================================
// WIND GENERATOR
// =============================================================================

const WindGenerator = {
  generateGrid() {
    this.clearExisting();
    const stateData = getStateData(Config.settings.state);
    if (!stateData) return;

    const windPattern = stateData.windPattern;

    for (let x = -CONSTANTS.GRID.RANGE; x <= CONSTANTS.GRID.RANGE; x += CONSTANTS.GRID.SPACING) {
      for (let y = 0; y < CONSTANTS.FLIGHT_LEVELS.COUNT; y++) {
        for (let z = -CONSTANTS.GRID.RANGE; z <= CONSTANTS.GRID.RANGE; z += CONSTANTS.GRID.SPACING) {
          const flightLevel = CONSTANTS.FLIGHT_LEVELS.MIN + (y * CONSTANTS.FLIGHT_LEVELS.INCREMENT);
          const speed       = WindCalculator.calculateSpeed(windPattern, x, y * CONSTANTS.GRID.SPACING, z);
          this.createCube(x, y * CONSTANTS.GRID.SPACING, z, Math.round(speed), flightLevel);
        }
      }
    }

    // Build O(1) wind direction lookup map
    AppState.windFieldMap = new Map();
    AppState.windCubes.forEach(cube => {
      const key = `${cube.position.x},${cube.position.y},${cube.position.z}`;
      AppState.windFieldMap.set(key, cube.userData.windDirection);
    });
  },

  clearExisting() {
    AppState.windCubes.forEach(cube => AppState.scene.remove(cube));
    AppState.windCubes  = [];
    AppState.windArrows = []; // compatibility stub — no DOM arrows any more
  },

  createCube(x, y, z, speed, flightLevel) {
    const stateData = getStateData(Config.settings.state);
    if (!stateData) return;

    const windPattern   = stateData.windPattern;
    const windDirection = WindCalculator.generateDirection(x, y, z, windPattern);

    // Clone from pool so each cube owns its material — required for per-cube opacity control
    const material = (AppState.sharedMaterials && AppState.sharedMaterials.length)
      ? MaterialPool.getMaterial(speed).clone()
      : new THREE.MeshLambertMaterial({
          color: CONSTANTS.COLORS.WIND_SPEED.CALM,
          transparent: true,
          opacity: Config.settings.cubeOpacity
        });
    material.opacity = Config.settings.cubeOpacity;

    const cube = new THREE.Mesh(_sharedBoxGeometry, material);
    cube.position.set(x, y, z);
    cube.userData = { speed, flightLevel, yLevel: y / CONSTANTS.GRID.SPACING, windDirection };

    AppState.scene.add(cube);
    AppState.windCubes.push(cube);
  },

  regenerate() {
    this.generateGrid();

    if (AppState.selectedFlightLevel !== null && typeof SelectionManager !== 'undefined') {
      SelectionManager.selectFlightLevel(AppState.selectedFlightLevel);
    }

    // Resample particle velocities from new wind field
    if (typeof ParticleSystem !== 'undefined') {
      ParticleSystem.resample();
    }

    if (AppState.renderer && AppState.scene && AppState.camera) {
      AppState.renderer.render(AppState.scene, AppState.camera);
    }
  }
};

// =============================================================================
// SCENE MANAGER
// =============================================================================

const SceneManager = {
  init() {
    this.setupScene();
    this.setupCamera();
    this.setupRenderer();
    this.setupControls();
    this.setupLighting();
    this.createGroundPlane();
    this.createArrowGeometry();
  },

  setupScene() {
    AppState.scene = new THREE.Scene();
    AppState.scene.fog = new THREE.FogExp2(0x000008, 0.018);
    this.updateBackgroundColor(Config.settings.darkBackground);
  },

  setupCamera() {
    const canvas = document.getElementById('three-canvas');
    const rect   = canvas.getBoundingClientRect();
    AppState.camera = new THREE.PerspectiveCamera(45, rect.width / rect.height, 0.1, 1000);
    AppState.camera.position.set(15, 25, 15);
  },

  setupRenderer() {
    const canvas      = document.getElementById('three-canvas');
    const canvasPanel = document.getElementById('canvas-panel');
    const rect        = canvasPanel.getBoundingClientRect();
    AppState.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    AppState.renderer.setSize(rect.width, rect.height);
    AppState.renderer.setPixelRatio(window.devicePixelRatio);
  },

  setupControls() {
    AppState.controls = new THREE.OrbitControls(AppState.camera, AppState.renderer.domElement);
    AppState.controls.enableDamping  = true;
    AppState.controls.dampingFactor  = 0.05;
    AppState.controls.enablePan      = true;
    AppState.controls.panSpeed       = 1.0;
    AppState.controls.enableZoom     = true;
    AppState.controls.zoomSpeed      = 1.0;
    AppState.controls.minDistance    = 5;
    AppState.controls.maxDistance    = 50;
    AppState.controls.target.set(0, 5, 0);
    this.setupPanButtons();
  },

  setupPanButtons() {
    const panAmount = 2;
    document.getElementById('pan-up')?.addEventListener('click',    () => this.panCamera(0, panAmount));
    document.getElementById('pan-down')?.addEventListener('click',  () => this.panCamera(0, -panAmount));
    document.getElementById('pan-left')?.addEventListener('click',  () => this.panCamera(panAmount, 0));
    document.getElementById('pan-right')?.addEventListener('click', () => this.panCamera(-panAmount, 0));
  },

  panCamera(deltaX, deltaY) {
    const target   = AppState.controls.target;
    const camera   = AppState.camera;

    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);

    const cameraRight = new THREE.Vector3();
    cameraRight.crossVectors(camera.up, cameraDirection).normalize();

    const cameraUp = new THREE.Vector3(0, 1, 0);
    const offset   = new THREE.Vector3();
    offset.addScaledVector(cameraRight, deltaX);
    offset.addScaledVector(cameraUp, deltaY);

    target.add(offset);
    camera.position.add(offset);
    AppState.controls.update();
  },

  setupLighting() {
    // Hemisphere light: near-white sky keeps material colors true, dark ground for contrast
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x223322, 0.9);
    AppState.scene.add(hemiLight);
    AppState.hemiLight = hemiLight;

    // Primary directional key light: NE quadrant, ~45 degrees elevation
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(8, 14, 6);
    AppState.scene.add(dirLight);
    AppState.dirLight = dirLight;

    // Soft fill from opposite side to prevent full shadowing
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight.position.set(-6, 4, -8);
    AppState.scene.add(fillLight);
    AppState.fillLight = fillLight;
  },

  updateBackgroundColor(isDark) {
    const color = isDark ? CONSTANTS.COLORS.BACKGROUND.DARK : CONSTANTS.COLORS.BACKGROUND.LIGHT;
    AppState.scene.background = new THREE.Color(color);
  },

  createGroundPlane() {
    const geometry = new THREE.PlaneGeometry(CONSTANTS.MAP.GROUND_SIZE, CONSTANTS.MAP.GROUND_SIZE);

    AppState.mapCanvas        = document.createElement('canvas');
    AppState.mapCanvas.width  = CONSTANTS.MAP.TEXTURE_SIZE;
    AppState.mapCanvas.height = CONSTANTS.MAP.TEXTURE_SIZE;
    AppState.mapContext       = AppState.mapCanvas.getContext('2d');

    AppState.mapContext.fillStyle = '#4a7c59';
    AppState.mapContext.fillRect(0, 0, CONSTANTS.MAP.TEXTURE_SIZE, CONSTANTS.MAP.TEXTURE_SIZE);

    AppState.mapTexture = new THREE.CanvasTexture(AppState.mapCanvas);

    // MeshBasicMaterial ignores scene lighting — map renders at its own true brightness
    const material = new THREE.MeshBasicMaterial({ map: AppState.mapTexture });
    AppState.groundPlane            = new THREE.Mesh(geometry, material);
    AppState.groundPlane.rotation.x = -Math.PI / 2;
    AppState.groundPlane.position.y = -1;
    AppState.scene.add(AppState.groundPlane);
  },

  createArrowGeometry() {
    const shaftGeometry = new THREE.CylinderGeometry(0.06, 0.10, 1.0, 8);
    const headGeometry  = new THREE.ConeGeometry(0.22, 0.45, 8);

    // Shaft: bottom at Y=0, top at Y=1.0
    const shaftMatrix = new THREE.Matrix4().makeTranslation(0, 0.5, 0);
    // Head: base at Y=1.0, tip at Y=1.3
    const headMatrix  = new THREE.Matrix4().makeTranslation(0, 1.15, 0);

    const shaftGeo = shaftGeometry.clone().applyMatrix4(shaftMatrix);
    const headGeo  = headGeometry.clone().applyMatrix4(headMatrix);

    AppState.arrowGeometry = THREE.BufferGeometryUtils.mergeBufferGeometries([shaftGeo, headGeo]);
    // Fully opaque — arrows sit above the cubes so no blending tricks needed
    AppState.arrowMaterial = new THREE.MeshBasicMaterial({
      color: CONSTANTS.COLORS.ARROW
    });

    // Clean up intermediate geometries
    shaftGeometry.dispose();
    headGeometry.dispose();
  }
};

// =============================================================================
// SELECTION MANAGER
// =============================================================================

const SelectionManager = {
  selectFlightLevel(yLevel) {
    this.deselectFlightLevel();
    AppState.selectedFlightLevel = yLevel;

    AppState.windCubes.forEach(cube => {
      cube.material.opacity = cube.userData.yLevel === yLevel
        ? 0.5
        : Config.settings.cubeOpacity;
    });

    // Update 3D instanced arrows and heatmap slab
    if (typeof ArrowSystem !== 'undefined') {
      ArrowSystem.update(yLevel, AnimationLoop.elapsedTime || 0);
    }
    if (typeof SlabSystem !== 'undefined') {
      SlabSystem.show(yLevel);
    }

    MapManager.addWindCubesToMap();
  },

  deselectFlightLevel() {
    AppState.selectedFlightLevel = null;
    AppState.selectedCubes.forEach(wireframe => AppState.scene.remove(wireframe));
    AppState.selectedCubes = [];

    AppState.windCubes.forEach(cube => {
      cube.material.opacity = Config.settings.cubeOpacity;
      cube.visible = true;
    });

    if (typeof ArrowSystem !== 'undefined') {
      ArrowSystem.update(null, AnimationLoop.elapsedTime || 0);
    }
    if (typeof SlabSystem !== 'undefined') {
      SlabSystem.hide();
    }

    MapManager.addWindCubesToMap();
  },

  // Kept for API compatibility — actual arrow visibility is managed by ArrowSystem
  updateArrowVisibility() {
    if (typeof ArrowSystem !== 'undefined') {
      ArrowSystem.update(AppState.selectedFlightLevel, AnimationLoop.elapsedTime || 0);
    }
  },

  toggleWindArrows(showArrows) {
    Config.settings.showWindArrows = showArrows;
    if (typeof ArrowSystem !== 'undefined') {
      ArrowSystem.update(AppState.selectedFlightLevel, AnimationLoop.elapsedTime || 0);
    }
    MapManager.addWindCubesToMap();
  }
};

// =============================================================================
// LABELS MANAGER
// =============================================================================

const LabelsManager = {
  create() {
    this.createFlightLevelLabels();
    this.createCompassLabels();
  },

  createFlightLevelLabels() {
    for (let y = 0; y < CONSTANTS.FLIGHT_LEVELS.COUNT * CONSTANTS.GRID.SPACING; y += CONSTANTS.GRID.SPACING) {
      const flightLevel = CONSTANTS.FLIGHT_LEVELS.MIN + ((y / CONSTANTS.GRID.SPACING) * CONSTANTS.FLIGHT_LEVELS.INCREMENT);
      const flStr = String(flightLevel).padStart(3, '0');
      this.createTextSprite(`FL${flStr}`, 11, y, 0);
    }
  },

  createCompassLabels() {
    const labels = [['N', 0, 0, -11], ['S', 0, 0, 11], ['E', 11, 0, 0], ['W', -11, 0, 0]];
    labels.forEach(([text, x, y, z]) => this.createTextSprite(text, x, y, z));
  },

  createTextSprite(text, x, y, z) {
    const canvas  = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width  = 256;
    canvas.height = 64;

    context.fillStyle = 'rgba(0, 0, 0, 0.8)';
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = 'white';
    context.font      = '24px Ubuntu Mono, monospace';
    context.textAlign = 'center';
    context.fillText(text, canvas.width / 2, 40);

    const texture  = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    const sprite   = new THREE.Sprite(material);

    sprite.position.set(x, y, z);
    sprite.scale.set(4, 1, 1);
    AppState.scene.add(sprite);
  }
};

// =============================================================================
// MAP MANAGER
// =============================================================================

const MapManager = {
  tileUrls: {
    'OpenStreetMap': 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    'Satellite':     'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    'Terrain':       'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png'
  },

  init() {
    this.initLeaflet();
    const stateData = getStateData(Config.settings.state);
    this.updateState(stateData);
  },

  initLeaflet() {
    const mapDiv = document.getElementById('leaflet-map-main');
    AppState.leafletMap = L.map(mapDiv, {
      zoomControl:       true,
      attributionControl: true,
      dragging:          true,
      touchZoom:         true,
      scrollWheelZoom:   true,
      doubleClickZoom:   true,
      boxZoom:           true
    });

    L.tileLayer(this.tileUrls[Config.settings.mapStyle], { maxZoom: 19 }).addTo(AppState.leafletMap);
  },

  updateState(stateData) {
    if (!stateData) return;

    AppState.leafletMap.setView(stateData.center, Math.max(stateData.zoom - 1, 3));

    if (AppState.windDataBounds) {
      AppState.leafletMap.removeLayer(AppState.windDataBounds);
    }

    const bounds = L.latLngBounds(stateData.bounds);
    AppState.windDataBounds = L.rectangle(bounds, {
      color:       '#000000',
      weight:      3,
      fillOpacity: 0.1,
      fillColor:   '#00ddff'
    }).addTo(AppState.leafletMap);

    this.captureTexture();
  },

  updateStyle(styleName) {
    AppState.leafletMap.eachLayer(layer => {
      if (layer instanceof L.TileLayer) {
        AppState.leafletMap.removeLayer(layer);
      }
    });

    L.tileLayer(this.tileUrls[styleName] || this.tileUrls['OpenStreetMap']).addTo(AppState.leafletMap);
    this.captureTexture();
  },

  captureTexture() {
    const stateData = getStateData(Config.settings.state);
    if (!stateData) return;
    this.captureFromLeafletBounds();
  },

  captureFromLeafletBounds() {
    const stateData = getStateData(Config.settings.state);
    if (!stateData) return;

    const zoom   = Math.max(stateData.zoom - 1, 3);
    const bounds = stateData.bounds;

    const nwTile = this.latLngToTile(bounds[1][0], bounds[0][1], zoom);
    const seTile = this.latLngToTile(bounds[0][0], bounds[1][1], zoom);

    const tilesX = Math.abs(seTile.x - nwTile.x) + 1;
    const tilesY = Math.abs(seTile.y - nwTile.y) + 1;

    const tileCanvas  = document.createElement('canvas');
    const tileSize    = 256;
    tileCanvas.width  = tilesX * tileSize;
    tileCanvas.height = tilesY * tileSize;
    const tileCtx     = tileCanvas.getContext('2d');

    let tilesLoaded = 0;
    const totalTiles = tilesX * tilesY;

    for (let x = 0; x < tilesX; x++) {
      for (let y = 0; y < tilesY; y++) {
        const tileX = Math.min(nwTile.x, seTile.x) + x;
        const tileY = Math.min(nwTile.y, seTile.y) + y;

        const tileUrl = (this.tileUrls[Config.settings.mapStyle] || this.tileUrls['OpenStreetMap'])
          .replace('{z}', zoom)
          .replace('{x}', tileX)
          .replace('{y}', tileY)
          .replace('{s}', 'a');

        const img        = new Image();
        img.crossOrigin  = 'anonymous';

        img.onload = () => {
          tileCtx.drawImage(img, x * tileSize, y * tileSize, tileSize, tileSize);
          tilesLoaded++;
          if (tilesLoaded === totalTiles) {
            this.finalizeBoundsTexture(tileCanvas, bounds, zoom);
          }
        };

        img.onerror = () => {
          tilesLoaded++;
          if (tilesLoaded === totalTiles) this.createFallbackTexture();
        };

        img.src = tileUrl;
      }
    }
  },

  finalizeBoundsTexture(tileCanvas, bounds, zoom) {
    AppState.mapContext.clearRect(0, 0, CONSTANTS.MAP.TEXTURE_SIZE, CONSTANTS.MAP.TEXTURE_SIZE);

    const nwTile  = this.latLngToTile(bounds[1][0], bounds[0][1], zoom);
    const seTile  = this.latLngToTile(bounds[0][0], bounds[1][1], zoom);
    const nwPixel = this.latLngToPixel(bounds[1][0], bounds[0][1], zoom);
    const sePixel = this.latLngToPixel(bounds[0][0], bounds[1][1], zoom);

    const cropX = nwPixel.x - (Math.min(nwTile.x, seTile.x) * 256);
    const cropY = nwPixel.y - (Math.min(nwTile.y, seTile.y) * 256);
    const cropWidth  = sePixel.x - nwPixel.x;
    const cropHeight = sePixel.y - nwPixel.y;

    AppState.mapContext.drawImage(
      tileCanvas,
      cropX, cropY, cropWidth, cropHeight,
      0, 0, CONSTANTS.MAP.TEXTURE_SIZE, CONSTANTS.MAP.TEXTURE_SIZE
    );

    this.addStateLabel();
    this.updateTexture();
  },

  latLngToTile(lat, lng, zoom) {
    const x = Math.floor((lng + 180) / 360 * Math.pow(2, zoom));
    const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
    return { x, y };
  },

  latLngToPixel(lat, lng, zoom) {
    const x = (lng + 180) / 360 * Math.pow(2, zoom) * 256;
    const y = (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom) * 256;
    return { x: Math.floor(x), y: Math.floor(y) };
  },

  createFallbackTexture() {
    AppState.mapContext.fillStyle = '#4a7c59';
    AppState.mapContext.fillRect(0, 0, CONSTANTS.MAP.TEXTURE_SIZE, CONSTANTS.MAP.TEXTURE_SIZE);
    this.addGridPattern();
    this.addStateLabel();
    this.updateTexture();
  },

  addGridPattern() {
    AppState.mapContext.strokeStyle = '#3a5a2a';
    AppState.mapContext.lineWidth   = 1;
    for (let i = 0; i < CONSTANTS.MAP.TEXTURE_SIZE; i += 64) {
      AppState.mapContext.beginPath();
      AppState.mapContext.moveTo(i, 0);
      AppState.mapContext.lineTo(i, CONSTANTS.MAP.TEXTURE_SIZE);
      AppState.mapContext.stroke();
      AppState.mapContext.beginPath();
      AppState.mapContext.moveTo(0, i);
      AppState.mapContext.lineTo(CONSTANTS.MAP.TEXTURE_SIZE, i);
      AppState.mapContext.stroke();
    }
  },

  addStateLabel() {
    AppState.mapContext.fillStyle = 'rgba(0, 0, 0, 0.7)';
    AppState.mapContext.fillRect(10, 10, 150, 30);
    AppState.mapContext.fillStyle = 'white';
    AppState.mapContext.font      = '16px Arial';
    AppState.mapContext.fillText(Config.settings.state, 20, 30);
  },

  updateTexture() {
    if (AppState.mapTexture) {
      AppState.mapTexture.needsUpdate = true;
    } else {
      AppState.mapTexture = new THREE.CanvasTexture(AppState.mapCanvas);
    }

    if (AppState.groundPlane) {
      AppState.groundPlane.material.map       = AppState.mapTexture;
      AppState.groundPlane.material.needsUpdate = true;
    }
  },

  addWindCubesToMap(flightLevel) {
    if (AppState.windMapMarkers) {
      AppState.windMapMarkers.forEach(marker => AppState.leafletMap.removeLayer(marker));
    }
    AppState.windMapMarkers = [];

    if (flightLevel === null && AppState.selectedFlightLevel === null) return;
    if (flightLevel === undefined && AppState.selectedFlightLevel === null) return;

    const targetLevel = (flightLevel !== null && flightLevel !== undefined)
      ? flightLevel
      : AppState.selectedFlightLevel;

    const stateData = getStateData(Config.settings.state);
    if (!stateData) return;

    const bounds       = stateData.bounds;
    const latLngBounds = L.latLngBounds(bounds);
    const latRange     = latLngBounds.getNorth() - latLngBounds.getSouth();
    const lngRange     = latLngBounds.getEast()  - latLngBounds.getWest();

    const gridSize = CONSTANTS.GRID.RANGE * 2 / CONSTANTS.GRID.SPACING + 1;
    const cellLat  = latRange / gridSize;
    const cellLng  = lngRange / gridSize;

    AppState.windCubes.forEach(cube => {
      if (cube.userData.yLevel === targetLevel) {
        const normalizedX = Utils.normalizeGridPosition(cube.position.x);
        const normalizedZ = Utils.normalizeGridPosition(cube.position.z);

        const lat = bounds[0][0] + (bounds[1][0] - bounds[0][0]) * (1 - normalizedZ);
        const lng = bounds[0][1] + (bounds[1][1] - bounds[0][1]) * normalizedX;

        const speed = cube.userData.speed;
        const color = this.getWindSpeedColorHex(speed, cube.position);

        const cellBounds = [
          [lat - cellLat / 2, lng - cellLng / 2],
          [lat + cellLat / 2, lng + cellLng / 2]
        ];

        const rectangle = L.rectangle(cellBounds, {
          color:       color,
          weight:      0,
          fillColor:   color,
          fillOpacity: 0.4,
          className:   'wind-cube-cell'
        });

        rectangle.bindTooltip(
          `FL${String(cube.userData.flightLevel).padStart(3, '0')}<br/>Wind: ${speed} kt`,
          { permanent: false, direction: 'top' }
        );

        rectangle.addTo(AppState.leafletMap);
        AppState.windMapMarkers.push(rectangle);

        if (Config.settings.showWindArrows) {
          const windDirection = cube.userData.windDirection;
          const windAngle = Math.atan2(windDirection.x, -windDirection.z) * 180 / Math.PI;

          const arrowMarker = L.marker([lat, lng], {
            icon: L.divIcon({
              className: 'wind-arrow-map',
              html: `<div style="
                width: 0; height: 0;
                border-left: 4px solid transparent;
                border-right: 4px solid transparent;
                border-bottom: 12px solid #00ddff;
                transform: rotate(${windAngle}deg);
                transform-origin: center bottom;
                filter: drop-shadow(0 0 2px rgba(0,0,0,0.8));
              "></div>`,
              iconSize:   [8, 12],
              iconAnchor: [4, 6]
            })
          });

          arrowMarker.addTo(AppState.leafletMap);
          AppState.windMapMarkers.push(arrowMarker);
        }
      }
    });
  },

  clearHoverEffects() {
    if (AppState.selectedFlightLevel === null) {
      if (AppState.windMapMarkers) {
        AppState.windMapMarkers.forEach(marker => AppState.leafletMap.removeLayer(marker));
        AppState.windMapMarkers = [];
      }
    }
  },

  getWindSpeedColorHex(speed, cubePosition) {
    let stormType = null, distanceFromCenter = Infinity, isStormCore = false;

    if (Config.settings.hurricaneActive) {
      stormType = 'hurricane';
      distanceFromCenter = Utils.calculateDistance(
        { x: cubePosition.x, z: cubePosition.z },
        Config.settings.hurricanePosition
      );
    } else if (Config.settings.thunderstormActive) {
      stormType = 'thunderstorm';
      distanceFromCenter = Utils.calculateDistance(
        { x: cubePosition.x, z: cubePosition.z },
        Config.settings.thunderstormPosition
      );
      isStormCore = distanceFromCenter < 3 && cubePosition.y > 2;
    }

    const threeColor = Utils.getWindSpeedColor(speed, stormType, distanceFromCenter, isStormCore);

    if (threeColor && typeof threeColor.getHexString === 'function') {
      return '#' + threeColor.getHexString();
    } else if (typeof threeColor === 'number') {
      return '#' + threeColor.toString(16).padStart(6, '0');
    }

    const { THRESHOLDS } = CONSTANTS.WIND_SPEED;
    if (speed < THRESHOLDS[0]) return '#0d7a54';
    if (speed < THRESHOLDS[1]) return '#1db87e';
    if (speed < THRESHOLDS[2]) return '#c8a800';
    if (speed < THRESHOLDS[3]) return '#e05c00';
    return '#cc0020';
  }
};

// =============================================================================
// ANIMATION LOOP
// =============================================================================

const AnimationLoop = {
  elapsedTime: 0,
  lastTime:    0,

  start() {
    this.animate();
  },

  animate() {
    requestAnimationFrame(this.animate.bind(this));

    const now = performance.now() * 0.001; // seconds
    this.lastTime    = this.lastTime || now;
    const dt         = Math.min(now - this.lastTime, 0.1);
    this.lastTime    = now;
    this.elapsedTime = now;

    AppState.controls.update();

    // Flow particles — every frame
    if (typeof ParticleSystem !== 'undefined') {
      ParticleSystem.update();
    }

    // Storm particles — every frame when active
    if (typeof StormSystem !== 'undefined') {
      StormSystem.update(this.elapsedTime);
    }

    // Animated instanced arrows — only when visible
    if (AppState.arrowInstancedMesh?.visible && typeof ArrowSystem !== 'undefined') {
      ArrowSystem.update(AppState.selectedFlightLevel, this.elapsedTime);
    }

    AppState.renderer.render(AppState.scene, AppState.camera);
  }
};
