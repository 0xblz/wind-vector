// =============================================================================
// WIND VECTOR - SYSTEMS
// GPU systems: materials, arrows, particles, slabs, storm effects
// Depends on: wind-vector-core.js (must be loaded first)
// =============================================================================

// =============================================================================
// MATERIAL POOL
// 5 shared MeshLambertMaterial instances keyed by wind speed bucket.
// Replaces 1000 individual material instances created per-cube.
// =============================================================================

const MaterialPool = {
  BUCKET_COUNT: 5,

  build() {
    this.dispose();

    const colors = CONSTANTS.COLORS.WIND_SPEED;
    const bucketColors = [
      colors.CALM,
      colors.LIGHT,
      colors.MODERATE,
      colors.STRONG,
      colors.VERY_STRONG
    ];

    AppState.sharedMaterials = bucketColors.map(hex =>
      new THREE.MeshLambertMaterial({
        color: hex,
        transparent: true,
        opacity: Config.settings.cubeOpacity
      })
    );

    AppState.sharedWireframeMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true,
      transparent: true,
      opacity: 0.8
    });
  },

  getBucketIndex(speed) {
    const t = CONSTANTS.WIND_SPEED.THRESHOLDS;
    if (speed < t[0]) return 0;
    if (speed < t[1]) return 1;
    if (speed < t[2]) return 2;
    if (speed < t[3]) return 3;
    return 4;
  },

  getMaterial(speed) {
    return AppState.sharedMaterials[this.getBucketIndex(speed)];
  },

  setOpacity(opacity) {
    if (!AppState.sharedMaterials) return;
    AppState.sharedMaterials.forEach(m => {
      m.opacity = opacity;
      m.needsUpdate = true;
    });
  },

  dispose() {
    if (AppState.sharedMaterials) {
      AppState.sharedMaterials.forEach(m => m.dispose());
    }
    if (AppState.sharedWireframeMaterial) {
      AppState.sharedWireframeMaterial.dispose();
    }
    AppState.sharedMaterials = [];
    AppState.sharedWireframeMaterial = null;
  }
};

// =============================================================================
// ARROW SYSTEM
// InstancedMesh of 1000 arrow instances replacing all CSS div arrows.
// Per-frame wobble animation driven by wind speed and position phase.
// =============================================================================

const ArrowSystem = {
  INSTANCE_COUNT: 1000,

  build() {
    this.dispose();

    if (!AppState.arrowGeometry || !AppState.arrowMaterial) return;

    const mesh = new THREE.InstancedMesh(
      AppState.arrowGeometry,
      AppState.arrowMaterial,
      this.INSTANCE_COUNT
    );
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.visible = false;
    AppState.scene.add(mesh);
    AppState.arrowInstancedMesh = mesh;

    // Initialize all matrices to zero-scale (hidden until assigned)
    const dummy = new THREE.Object3D();
    dummy.position.set(0, -9999, 0);
    dummy.scale.set(0, 0, 0);
    dummy.updateMatrix();
    for (let i = 0; i < this.INSTANCE_COUNT; i++) {
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  },

  update(visibleYLevel, time) {
    const mesh = AppState.arrowInstancedMesh;
    if (!mesh) return;

    const t = time || 0;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const cubes = AppState.windCubes;

    const SPEED_MIN = CONSTANTS.WIND_SPEED.MIN;
    const SPEED_MAX = CONSTANTS.WIND_SPEED.MAX;
    const OSCILLATION_AMPLITUDE = 0.08;
    const OSCILLATION_SPEED = 0.4;

    for (let i = 0; i < cubes.length && i < this.INSTANCE_COUNT; i++) {
      const cube = cubes[i];

      if (visibleYLevel !== null && cube.userData.yLevel !== visibleYLevel) {
        dummy.position.set(0, -9999, 0);
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        continue;
      }

      const dir   = cube.userData.windDirection;
      const speed = cube.userData.speed;
      const pos   = cube.position;

      const phaseOffset = Math.sin(
        t * OSCILLATION_SPEED + pos.x * 0.31 + pos.z * 0.17
      ) * OSCILLATION_AMPLITUDE * (speed / SPEED_MAX);

      // Use full 3D wind direction so vertical components tilt the arrow
      const windDir = new THREE.Vector3(dir.x, dir.y, dir.z).normalize();
      // Apply wobble around Y only (keeps horizontal bearing oscillating, not vertical)
      const wobbled = windDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), phaseOffset).normalize();
      dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), wobbled);

      // Sit arrow base above the cube top (cube half-height = 1) so the full arrow floats above
      dummy.position.set(pos.x, pos.y + 1.5, pos.z);

      const s = 0.75;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      // Color: cyan for calm/light, shift warm for strong/very-strong
      const speedRatio = Math.min(1, (speed - SPEED_MIN) / (SPEED_MAX - SPEED_MIN));
      if (speedRatio < 0.5) {
        color.setHex(CONSTANTS.COLORS.ARROW); // cyan
      } else {
        const warmT = (speedRatio - 0.5) * 2;
        color.setRGB(1.0, 0.5 - warmT * 0.3, 0.1 - warmT * 0.1);
      }
      mesh.setColorAt(i, color);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.visible = visibleYLevel !== null && Config.settings.showWindArrows;
  },

  dispose() {
    if (AppState.arrowInstancedMesh) {
      AppState.scene.remove(AppState.arrowInstancedMesh);
      AppState.arrowInstancedMesh.dispose();
      AppState.arrowInstancedMesh = null;
    }
  }
};

// =============================================================================
// PARTICLE SYSTEM
// 2000 THREE.Points flowing along the wind field.
// Wind direction sampled via O(1) Map lookup after grid generation.
// =============================================================================

const ParticleSystem = {
  OPTIONS: {
    COUNT:        2000,
    SPEED_SCALE:  0.015,
    LIFETIME_MIN: 80,
    LIFETIME_MAX: 240,
    SIZE:         0.10,
    OPACITY:      0.85
  },

  GRID_BOUNDS: {
    xMin: -(CONSTANTS.GRID.RANGE + 1),
    xMax:  (CONSTANTS.GRID.RANGE + 1),
    yMin: -0.5,
    yMax:  CONSTANTS.FLIGHT_LEVELS.COUNT * CONSTANTS.GRID.SPACING,
    zMin: -(CONSTANTS.GRID.RANGE + 1),
    zMax:  (CONSTANTS.GRID.RANGE + 1)
  },

  build() {
    this.dispose();

    const count = this.OPTIONS.COUNT;
    const positions  = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const lifetimes  = new Float32Array(count);
    const maxLife    = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      this._resetParticle(positions, velocities, lifetimes, maxLife, i, true);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: CONSTANTS.COLORS.ARROW,
      size:  this.OPTIONS.SIZE,
      transparent: true,
      opacity: this.OPTIONS.OPACITY,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    AppState.scene.add(points);
    AppState.particleSystem = points;
    AppState.particleData   = { positions, velocities, lifetimes, maxLife };
  },

  _resetParticle(positions, velocities, lifetimes, maxLife, i, randomLifetime) {
    const B  = this.GRID_BOUNDS;
    const px = B.xMin + Math.random() * (B.xMax - B.xMin);
    const py = B.yMin + Math.random() * (B.yMax - B.yMin);
    const pz = B.zMin + Math.random() * (B.zMax - B.zMin);

    positions[i * 3    ] = px;
    positions[i * 3 + 1] = py;
    positions[i * 3 + 2] = pz;

    const dir   = this._sampleWindDirection(px, py, pz);
    const speed = this.OPTIONS.SPEED_SCALE;
    velocities[i * 3    ] = dir.x * speed;
    velocities[i * 3 + 1] = 0;
    velocities[i * 3 + 2] = dir.z * speed;

    const life = this.OPTIONS.LIFETIME_MIN +
      Math.random() * (this.OPTIONS.LIFETIME_MAX - this.OPTIONS.LIFETIME_MIN);
    maxLife[i]   = life;
    lifetimes[i] = randomLifetime ? Math.random() * life : life;
  },

  _sampleWindDirection(px, py, pz) {
    if (!AppState.windFieldMap) return new THREE.Vector3(1, 0, 0);

    const spacing = CONSTANTS.GRID.SPACING;
    const range   = CONSTANTS.GRID.RANGE;
    const cx = Math.max(-range, Math.min(range, Math.round(px / spacing) * spacing));
    const cy = Math.max(0, Math.min(
      (CONSTANTS.FLIGHT_LEVELS.COUNT - 1) * spacing,
      Math.round(py / spacing) * spacing
    ));
    const cz = Math.max(-range, Math.min(range, Math.round(pz / spacing) * spacing));

    return AppState.windFieldMap.get(`${cx},${cy},${cz}`) || new THREE.Vector3(1, 0, 0);
  },

  update() {
    if (!AppState.particleSystem || !AppState.particleData) return;

    const { positions, velocities, lifetimes, maxLife } = AppState.particleData;
    const count = this.OPTIONS.COUNT;
    const B     = this.GRID_BOUNDS;

    for (let i = 0; i < count; i++) {
      positions[i * 3    ] += velocities[i * 3    ];
      positions[i * 3 + 1] += velocities[i * 3 + 1];
      positions[i * 3 + 2] += velocities[i * 3 + 2];
      lifetimes[i] -= 1;

      const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
      if (lifetimes[i] <= 0 ||
          x < B.xMin || x > B.xMax ||
          y < B.yMin || y > B.yMax ||
          z < B.zMin || z > B.zMax) {
        this._resetParticle(positions, velocities, lifetimes, maxLife, i, false);
      }
    }

    AppState.particleSystem.geometry.attributes.position.needsUpdate = true;
  },

  setOpacity(opacity) {
    if (AppState.particleSystem) {
      AppState.particleSystem.material.opacity = opacity;
    }
  },

  resample() {
    if (!AppState.particleData) return;
    const { positions, velocities } = AppState.particleData;
    const count = this.OPTIONS.COUNT;
    for (let i = 0; i < count; i++) {
      const dir   = this._sampleWindDirection(
        positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]
      );
      const speed = this.OPTIONS.SPEED_SCALE;
      velocities[i * 3    ] = dir.x * speed;
      velocities[i * 3 + 1] = 0;
      velocities[i * 3 + 2] = dir.z * speed;
    }
  },

  dispose() {
    if (AppState.particleSystem) {
      AppState.scene.remove(AppState.particleSystem);
      AppState.particleSystem.geometry.dispose();
      AppState.particleSystem.material.dispose();
      AppState.particleSystem = null;
      AppState.particleData   = null;
    }
  }
};

// =============================================================================
// SLAB SYSTEM
// On flight level selection: a PlaneGeometry with a bilinearly-interpolated
// canvas heatmap showing wind speed at that altitude layer.
// =============================================================================

const SlabSystem = {
  TEXTURE_SIZE: 256,
  PLANE_SIZE:   20,

  _slab:    null,
  _canvas:  null,
  _ctx:     null,
  _texture: null,

  build() {
    if (this._slab) return;

    this._canvas        = document.createElement('canvas');
    this._canvas.width  = this.TEXTURE_SIZE;
    this._canvas.height = this.TEXTURE_SIZE;
    this._ctx           = this._canvas.getContext('2d');

    this._texture = new THREE.CanvasTexture(this._canvas);

    const geometry = new THREE.PlaneGeometry(this.PLANE_SIZE, this.PLANE_SIZE);
    const material = new THREE.MeshBasicMaterial({
      map:         this._texture,
      transparent: true,
      opacity:     0.35,
      side:        THREE.DoubleSide,
      depthWrite:  false
    });

    this._slab            = new THREE.Mesh(geometry, material);
    this._slab.rotation.x = -Math.PI / 2;
    this._slab.visible    = false;
    AppState.scene.add(this._slab);
  },

  show(yLevel) {
    if (!this._slab) this.build();
    const cubeY = yLevel * CONSTANTS.GRID.SPACING;
    this._slab.position.set(0, cubeY - 0.95, 0);
    this._updateTexture(yLevel);
    this._slab.visible = true;
  },

  hide() {
    if (this._slab) this._slab.visible = false;
  },

  _updateTexture(yLevel) {
    const ctx   = this._ctx;
    const size  = this.TEXTURE_SIZE;
    const grid  = CONSTANTS.GRID.SIZE;
    const range = CONSTANTS.GRID.RANGE;
    const step  = CONSTANTS.GRID.SPACING;

    ctx.clearRect(0, 0, size, size);

    // Build 10×10 speed lookup from windFieldMap
    const speeds = new Array(grid * grid).fill(0);
    let minSpeed = Infinity, maxSpeed = -Infinity;

    for (let row = 0; row < grid; row++) {
      for (let col = 0; col < grid; col++) {
        const wx  = -range + col * step;
        const wy  = yLevel * step;
        const wz  = -range + row * step;
        const dir = AppState.windFieldMap?.get(`${wx},${wy},${wz}`);

        // Approximate speed from stored cube userData via position lookup
        const cube = AppState.windCubes.find(c =>
          c.position.x === wx && c.position.y === wy && c.position.z === wz
        );
        const speed = cube ? cube.userData.speed : 0;
        speeds[row * grid + col] = speed;
        if (speed < minSpeed) minSpeed = speed;
        if (speed > maxSpeed) maxSpeed = speed;
      }
    }

    // Bilinear interpolation across canvas
    const speedRange = maxSpeed > minSpeed ? maxSpeed - minSpeed : 1;

    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const gx = (px / size) * (grid - 1);
        const gy = (py / size) * (grid - 1);

        const x0 = Math.floor(gx), x1 = Math.min(x0 + 1, grid - 1);
        const y0 = Math.floor(gy), y1 = Math.min(y0 + 1, grid - 1);
        const tx = gx - x0, ty = gy - y0;

        const speed =
          speeds[y0 * grid + x0] * (1 - tx) * (1 - ty) +
          speeds[y0 * grid + x1] *  tx       * (1 - ty) +
          speeds[y1 * grid + x0] * (1 - tx)  *  ty      +
          speeds[y1 * grid + x1] *  tx        *  ty;

        const t = (speed - minSpeed) / speedRange;
        ctx.fillStyle = this._speedToColor(t);
        ctx.fillRect(px, py, 1, 1);
      }
    }

    this._texture.needsUpdate = true;
  },

  _speedToColor(t) {
    if (t < 0.25) return `rgba(0,170,0,${(0.5 + t * 1.2).toFixed(2)})`;
    if (t < 0.5)  return `rgba(${Math.round(t * 4 * 255)},220,0,0.65)`;
    if (t < 0.75) return `rgba(255,${Math.round((1 - (t - 0.5) * 4) * 180)},0,0.72)`;
    return `rgba(200,0,0,0.8)`;
  },

  dispose() {
    if (this._slab) {
      AppState.scene.remove(this._slab);
      this._slab.geometry.dispose();
      this._slab.material.dispose();
      this._texture.dispose();
      this._slab    = null;
      this._canvas  = null;
      this._ctx     = null;
      this._texture = null;
    }
  }
};

// =============================================================================
// STORM SYSTEM
// Hurricane: rotating spiral disc of 600 particles + magenta point light.
// Thunderstorm: 400-particle vertical updraft column that loops at the top.
// =============================================================================

const StormSystem = {
  OPTIONS: {
    HURRICANE_PARTICLES:    600,
    THUNDERSTORM_PARTICLES: 400,
    HURRICANE_ROTATION_SPEED: 0.008,
    THUNDERSTORM_RISE_SPEED:  0.04,
    PARTICLE_SIZE: 0.12
  },

  _type:   null,
  _light:  null,
  _lightFlicker: 0,

  build(type) {
    this.dispose();
    this._type = type;

    if (type === 'hurricane')    this._buildHurricane();
    if (type === 'thunderstorm') this._buildThunderstorm();
  },

  _buildHurricane() {
    const count = this.OPTIONS.HURRICANE_PARTICLES;
    const positions = new Float32Array(count * 3);
    const angles    = new Float32Array(count);
    const radii     = new Float32Array(count);
    const speeds    = new Float32Array(count);

    const pos = Config.settings.hurricanePosition;
    const { EYE_BASE_RADIUS, EYE_RADIUS_SCALE, SPIRAL_BASE_RADIUS, SPIRAL_RADIUS_SCALE } =
      CONSTANTS.HURRICANE;
    const eyeR    = EYE_BASE_RADIUS + Config.settings.hurricaneIntensity * EYE_RADIUS_SCALE;
    const spiralR = SPIRAL_BASE_RADIUS + Config.settings.hurricaneIntensity * SPIRAL_RADIUS_SCALE;
    const maxY    = CONSTANTS.FLIGHT_LEVELS.COUNT * CONSTANTS.GRID.SPACING;

    for (let i = 0; i < count; i++) {
      const t      = i / count;
      const radius = eyeR + t * (spiralR - eyeR);
      const angle  = t * Math.PI * 6;

      angles[i] = angle + Math.random() * 0.3;
      radii[i]  = radius + (Math.random() - 0.5) * 0.5;
      speeds[i] = 0.7 + Math.random() * 0.6;

      const yPos = Math.random() * maxY;
      positions[i * 3    ] = pos.x + Math.cos(angles[i]) * radii[i];
      positions[i * 3 + 1] = yPos;
      positions[i * 3 + 2] = pos.z + Math.sin(angles[i]) * radii[i];
    }

    this._finalize(positions, { angles, radii, speeds }, 0xff00ff);

    // Magenta point light at hurricane center
    this._light = new THREE.PointLight(0xff00aa, 4, 14);
    this._light.position.set(pos.x, 5, pos.z);
    AppState.scene.add(this._light);
  },

  _buildThunderstorm() {
    const count = this.OPTIONS.THUNDERSTORM_PARTICLES;
    const positions = new Float32Array(count * 3);
    const altitudes = new Float32Array(count);

    const pos          = Config.settings.thunderstormPosition;
    const COLUMN_R     = 1.5;
    const maxY         = CONSTANTS.FLIGHT_LEVELS.COUNT * CONSTANTS.GRID.SPACING;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r     = Math.random() * COLUMN_R;
      const y     = Math.random() * maxY;

      positions[i * 3    ] = pos.x + Math.cos(angle) * r;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = pos.z + Math.sin(angle) * r;
      altitudes[i]          = y;
    }

    this._finalize(positions, { altitudes }, 0xffaa00);

    // Flickering point light at storm column
    this._light = new THREE.PointLight(0x4488ff, 2, 10);
    this._light.position.set(pos.x, 10, pos.z);
    AppState.scene.add(this._light);
    this._lightFlicker = 0;
  },

  _finalize(positions, extra, color) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color,
      size:            this.OPTIONS.PARTICLE_SIZE,
      transparent:     true,
      opacity:         0.7,
      blending:        THREE.AdditiveBlending,
      depthWrite:      false,
      sizeAttenuation: true
    });

    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    AppState.scene.add(points);

    AppState.stormParticleSystem = points;
    AppState.stormParticleData   = { positions, ...extra };
  },

  update(time) {
    if (!AppState.stormParticleSystem) return;

    if (this._type === 'hurricane')    this._updateHurricane(time);
    if (this._type === 'thunderstorm') this._updateThunderstorm(time);

    AppState.stormParticleSystem.geometry.attributes.position.needsUpdate = true;
  },

  _updateHurricane(time) {
    const { positions, angles, radii, speeds } = AppState.stormParticleData;
    const pos      = Config.settings.hurricanePosition;
    const rotSpeed = this.OPTIONS.HURRICANE_ROTATION_SPEED;
    const count    = this.OPTIONS.HURRICANE_PARTICLES;

    for (let i = 0; i < count; i++) {
      angles[i] += rotSpeed * speeds[i];
      positions[i * 3    ] = pos.x + Math.cos(angles[i]) * radii[i];
      positions[i * 3 + 2] = pos.z + Math.sin(angles[i]) * radii[i];
      positions[i * 3 + 1] += Math.sin(time * 0.5 + angles[i]) * 0.01;
    }
  },

  _updateThunderstorm(time) {
    const { positions, altitudes } = AppState.stormParticleData;
    const pos      = Config.settings.thunderstormPosition;
    const maxY     = CONSTANTS.FLIGHT_LEVELS.COUNT * CONSTANTS.GRID.SPACING;
    const RISE     = this.OPTIONS.THUNDERSTORM_RISE_SPEED;
    const COLUMN_R = 1.5;
    const count    = this.OPTIONS.THUNDERSTORM_PARTICLES;

    for (let i = 0; i < count; i++) {
      altitudes[i] += RISE;
      positions[i * 3 + 1] = altitudes[i];

      if (altitudes[i] > maxY) {
        altitudes[i] = 0;
        const angle = Math.random() * Math.PI * 2;
        const r     = Math.random() * COLUMN_R;
        positions[i * 3    ] = pos.x + Math.cos(angle) * r;
        positions[i * 3 + 2] = pos.z + Math.sin(angle) * r;
      }
    }

    // Flicker the point light
    this._lightFlicker++;
    if (this._lightFlicker % 5 === 0 && this._light) {
      this._light.intensity = 1 + Math.random() * 3;
    }
  },

  dispose() {
    if (AppState.stormParticleSystem) {
      AppState.scene.remove(AppState.stormParticleSystem);
      AppState.stormParticleSystem.geometry.dispose();
      AppState.stormParticleSystem.material.dispose();
      AppState.stormParticleSystem = null;
      AppState.stormParticleData   = null;
    }
    if (this._light) {
      AppState.scene.remove(this._light);
      this._light.dispose?.();
      this._light = null;
    }
    this._type        = null;
    this._lightFlicker = 0;
  }
};
