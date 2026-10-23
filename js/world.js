const TILE_SIZE = 16;

const TILE = {
  DEEP_WATER: 0, WATER: 1, SAND: 2, GRASS: 3,
  FOREST: 4, TUNDRA: 5, STONE: 6, SNOW: 7,
};

const TILE_COLORS = {
  [TILE.DEEP_WATER]: '#3d9bf5', [TILE.WATER]: '#59b5ff', [TILE.SAND]: '#fce38a',
  [TILE.GRASS]: '#b2d44d', [TILE.FOREST]: '#6ba843', [TILE.TUNDRA]: '#9db39d',
  [TILE.STONE]: '#a8a8a8', [TILE.SNOW]: '#ffffff',
};

const TILE_COLORS_DARK = {
  [TILE.DEEP_WATER]: '#2a7bc7', [TILE.WATER]: '#3d9bf5', [TILE.SAND]: '#e6c87a',
  [TILE.GRASS]: '#8aa83a', [TILE.FOREST]: '#4a7a2e', [TILE.TUNDRA]: '#6e806e',
  [TILE.STONE]: '#7a7a7a', [TILE.SNOW]: '#dce6f2',
};

const TILE_HEIGHT_BASE = {
  [TILE.DEEP_WATER]: 0, [TILE.WATER]: 0, [TILE.SAND]: 0,
  [TILE.GRASS]: 1, [TILE.FOREST]: 1, [TILE.TUNDRA]: 1,
  [TILE.STONE]: 3, [TILE.SNOW]: 5,
};

const TILE_SIDE_COLORS = {
  [TILE.DEEP_WATER]: '#1e5c9e', [TILE.WATER]: '#2a7bc7', [TILE.SAND]: '#c2a255',
  [TILE.GRASS]: '#d97a2b', [TILE.FOREST]: '#a85c1e', [TILE.TUNDRA]: '#8c6d55',
  [TILE.STONE]: '#5c5c5c', [TILE.SNOW]: '#a3b8c9',
};

const TILE_NAMES = ['Deep water', 'Water', 'Sand', 'Grass', 'Forest', 'Tundra', 'Stone', 'Snow'];
const VARIANTS_PER_TILE = 3;

function hash(x, y, seed) {
  let h = x * 374761393 + y * 668265263 + seed * 1442695041;
  h = (h ^ (h >> 13)) * 1274126177; h = h ^ (h >> 16);
  return (h >>> 0) / 4294967295;
}
function smoothstep(t) { return t * t * (3 - 2 * t); }
function valueNoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const v00 = hash(xi, yi, seed), v10 = hash(xi + 1, yi, seed);
  const v01 = hash(xi, yi + 1, seed), v11 = hash(xi + 1, yi + 1, seed);
  const u = smoothstep(xf), v = smoothstep(yf);
  return (v00 * (1 - u) + v10 * u) * (1 - v) + (v01 * (1 - u) + v11 * u) * v;
}
function fbm(x, y, seed, octaves = 4) {
  let total = 0, freq = 1, amp = 1, max = 0;
  for (let i = 0; i < octaves; i++) {
    total += valueNoise(x * freq, y * freq, seed + i * 100) * amp;
    max += amp; freq *= 2; amp *= 0.5;
  }
  return total / max;
}

class World {
  constructor(width, height) {
    this.width = width; this.height = height;
    this.tiles = []; this.heightMap = []; this.props = [];
    this.SECONDS_PER_DAY = 120; this.START_HOUR = 7; this.totalSeconds = 0;
    
    // ⚠️ Si no está definido, por defecto false
    if (typeof World.isHub === 'undefined') World.isHub = false;

    this.generateValidatedWorld();
    this.buildSpriteCache();
    this.printDistribution();
  }

  advanceClock(dt) { this.totalSeconds += dt; }
  getClock() {
    const dp = (this.totalSeconds % this.SECONDS_PER_DAY) / this.SECONDS_PER_DAY;
    const hf = (this.START_HOUR + dp * 24) % 24;
    const hour = Math.floor(hf), minute = Math.floor((hf - hour) * 60);
    const day = Math.floor(this.totalSeconds / this.SECONDS_PER_DAY) + 1;
    return { day, hour, minute, totalSeconds: this.totalSeconds };
  }
  getDaylight() {
    const c = this.getClock(), h = c.hour + c.minute / 60;
    if (h >= 8 && h <= 18) return 1.0;
    if (h >= 5 && h < 8) return (h - 5) / 3;
    if (h > 18 && h <= 21) return 1 - (h - 18) / 3;
    return 0.0;
  }

  generateValidatedWorld() {
    for (let attempt = 1; attempt <= 10; attempt++) {
      this.generate();
      const spawn = this.findSpawnTile();
      const accessibleCount = this.floodFillAccessible(spawn.x, spawn.y);
      if (accessibleCount / (this.width * this.height) >= 0.25) return;
    }
  }

  floodFillAccessible(sx, sy) {
    const visited = new Set([[sx, sy].join(',')]);
    const queue = [[sx, sy]];
    let count = 0;
    while (queue.length > 0) {
      const [cx, cy] = queue.shift(); count++;
      const ch = this.getTileHeight(cx, cy);
      const neighbors = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
      for (const [nx, ny] of neighbors) {
        const key = [nx, ny].join(',');
        if (visited.has(key)) continue;
        const nt = this.getTile(nx, ny);
        if (nt === null || !this.isWalkable(nt)) continue;
        if (Math.abs(this.getTileHeight(nx, ny) - ch) > ISO_H / 2) continue;
        visited.add(key); queue.push([nx, ny]);
      }
    }
    return count;
  }

  generate() {
    this.tiles = []; this.heightMap = []; this.props = [];
    const seed = Math.floor(Math.random() * 100000);
    const scale = 0.025;
    const warpScale = 0.01;
    
    const heights = [];
    for (let y = 0; y < this.height; y++) {
      const row = [];
      for (let x = 0; x < this.width; x++) {
        const warpX = fbm(x * warpScale, y * warpScale, seed + 100, 3) * 30;
        const warpY = fbm(x * warpScale, y * warpScale, seed + 200, 3) * 30;
        
        let h = fbm((x + warpX) * scale, (y + warpY) * scale, seed, 5);
        const humidity = fbm(x * scale * 2, y * scale * 2, seed + 300, 3) + 0.15;
        const temperature = fbm(x * scale * 1.5, y * scale * 1.5, seed + 400, 3);

        const mx = Math.min(x, this.width - 1 - x) / (this.width * 0.5);
        const my = Math.min(y, this.height - 1 - y) / (this.height * 0.5);
        h *= Math.pow(Math.max(0, Math.min(mx, my)), 0.8);
        
        row.push({ h, humidity, temperature });
      }
      heights.push(row);
    }

    const flatH = [];
    for (let y = 0; y < this.height; y++)
      for (let x = 0; x < this.width; x++)
        flatH.push(heights[y][x].h);
    flatH.sort((a, b) => a - b);

    const dist = World.isHub ? [
      { tile: TILE.FOREST, pct: 0.90 },
      { tile: TILE.GRASS, pct: 0.10 },
    ] : [
      { tile: TILE.DEEP_WATER, pct: 0.12 }, { tile: TILE.WATER, pct: 0.08 },
      { tile: TILE.SAND, pct: 0.06 }, { tile: TILE.GRASS, pct: 0.45 },
      { tile: TILE.STONE, pct: 0.18 }, { tile: TILE.SNOW, pct: 0.11 },
    ];

    const thresholds = []; let acc = 0;
    for (const d of dist) {
      acc += d.pct;
      thresholds.push({ tile: d.tile, maxH: flatH[Math.min(flatH.length - 1, Math.floor(acc * flatH.length))] });
    }

    for (let y = 0; y < this.height; y++) {
      const tRow = [], hRow = [];
      for (let x = 0; x < this.width; x++) {
        const { h, humidity, temperature } = heights[y][x];
        let tile = TILE.SNOW;

        for (const t of thresholds) { if (h <= t.maxH) { tile = t.tile; break; } }

        if (!World.isHub && tile === TILE.GRASS) {
          if (humidity > 0.45 && temperature > 0.3) tile = TILE.FOREST;
          else if (temperature < 0.35) tile = TILE.TUNDRA;
        }

        tRow.push(tile);

        let bLvl = TILE_HEIGHT_BASE[tile], eLvl = 0;
        if (tile === TILE.GRASS || tile === TILE.FOREST || tile === TILE.TUNDRA || tile === TILE.STONE) {
          const nv = fbm(x * 0.1, y * 0.1, seed + 500, 3);
          if (nv > 0.6) eLvl = 1;
          if (nv > 0.8) eLvl = 2;
        }
        hRow.push(bLvl + eLvl);
      }
      this.tiles.push(tRow); this.heightMap.push(hRow);
    }

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const t = this.tiles[y][x];
        const r = hash(x, y, 999);
        if (t === TILE.SNOW && r > 0.9) this.props.push({ type: 'dry_tree', tx: x, ty: y });
        else if (t === TILE.TUNDRA && r > 0.9) this.props.push({ type: 'dead_bush', tx: x, ty: y });
        else if (t === TILE.FOREST && r > 0.95) this.props.push({ type: 'rock_small', tx: x, ty: y });
        else if (t === TILE.GRASS && r > 0.95) this.props.push({ type: 'flowers', tx: x, ty: y });
      }
    }
  }

  buildSpriteCache() {
    for (let t = 0; t < 8; t++) {
      for (let v = 0; v < VARIANTS_PER_TILE; v++) getTileSprite(t, 0, v);
    }
  }

  printDistribution() {
    const counts = {}; let total = 0;
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) {
      const t = this.tiles[y][x]; counts[t] = (counts[t] || 0) + 1; total++;
    }
    console.log(`--- Distribución del mundo (${World.isHub ? 'HUB' : 'BIOMAS'}) ---`);
    for (let i = 0; i < TILE_NAMES.length; i++)
      console.log(`${TILE_NAMES[i].padEnd(12)} ${((counts[i] || 0) / total * 100).toFixed(1)}%`);
  }

  getTile(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return null;
    return this.tiles[y][x];
  }
  getTileHeight(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) return 0;
    return this.heightMap[ty][tx] * (ISO_H / 2);
  }
  getHeightAt(worldX, worldY) {
    return this.getTileHeight(Math.floor(worldX / TILE_SIZE), Math.floor(worldY / TILE_SIZE));
  }
  isWalkable(tile) {
    return tile !== null && tile !== TILE.DEEP_WATER && tile !== TILE.WATER;
  }

  findSpawnTile() {
    const cx = Math.floor(this.width / 2), cy = Math.floor(this.height / 2);
    for (let r = 0; r < Math.max(this.width, this.height); r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const t = this.getTile(cx + dx, cy + dy);
        if (t !== null && this.isWalkable(t) && this.getTileHeight(cx + dx, cy + dy) === ISO_H / 2)
          return { x: cx + dx, y: cy + dy };
      }
    }
    return { x: cx, y: cy };
  }

  draw(ctx, camera) {
    const camX = Math.floor(camera.x), camY = Math.floor(camera.y);
    const corners = [
      screenToIso(camX, camY), screenToIso(camX + camera.viewW, camY),
      screenToIso(camX, camY + camera.viewH), screenToIso(camX + camera.viewW, camY + camera.viewH),
    ];
    const minX = Math.floor(Math.min(...corners.map(c => c.x))) - 2;
    const maxX = Math.ceil(Math.max(...corners.map(c => c.x))) + 2;
    const minY = Math.floor(Math.min(...corners.map(c => c.y))) - 2;
    const maxY = Math.ceil(Math.max(...corners.map(c => c.y))) + 2;
    const startX = Math.max(0, minX), endX = Math.min(this.width - 1, maxX);
    const startY = Math.max(0, minY), endY = Math.min(this.height - 1, maxY);
    const minSum = startX + startY, maxSum = endX + endY;
    const OVERLAP = 1;

    for (let sum = minSum; sum <= maxSum; sum++) {
      for (let y = startY; y <= endY; y++) {
        const x = sum - y;
        if (x < startX || x > endX) continue;
        const tile = this.tiles[y][x], level = this.heightMap[y][x];
        const iso = isoToScreen(x, y);
        const px = Math.floor(iso.px - camX), py = Math.floor(iso.py - camY);
        const variant = Math.floor(hash(x, y, 7) * VARIANTS_PER_TILE);
        const heightPx = level * (ISO_H / 2);
        const sprite = getTileSprite(tile, heightPx, variant);
        const drawX = Math.floor(px - ISO_W / 2);
        const drawY = Math.floor(py - sprite.anchorY - heightPx);
        ctx.drawImage(sprite.canvas, drawX, drawY, sprite.canvas.width + OVERLAP, sprite.canvas.height + OVERLAP);
      }
    }
  }
}

// ⚠️ INICIALIZACIÓN AQUÍ (Después de la clase)
World.isHub = true;