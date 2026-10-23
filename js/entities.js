const ENTITY_TYPE = {
  CHICKEN: 'CHICKEN', TREE: 'TREE', ROCK: 'ROCK', SLIME: 'SLIME',
  SPIDER: 'SPIDER', GOBLIN: 'GOBLIN',
  STICK_PICKUP: 'STICK_PICKUP', STONE_PICKUP: 'STONE_PICKUP', CAMPFIRE: 'CAMPFIRE',
  PORTAL: 'PORTAL',
};

const ENTITY_CONFIG = {
  CHICKEN:      { nameSingular: 'pollo', namePlural: 'pollos', size: 8, speed: 25, detectRadius: 40, interactRadius: 18, shadowSize: 4 },
  TREE:         { nameSingular: 'árbol', namePlural: 'árboles', size: 14, interactRadius: 20, shadowSize: 8 },
  ROCK:         { nameSingular: 'piedra', namePlural: 'piedras', size: 12, interactRadius: 18, shadowSize: 6 },
  SLIME:        { nameSingular: 'slime', namePlural: 'slimes', size: 10, speed: 35, detectRadius: 80, interactRadius: 16, shadowSize: 5, damage: 1 },
  SPIDER:       { nameSingular: 'araña', namePlural: 'arañas', size: 10, speed: 55, detectRadius: 100, interactRadius: 16, shadowSize: 4, damage: 2 },
  GOBLIN:       { nameSingular: 'duende', namePlural: 'duendes', size: 12, speed: 40, detectRadius: 120, interactRadius: 20, shadowSize: 5, damage: 1 },
  STICK_PICKUP: { nameSingular: 'rama suelta', namePlural: 'ramas sueltas', size: 6, interactRadius: 12, shadowSize: 3 },
  STONE_PICKUP: { nameSingular: 'piedra suelta', namePlural: 'piedras sueltas', size: 6, interactRadius: 12, shadowSize: 3 },
  CAMPFIRE:     { nameSingular: 'fogata', namePlural: 'fogatas', size: 10, interactRadius: 14, lightRadius: 55, shadowSize: 5 },
  PORTAL:       { nameSingular: 'portal', namePlural: 'portales', size: 16, interactRadius: 20, shadowSize: 8, lightRadius: 70 },
};

class Entity {
  constructor(type, x, y, world) {
    this.type = type; this.x = x; this.y = y;
    this.config = ENTITY_CONFIG[type];
    this.alive = true; this.harvested = false;
    this.direction = Math.random() * Math.PI * 2;
    this.interactCooldown = 0;
    this.wanderTimer = 1 + Math.random() * 2;
    this.wanderDir = Math.random() * Math.PI * 2;
    this.flickerPhase = Math.random() * Math.PI * 2;
    this.heightPx = world ? world.getHeightAt(x, y) : 0;
    this.jumpPhase = Math.random() * Math.PI;
    this.attackCooldown = 0;
    this.attackAnimTimer = 0; // ⚠️ Animación de ataque
  }

  update(dt, player, world) {
    if (!this.alive || this.harvested) return;
    if (this.interactCooldown > 0) this.interactCooldown -= dt;
    if (this.attackCooldown > 0) this.attackCooldown -= dt;
    if (this.attackAnimTimer > 0) this.attackAnimTimer -= dt;
    
    this.heightPx = world.getHeightAt(this.x, this.y);
    
    if (this.type === ENTITY_TYPE.CHICKEN) this.updateChicken(dt, player, world);
    if (this.type === ENTITY_TYPE.SLIME) this.updateSlime(dt, player, world);
    if (this.type === ENTITY_TYPE.SPIDER) this.updateSpider(dt, player, world);
    if (this.type === ENTITY_TYPE.GOBLIN) this.updateGoblin(dt, player, world);
    if (this.type === ENTITY_TYPE.CAMPFIRE || this.type === ENTITY_TYPE.PORTAL) this.flickerPhase += dt * 6;
  }

  updateChicken(dt, player, world) {
    const dx = this.x - player.x; const dy = this.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < this.config.detectRadius && dist > 0.1) {
      this.direction = Math.atan2(dy, dx); this.wanderTimer = 0.5;
    } else {
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) { this.wanderDir = Math.random() * Math.PI * 2; this.wanderTimer = 1 + Math.random() * 2; }
      this.direction = this.wanderDir;
    }
    const speed = this.config.speed;
    const nx = this.x + Math.cos(this.direction) * speed * dt;
    const ny = this.y + Math.sin(this.direction) * speed * dt;
    if (world.isWalkable(world.getTile(Math.floor(nx / TILE_SIZE), Math.floor(ny / TILE_SIZE)))) {
      this.x = nx; this.y = ny;
    }
  }

  updateSlime(dt, player, world) {
    this.jumpPhase += dt * 8;
    const dx = player.x - this.x; const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < this.config.detectRadius && dist > 0.1) {
      this.direction = Math.atan2(dy, dx);
      if (dist < this.config.interactRadius && this.attackCooldown <= 0) {
        player.takeDamage(this.config.damage);
        this.attackCooldown = 1.5;
        this.attackAnimTimer = 0.3; // ⚠️ Animación
      } else {
        const speed = this.config.speed;
        const nx = this.x + Math.cos(this.direction) * speed * dt;
        const ny = this.y + Math.sin(this.direction) * speed * dt;
        if (world.isWalkable(world.getTile(Math.floor(nx / TILE_SIZE), Math.floor(ny / TILE_SIZE)))) {
          this.x = nx; this.y = ny;
        }
      }
    }
  }

  updateSpider(dt, player, world) {
    const dx = player.x - this.x; const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < this.config.detectRadius && dist > 0.1) {
      this.direction = Math.atan2(dy, dx);
      if (dist < this.config.interactRadius && this.attackCooldown <= 0) {
        player.takeDamage(this.config.damage);
        this.attackCooldown = 1.2;
        this.attackAnimTimer = 0.3; // ⚠️ Animación
      } else {
        const speed = this.config.speed;
        const nx = this.x + Math.cos(this.direction) * speed * dt;
        const ny = this.y + Math.sin(this.direction) * speed * dt;
        if (world.isWalkable(world.getTile(Math.floor(nx / TILE_SIZE), Math.floor(ny / TILE_SIZE)))) {
          this.x = nx; this.y = ny;
        }
      }
    } else {
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) { this.wanderDir = Math.random() * Math.PI * 2; this.wanderTimer = 1 + Math.random() * 2; }
      this.direction = this.wanderDir;
      const nx = this.x + Math.cos(this.direction) * this.config.speed * 0.5 * dt;
      const ny = this.y + Math.sin(this.direction) * this.config.speed * 0.5 * dt;
      if (world.isWalkable(world.getTile(Math.floor(nx / TILE_SIZE), Math.floor(ny / TILE_SIZE)))) {
        this.x = nx; this.y = ny;
      }
    }
  }

  updateGoblin(dt, player, world) {
    const dx = player.x - this.x; const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < this.config.detectRadius && dist > 0.1) {
      this.direction = Math.atan2(dy, dx);
      if (dist < this.config.detectRadius && dist > this.config.interactRadius && this.attackCooldown <= 0) {
        player.takeDamage(this.config.damage);
        this.attackCooldown = 2.0;
        this.attackAnimTimer = 0.3; // ⚠️ Animación
      }
      
      if (dist > this.config.interactRadius) {
        const speed = this.config.speed;
        const nx = this.x + Math.cos(this.direction) * speed * dt;
        const ny = this.y + Math.sin(this.direction) * speed * dt;
        if (world.isWalkable(world.getTile(Math.floor(nx / TILE_SIZE), Math.floor(ny / TILE_SIZE)))) {
          this.x = nx; this.y = ny;
        }
      }
    } else {
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) { this.wanderDir = Math.random() * Math.PI * 2; this.wanderTimer = 1 + Math.random() * 2; }
      this.direction = this.wanderDir;
      const nx = this.x + Math.cos(this.direction) * this.config.speed * 0.7 * dt;
      const ny = this.y + Math.sin(this.direction) * this.config.speed * 0.7 * dt;
      if (world.isWalkable(world.getTile(Math.floor(nx / TILE_SIZE), Math.floor(ny / TILE_SIZE)))) {
        this.x = nx; this.y = ny;
      }
    }
  }

  distanceTo(px, py) { const dx = this.x - px; const dy = this.y - py; return Math.sqrt(dx * dx + dy * dy); }

  tryDestroy(toolId) {
    const drops = {};
    if (this.type === ENTITY_TYPE.STICK_PICKUP) { this.harvested = true; drops.WOOD = 1; return { success: true, drops }; }
    if (this.type === ENTITY_TYPE.STONE_PICKUP) { this.harvested = true; drops.STONE = 1; return { success: true, drops }; }
    
    if (this.type === ENTITY_TYPE.CHICKEN) {
      if (toolId === 'SWORD_BASIC') { this.alive = false; drops.MEAT = 1; drops.FEATHER = 1; return { success: true, drops }; }
      return { success: false, drops, reason: 'necesito algo afilado' };
    }
    if (this.type === ENTITY_TYPE.SLIME) {
      if (toolId === 'SWORD_BASIC') { this.alive = false; drops.SLIME_GEL = 1; return { success: true, drops }; }
      return { success: false, drops, reason: 'necesito un arma' };
    }
    if (this.type === ENTITY_TYPE.SPIDER) {
      if (toolId === 'SWORD_BASIC') { this.alive = false; drops.SPIDER_EYE = 1; return { success: true, drops }; }
      return { success: false, drops, reason: 'necesito un arma' };
    }
    if (this.type === ENTITY_TYPE.GOBLIN) {
      if (toolId === 'SWORD_BASIC') { this.alive = false; drops.GOLD_COIN = 1; return { success: true, drops }; }
      return { success: false, drops, reason: 'necesito un arma' };
    }
    
    if (this.type === ENTITY_TYPE.TREE) {
      if (toolId === 'HACHA_TOSCA') { return { success: true, drops }; }
      return { success: false, drops, reason: 'necesito un hacha' };
    }
    if (this.type === ENTITY_TYPE.ROCK) {
      if (toolId === 'PICO_TOSCO') { return { success: true, drops }; }
      return { success: false, drops, reason: 'necesito un pico' };
    }
    return { success: false, drops };
  }
}

class EntityManager {
  constructor(world) { this.world = world; this.entities = []; this.spawnAll(); }

  isSpaceFree(tx, ty, minDistanceTiles) {
    const worldX = tx * TILE_SIZE; const worldY = ty * TILE_SIZE;
    const minDistPx = minDistanceTiles * TILE_SIZE;
    for (const e of this.entities) {
      if (e.type === ENTITY_TYPE.CHICKEN || e.type === ENTITY_TYPE.STICK_PICKUP || e.type === ENTITY_TYPE.STONE_PICKUP) continue; 
      const dx = e.x - worldX; const dy = e.y - worldY;
      if (Math.sqrt(dx * dx + dy * dy) < minDistPx) return false;
    }
    return true;
  }

  spawnAll() {
    // ⚠️ AHORA SIEMPRE HAY ENEMIGOS Y RECURSOS, EN EL HUB Y EN EL MUNDO
    this.spawnOnTileType(TILE.GRASS,  ENTITY_TYPE.STONE_PICKUP, 80, 0);
    this.spawnOnTileType(TILE.SAND,   ENTITY_TYPE.STONE_PICKUP, 80, 0);
    this.spawnOnTileType(TILE.FOREST, ENTITY_TYPE.STONE_PICKUP, 80, 0); 
    this.spawnOnTileType(TILE.GRASS,  ENTITY_TYPE.STICK_PICKUP, 60, 0);
    this.spawnOnTileType(TILE.FOREST, ENTITY_TYPE.STICK_PICKUP, 40, 0);
    this.spawnOnTileType(TILE.FOREST, ENTITY_TYPE.TREE, 25, 2.5);
    this.spawnRocksAccessible(100, 2.5);
    this.spawnOnTileType(TILE.FOREST, ENTITY_TYPE.ROCK, 100, 2.5);
    this.spawnOnTileType(TILE.GRASS,  ENTITY_TYPE.CHICKEN, 600, 0);
    
    // Enemigos en TODOS los mapas
    this.spawnOnTileType(TILE.FOREST, ENTITY_TYPE.SLIME, 300, 3);
    this.spawnOnTileType(TILE.FOREST, ENTITY_TYPE.SPIDER, 400, 3);
    this.spawnOnTileType(TILE.FOREST, ENTITY_TYPE.GOBLIN, 500, 3);

    // ⚠️ PORTAL CERCA (Radio de 20 tiles desde el centro)
    if (World.isHub) {
      let placed = false;
      let attempts = 0;
      while (!placed && attempts < 100) {
        attempts++;
        const centerX = Math.floor(this.world.width / 2);
        const centerY = Math.floor(this.world.height / 2);
        const radius = 15; // 15 tiles de distancia máxima
        const tx = centerX + Math.floor((Math.random() - 0.5) * radius * 2);
        const ty = centerY + Math.floor((Math.random() - 0.5) * radius * 2);
        
        if (tx >= 0 && tx < this.world.width && ty >= 0 && ty < this.world.height) {
           if (this.world.tiles[ty][tx] === TILE.FOREST && this.isSpaceFree(tx, ty, 3)) {
             this.entities.push(new Entity(ENTITY_TYPE.PORTAL, tx * TILE_SIZE + TILE_SIZE/2, ty * TILE_SIZE + TILE_SIZE/2, this.world));
             placed = true;
           }
        }
      }
    }
  }

  spawnOnTileType(tileType, entityType, tilesPerEntity, minDistTiles) {
    const w = this.world; const candidates = [];
    for (let ty = 0; ty < w.height; ty++) for (let tx = 0; tx < w.width; tx++) {
      if (w.tiles[ty][tx] === tileType) candidates.push({ tx, ty });
    }
    if (candidates.length === 0) return;
    candidates.sort(() => Math.random() - 0.5);
    let placed = 0; const maxCount = Math.floor(candidates.length / tilesPerEntity);
    for (let i = 0; i < candidates.length; i++) {
      if (placed >= maxCount) break;
      const { tx, ty } = candidates[i];
      if (minDistTiles > 0 && !this.isSpaceFree(tx, ty, minDistTiles)) continue;
      const jitterX = Math.random() * (TILE_SIZE - 8); const jitterY = Math.random() * (TILE_SIZE - 8);
      this.entities.push(new Entity(entityType, tx * TILE_SIZE + jitterX, ty * TILE_SIZE + jitterY, w));
      placed++;
    }
  }

  spawnRocksAccessible(tilesPerEntity, minDistTiles) {
    const w = this.world; const candidates = [];
    for (let ty = 0; ty < w.height; ty++) for (let tx = 0; tx < w.width; tx++) {
      if (w.tiles[ty][tx] !== TILE.STONE) continue;
      const neighbors = [[tx + 1, ty], [tx - 1, ty], [tx, ty + 1], [tx, ty - 1]];
      let accessible = false;
      for (const [nx, ny] of neighbors) {
        const nt = w.getTile(nx, ny);
        if (nt !== null && w.isWalkable(nt) && w.getTileHeight(nx, ny) === 0) { accessible = true; break; }
      }
      if (accessible) candidates.push({ tx, ty });
    }
    if (candidates.length === 0) return;
    candidates.sort(() => Math.random() - 0.5);
    let placed = 0; const maxCount = Math.floor(candidates.length / tilesPerEntity);
    for (let i = 0; i < candidates.length; i++) {
      if (placed >= maxCount) break;
      const { tx, ty } = candidates[i];
      if (minDistTiles > 0 && !this.isSpaceFree(tx, ty, minDistTiles)) continue;
      const jitterX = Math.random() * (TILE_SIZE - 8); const jitterY = Math.random() * (TILE_SIZE - 8);
      this.entities.push(new Entity(ENTITY_TYPE.ROCK, tx * TILE_SIZE + jitterX, ty * TILE_SIZE + jitterY, w));
      placed++;
    }
  }

  placeCampfire(px, py) {
    const fire = new Entity(ENTITY_TYPE.CAMPFIRE, px, py, this.world);
    this.entities.push(fire); return fire;
  }

  isNearCampfire(px, py, radius = 50) {
    for (const e of this.entities) {
      if (e.type !== ENTITY_TYPE.CAMPFIRE) continue;
      if (e.distanceTo(px, py) <= radius) return e;
    }
    return null;
  }

  update(dt, player) { for (const e of this.entities) e.update(dt, player, this.world); }
  findNearestOfType(type, px, py, radius) {
    let best = null, bestDist = radius;
    for (const e of this.entities) {
      if (e.type !== type || !e.alive || e.harvested) continue;
      const d = e.distanceTo(px, py);
      if (d < bestDist) { bestDist = d; best = e; }
    }
    return best;
  }
  findNearestAny(px, py, radius) {
    let best = null, bestDist = radius;
    for (const e of this.entities) {
      if (!e.alive || e.harvested) continue;
      const d = e.distanceTo(px, py);
      if (d < bestDist) { bestDist = d; best = e; }
    }
    return best;
  }
}