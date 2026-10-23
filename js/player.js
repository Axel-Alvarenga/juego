class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.size = 12;
    this.speed = 60;

    this.dirX = 0;
    this.dirY = 0;

    this.changeTimer = 0;
    this.heightPx = 0;

    this.hp = 10; this.hpMax = 10; this.xp = 0;
    this.hunger = 30 + Math.random() * 20;
    this.energy = 70 + Math.random() * 20;
    this.curiosity = 40 + Math.random() * 30;
    this.cold = 0;

    this.xpStepTimer = 0; this.xpPerStep = 0.1; this.xpStepEvery = 1.5;
    this.thinkTimer = 2 + Math.random() * 3;
    this.inventoryOpen = 0;
    this.currentIntent = '';
    
    this.needThought = null;

    this.inventory = null;
    this.knowledge = null;
    this.entityManager = null;
    this.craftPanel = null;
    this.world = null;

    this.seenTileTypes = new Set();
    this.seenEntityTypes = new Set();
    this.hasSeenChicken = false;

    this.target = null;
    this.targetDuration = 0;

    this.craftState = 'idle';
    this.craftTimer = 0; this.craftStateTimer = 0;
    this.craftItemA = null; this.craftItemB = null; this.craftResult = null;
    this.craftTargetResult = null;
    this.craftExcludeResults = [];

    this.isChopping = false;
    this.chopTimer = 0;
    this.chopTarget = null;
    this.chopDuration = 3.0;

    this.isMining = false;
    this.mineTimer = 0;
    this.mineTarget = null;
    this.mineDuration = 3.0;

    this.stuckTimer = 0;
    this.lastX = x; this.lastY = y;
    this.entityCooldowns = new Map();
    this.walkAnim = 0;
    this.fireCooldown = 0;
    this.damageFlash = 0;
    this.isFleeing = false;
    
    this.triggeredPortal = false;
    this.knownPortalPos = null;

    this.invulnerableTimer = 0;

    this.tileNames = { 0: 'agua profunda', 1: 'agua', 2: 'arena', 3: 'hierba', 4: 'bosque', 5: 'tundra', 6: 'montaña', 7: 'nieve' };
  }

  attachInventory(inv) { this.inventory = inv; }
  attachKnowledge(kn) { this.knowledge = kn; }
  attachEntities(em) { this.entityManager = em; }
  attachCraftPanel(cp) { this.craftPanel = cp; }
  attachWorld(w) { this.world = w; }

  isCrafting() {
    if (this.craftState === 'idle') return false;
    if (this.craftStateTimer > 5) { this.abortCraft(); return false; }
    return true;
  }

  abortCraft() {
    this.craftState = 'idle'; this.craftTimer = 0; this.craftStateTimer = 0;
    this.craftItemA = null; this.craftItemB = null; this.craftResult = null; this.craftTargetResult = null;
    this.craftExcludeResults = [];
    this.currentIntent = ''; this.thinkTimer = 0;
    if (this.craftPanel) this.craftPanel.close();
  }

  takeDamage(amount) {
    if (this.hp <= 0) return;
    if (this.invulnerableTimer > 0) return;
    this.hp -= amount;
    this.damageFlash = 0.5;
    this.hunger = Math.min(100, this.hunger + 5);

    if (this.hp <= 0) {
      this.hp = 0;
      this.isFleeing = false; this.isChopping = false; this.isMining = false;
      this.abortCraft(); this.currentIntent = '¡Me he desmayado!'; this.damageFlash = 2.0;
      
      setTimeout(() => {
        this.hp = this.hpMax; 
        this.hunger = Math.max(50, this.hunger);
        this.invulnerableTimer = 3.0;
        this.findSafeSpawn();
        this.currentIntent = 'Despierto... ¿qué ha pasado?';
      }, 2000);
    }
  }

  findSafeSpawn() {
    if (!this.world) return;
    const cx = Math.floor(this.world.width / 2);
    const cy = Math.floor(this.world.height / 2);

    for (let r = 0; r < 20; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const tx = cx + dx;
          const ty = cy + dy;
          if (tx >= 0 && tx < this.world.width && ty >= 0 && ty < this.world.height) {
            const tile = this.world.getTile(tx, ty);
            if (tile !== null && this.world.isWalkable(tile) && this.world.getTileHeight(tx, ty) === 0) {
              let enemyNear = false;
              if (this.entityManager) {
                for (const e of this.entityManager.entities) {
                  if (e.type === ENTITY_TYPE.SLIME || e.type === ENTITY_TYPE.SPIDER || e.type === ENTITY_TYPE.GOBLIN) {
                    if (e.distanceTo(tx * TILE_SIZE, ty * TILE_SIZE) < 100) { enemyNear = true; break; }
                  }
                }
              }
              if (!enemyNear) {
                this.x = tx * TILE_SIZE + (TILE_SIZE - this.size) / 2;
                this.y = ty * TILE_SIZE + (TILE_SIZE - this.size) / 2;
                return;
              }
            }
          }
        }
      }
    }

    // Si no encuentra, se queda donde está
    if (this.entityManager) {
      for (const e of this.entityManager.entities) {
        if (e.type === ENTITY_TYPE.SLIME || e.type === ENTITY_TYPE.SPIDER || e.type === ENTITY_TYPE.GOBLIN) {
          const dx = e.x - this.x;
          const dy = e.y - this.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150 && dist > 0.1) {
            e.x += (dx / dist) * 100;
            e.y += (dy / dist) * 100;
          }
        }
      }
    }
  }

  update(dt, world) {
    if (!this.world) this.world = world;
    if (this.knowledge) this.knowledge.advanceClock(dt);
    updateCraftCooldowns(dt);
    
    if (this.damageFlash > 0) this.damageFlash -= dt;
    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    if (this.invulnerableTimer > 0) this.invulnerableTimer -= dt;
    for (const [entity, time] of this.entityCooldowns) {
      const next = time - dt;
      if (next <= 0) this.entityCooldowns.delete(entity);
      else this.entityCooldowns.set(entity, next);
    }

    if (this.hp <= 0) return;

    if (this.craftState !== 'idle') this.craftStateTimer += dt;

    if (this.isCrafting()) {
      this.updateCrafting(dt);
      this.hunger = Math.min(100, this.hunger + dt * 1.2);
      this.energy = Math.max(0, this.energy - dt * 0.6);
      return;
    }

    if (this.isChopping) {
      this.chopTimer += dt; this.currentIntent = 'TALANDO...';
      this.hunger = Math.min(100, this.hunger + dt * 1.2); this.energy = Math.max(0, this.energy - dt * 1.0);
      if (this.chopTimer >= this.chopDuration) this.finishChop();
      return;
    }

    if (this.isMining) {
      this.mineTimer += dt; this.currentIntent = 'MINANDO...';
      this.hunger = Math.min(100, this.hunger + dt * 1.2); this.energy = Math.max(0, this.energy - dt * 1.0);
      if (this.mineTimer >= this.mineDuration) this.finishMine();
      return;
    }

    this.hunger = Math.min(100, this.hunger + dt * 1.2);
    this.energy = Math.max(0, this.energy - dt * 0.6);
    this.curiosity = Math.min(100, this.curiosity + dt * 0.8);

    const daylight = world.getDaylight ? world.getDaylight() : 1;
    const nightIntensity = 1 - daylight;
    if (nightIntensity > 0.3) this.cold = Math.min(100, this.cold + dt * 4 * nightIntensity);
    else this.cold = Math.max(0, this.cold - dt * 6);

    if (this.entityManager) {
      const fire = this.entityManager.isNearCampfire(this.x + this.size / 2, this.y + this.size / 2, 60);
      if (fire) this.cold = Math.max(0, this.cold - dt * 15);
    }

    this.xpStepTimer -= dt;
    if (this.xpStepTimer <= 0) { this.xpStepTimer = this.xpStepEvery; this.xp += this.xpPerStep; }

    if (this.inventoryOpen > 0) {
      this.inventoryOpen -= dt;
      if (this.inventoryOpen <= 0 && this.inventory) { this.inventory.isOpen = false; this.currentIntent = ''; }
    }

    this.thinkTimer -= dt;
    if (this.thinkTimer <= 0) { this.thinkTimer = 1 + Math.random() * 2; this.think(world); }

    this.moveUpdate(dt, world);

    if (Math.abs(this.dirX) > 0.1 || Math.abs(this.dirY) > 0.1) this.walkAnim += dt * 12;
    else this.walkAnim += dt * 3;

    const targetHeight = world.getHeightAt(this.x + this.size / 2, this.y + this.size / 2);
    this.heightPx += (targetHeight - this.heightPx) * Math.min(1, dt * 10);

    this.learnFromCurrentTile(world); this.seeEntities();

    const movedX = Math.abs(this.x - this.lastX); const movedY = Math.abs(this.y - this.lastY);
    const moved = movedX + movedY; this.lastX = this.x; this.lastY = this.y;

    if (this.target && moved < 0.05) {
      this.stuckTimer += dt;
      if (this.stuckTimer > 1.2) {
        this.entityCooldowns.set(this.target, 10);
        this.target = null; this.targetDuration = 0; this.stuckTimer = 0; this.thinkTimer = 0;
        this.currentIntent = 'Está demasiado lejos...';
      }
    } else this.stuckTimer = 0;
  }

  startChop(tree) {
    this.isChopping = true;
    this.chopTimer = 0;
    this.chopTarget = tree;
    this.currentIntent = 'TALANDO...';
    this.target = null;
  }

  finishChop() {
    if (this.chopTarget) {
      this.chopTarget.harvested = true;
      this.inventory.addItem('WOOD', 3);
      this.knowledge.successfulAttempt('hacha + árbol = madera', { a: 'HACHA_TOSCA', b: 'TREE' });
      this.knowledge.learned('los árboles dan mucha madera con hacha');
      this.gainXp(5);
    }
    this.isChopping = false; this.chopTarget = null; this.currentIntent = '¡He conseguido madera!'; this.thinkTimer = 0;
  }

  startMine(rock) {
    this.isMining = true;
    this.mineTimer = 0;
    this.mineTarget = rock;
    this.currentIntent = 'MINANDO...';
    this.target = null;
  }

  finishMine() {
    if (this.mineTarget) {
      this.mineTarget.harvested = true;
      this.inventory.addItem('STONE', 4);
      this.knowledge.successfulAttempt('pico + piedra = piedra', { a: 'PICO_TOSCO', b: 'ROCK' });
      this.knowledge.learned('las piedras dan mucha piedra con pico');
      this.gainXp(5);
    }
    this.isMining = false; this.mineTarget = null; this.currentIntent = '¡He conseguido piedra!'; this.thinkTimer = 0;
  }

  updateCrafting(dt) {
    this.craftTimer -= dt;
    if (this.craftPanel) this.craftPanel.update(dt);
    if (this.craftTimer > 0) return;

    if (this.craftState === 'placing_a') { this.craftState = 'placing_b'; this.craftTimer = 0.3; if (this.craftPanel) this.craftPanel.phase = 'placing_b'; return; }
    if (this.craftState === 'placing_b') { this.craftState = 'thinking'; this.craftTimer = 1.2; if (this.craftPanel) this.craftPanel.goThinking(); return; }
    if (this.craftState === 'thinking') { this.resolveCraft(); return; }
    if (this.craftState === 'success') { this.craftState = 'idle'; this.craftTimer = 0; this.craftStateTimer = 0; this.thinkTimer = 0; if (this.craftPanel) this.craftPanel.close(); this.craftItemA = null; this.craftItemB = null; this.craftResult = null; this.craftTargetResult = null; this.craftExcludeResults = []; this.currentIntent = ''; return; }
    if (this.craftState === 'fail') { this.craftState = 'idle'; this.craftTimer = 0; this.craftStateTimer = 0; this.thinkTimer = 0; if (this.craftPanel) this.craftPanel.close(); this.craftItemA = null; this.craftItemB = null; this.craftExcludeResults = []; this.currentIntent = 'No ha funcionado...'; return; }
  }

  resolveCraft() {
    const result = executeCraft(this.inventory, this.craftItemA, this.craftItemB, this.craftTargetResult, this.craftExcludeResults);
    if (result.success) {
      const item = ITEMS[result.result];
      this.knowledge.successfulAttempt(`${this.craftItemA} + ${this.craftItemB} = ${item.name}`, { a: this.craftItemA, b: this.craftItemB, result: result.result });
      this.knowledge.learned(result.recipe.learnText); this.gainXp(2);
      this.craftResult = result.result; this.craftState = 'success'; this.craftTimer = 1.0;
      if (this.craftPanel) this.craftPanel.showSuccess(result.result);
    } else {
      this.knowledge.failedAttempt(`${this.craftItemA} + ${this.craftItemB}`, { a: this.craftItemA, b: this.craftItemB });
      if (result.hint) this.knowledge.hint(result.hint);
      craftFailCooldowns[craftKey(this.craftItemA, this.craftItemB)] = CRAFTING_FAIL_COOLDOWN;
      this.craftState = 'fail'; this.craftTimer = 0.8;
      if (this.craftPanel) this.craftPanel.showFail();
    }
  }

  startCrafting(itemA, itemB, targetResult = null, qtyA = 1, qtyB = 1) {
    const sorted = [itemA, itemB].sort();
    this.craftItemA = sorted[0]; this.craftItemB = sorted[1]; 
    this.craftTargetResult = targetResult;
    
    this.craftExcludeResults = [];
    if (this.inventory.hasItem('HACHA_TOSCA')) this.craftExcludeResults.push('HACHA_TOSCA');
    if (this.inventory.hasItem('PICO_TOSCO')) this.craftExcludeResults.push('PICO_TOSCO');
    if (this.inventory.hasItem('SWORD_BASIC')) this.craftExcludeResults.push('SWORD_BASIC');
    
    if (itemA === itemB) {
      if (this.craftPanel) this.craftPanel.start(itemA, null, qtyA + qtyB, 0);
    } else {
      if (this.craftPanel) this.craftPanel.start(this.craftItemA, this.craftItemB, qtyA, qtyB);
    }

    this.craftState = 'placing_a'; this.craftTimer = 0.3; this.craftStateTimer = 0;
    this.currentIntent = 'Probando a craftear...'; this.inventoryOpen = 0;
    this.target = null; this.targetDuration = 0;
  }

  // ============================================================
  // 🧠 EL NUEVO CEREBRO DE YONYZ
  // ============================================================
  think(world) {
    if (!this.inventory || this.isCrafting() || this.isChopping || this.isMining) return;
    if (this.hp <= 0) return;

    const isNight = (world.getDaylight ? world.getDaylight() : 1) < 0.4;
    const hasSword = this.inventory.hasItem('SWORD_BASIC');
    const hasAxe = this.inventory.hasItem('HACHA_TOSCA');
    const hasPick = this.inventory.hasItem('PICO_TOSCO');

    // ═══════════════════════════════════════════════════════
    // PRIORIDAD 1: SUPERVIVENCIA INMEDIATA
    // ═══════════════════════════════════════════════════════

    // 1.1 Huir o pelear con enemigos
    const enemies = this.entityManager ? [
      this.findReachableEntity(ENTITY_TYPE.SLIME, this.x + this.size / 2, this.y + this.size / 2, 120),
      this.findReachableEntity(ENTITY_TYPE.SPIDER, this.x + this.size / 2, this.y + this.size / 2, 120),
      this.findReachableEntity(ENTITY_TYPE.GOBLIN, this.x + this.size / 2, this.y + this.size / 2, 150)
    ].filter(e => e !== null) : [];

    let closestEnemy = null;
    let minDist = Infinity;
    for (const e of enemies) {
      const d = e.distanceTo(this.x + this.size / 2, this.y + this.size / 2);
      if (d < minDist) { minDist = d; closestEnemy = e; }
    }

    if (closestEnemy) {
      const isDangerous = closestEnemy.type === ENTITY_TYPE.SPIDER || closestEnemy.type === ENTITY_TYPE.GOBLIN;
      
      if (hasSword && this.hp > 5 && !(isDangerous && this.hp <= 7)) { 
        this.setTarget(closestEnemy); 
        this.currentIntent = `¡Luchando contra ${closestEnemy.config.nameSingular}!`; 
        this.isFleeing = false; 
        return; 
      } else {
        this.isFleeing = true;
        const dx = this.x - closestEnemy.x; const dy = this.y - closestEnemy.y;
        this.dirX = dx / (Math.sqrt(dx*dx + dy*dy) || 1); this.dirY = dy / (Math.sqrt(dx*dx + dy*dy) || 1);
        this.currentIntent = `¡Huyendo de ${closestEnemy.config.nameSingular}!`; 
        return;
      }
    }

    if (this.isFleeing) { this.isFleeing = false; this.currentIntent = 'Creo que estoy a salvo...'; }

    // 1.2 Comer si tiene hambre
    if (this.hunger > 55 && this.inventory.hasItem('SLIME_GEL')) { this.openInventoryAndUse('SLIME_GEL', 'Comiendo gelatina'); this.hunger = Math.max(0, this.hunger - 20); return; }
    if (this.hunger > 55 && this.inventory.hasItem('MEAT')) { this.openInventoryAndUse('MEAT', 'Comiendo muslito'); this.hunger = Math.max(0, this.hunger - 50); return; }
    if (this.hunger > 55 && this.inventory.hasItem('APPLE')) { this.openInventoryAndUse('APPLE', 'Comiendo manzana'); this.hunger = Math.max(0, this.hunger - 45); return; }

    // 1.3 Refugio si tiene frío
    if (isNight && this.cold > 40) {
      const nearFire = this.entityManager ? this.entityManager.isNearCampfire(this.x + this.size / 2, this.y + this.size / 2, 80) : null;
      if (!nearFire && !this.inventory.hasItem('CAMPFIRE')) {
        // Si ya sabe hacer fogata (tiene los materiales), la hace
        if (this.inventory.countOf('WOOD') >= 2 && !isCraftOnCooldown('WOOD', 'WOOD')) {
          this.startCrafting('WOOD', 'WOOD', null, 2, 0);
          this.currentIntent = 'Voy a encender una fogata';
          return;
        }
        // Si no, busca madera
        const stick = this.findReachableEntity(ENTITY_TYPE.STICK_PICKUP, this.x + this.size / 2, this.y + this.size / 2, 200);
        if (stick) { this.setTarget(stick); this.currentIntent = 'Necesito leña para el frío'; return; }
      }
    }

    // ═══════════════════════════════════════════════════════
    // PRIORIDAD 2: PROGRESIÓN (DESCUBRIR Y CRAFTEAR)
    // ═══════════════════════════════════════════════════════

    // 2.1 Si no tiene herramientas, busca materiales para hacerlas
    if (!hasAxe || !hasPick || !hasSword) {
      
      // Piedra Afilada (Base para todo)
      if (this.inventory.countOf('STONE') >= 2 && !this.inventory.hasItem('SHARP_STONE')) {
        if (!isCraftOnCooldown('STONE', 'STONE')) {
          this.startCrafting('STONE', 'STONE', 'SHARP_STONE');
          this.currentIntent = 'Voy a afilar estas piedras...';
          return;
        }
      }

      // Hacha (para madera)
      if (!hasAxe && this.inventory.countOf('WOOD') >= 2 && this.inventory.countOf('SHARP_STONE') >= 1) {
        if (!isCraftOnCooldown('WOOD', 'SHARP_STONE')) {
          this.startCrafting('WOOD', 'SHARP_STONE', 'HACHA_TOSCA');
          this.currentIntent = 'Voy a fabricar un hacha...';
          return;
        }
      }

      // Pico (para piedra)
      if (!hasPick && this.inventory.countOf('WOOD') >= 2 && this.inventory.countOf('SHARP_STONE') >= 2) {
        if (!isCraftOnCooldown('WOOD', 'SHARP_STONE')) {
          this.startCrafting('WOOD', 'SHARP_STONE', 'PICO_TOSCO');
          this.currentIntent = 'Voy a fabricar un pico...';
          return;
        }
      }

      // Espada (para defensa)
      if (!hasSword && this.inventory.countOf('WOOD') >= 1 && this.inventory.countOf('SHARP_STONE') >= 2) {
        if (!isCraftOnCooldown('WOOD', 'SHARP_STONE')) {
          this.startCrafting('WOOD', 'SHARP_STONE', 'SWORD_BASIC');
          this.currentIntent = 'Voy a fabricar una espada...';
          return;
        }
      }

      // Si le faltan piedras, las busca
      if (this.inventory.countOf('STONE') < 2 && !this.inventory.hasItem('SHARP_STONE')) {
        const stone = this.findReachableEntity(ENTITY_TYPE.STONE_PICKUP, this.x + this.size / 2, this.y + this.size / 2, 200);
        if (stone) { this.setTarget(stone); this.currentIntent = 'Necesito piedra para avanzar'; return; }
      }

      // Si le falta madera, la busca
      if (this.inventory.countOf('WOOD') < 2) {
        const stick = this.findReachableEntity(ENTITY_TYPE.STICK_PICKUP, this.x + this.size / 2, this.y + this.size / 2, 200);
        if (stick) { this.setTarget(stick); this.currentIntent = 'Necesito madera para avanzar'; return; }
      }
    }

    // ═══════════════════════════════════════════════════════
    // PRIORIDAD 3: EXPERIMENTACIÓN (Descubrir cosas nuevas)
    // ═══════════════════════════════════════════════════════

    const uniqueItems = [];
    for (const s of this.inventory.slots) {
      if (s.itemId !== 'NONE' && s.count > 0) {
        const existing = uniqueItems.find(u => u.id === s.itemId);
        if (existing) existing.count += s.count;
        else uniqueItems.push({ id: s.itemId, count: s.count });
      }
    }

    let possibleCrafts = [];

    for (let i = 0; i < uniqueItems.length; i++) {
      const itemA = uniqueItems[i];
      
      if (itemA.count >= 2) {
        if (!isCraftOnCooldown(itemA.id, itemA.id) && !this.knowledge.failedCombination(itemA.id, itemA.id) && !this.knowledge.knowsCombination(itemA.id, itemA.id)) {
          possibleCrafts.push({ a: itemA.id, b: itemA.id, qtyA: 2, qtyB: 0 });
        }
      }

      for (let j = i + 1; j < uniqueItems.length; j++) {
        const itemB = uniqueItems[j];
        
        if (!isCraftOnCooldown(itemA.id, itemB.id) && !this.knowledge.failedCombination(itemA.id, itemB.id) && !this.knowledge.knowsCombination(itemA.id, itemB.id)) {
          possibleCrafts.push({ a: itemA.id, b: itemB.id, qtyA: 1, qtyB: 1 });
        }
        if (itemA.count >= 2 && !isCraftOnCooldown(itemA.id, itemB.id)) {
          possibleCrafts.push({ a: itemA.id, b: itemB.id, qtyA: 2, qtyB: 1 });
        }
        if (itemB.count >= 2 && !isCraftOnCooldown(itemA.id, itemB.id)) {
          possibleCrafts.push({ a: itemA.id, b: itemB.id, qtyA: 1, qtyB: 2 });
        }
        if (itemA.count >= 2 && itemB.count >= 2 && !isCraftOnCooldown(itemA.id, itemB.id)) {
          possibleCrafts.push({ a: itemA.id, b: itemB.id, qtyA: 2, qtyB: 2 });
        }
      }
    }

    if (possibleCrafts.length > 0) {
      const choice = possibleCrafts[Math.floor(Math.random() * possibleCrafts.length)];
      this.startCrafting(choice.a, choice.b, null, choice.qtyA, choice.qtyB);
      
      if (choice.a === choice.b) {
        this.currentIntent = `¿Qué pasará si junto ${choice.qtyA + choice.qtyB} ${ITEMS[choice.a].name}?`;
      } else {
        this.currentIntent = `¿Qué pasará si junto ${choice.qtyA} ${ITEMS[choice.a].name} y ${choice.qtyB} ${ITEMS[choice.b].name}?`;
      }
      return;
    }

    // ═══════════════════════════════════════════════════════
    // PRIORIDAD 4: TAREAS CON HERRAMIENTAS
    // ═══════════════════════════════════════════════════════

    const treeNearby = this.entityManager ? this.findReachableEntity('TREE', this.x + this.size / 2, this.y + this.size / 2, 100) : null;
    const rockNearby = this.entityManager ? this.findReachableEntity('ROCK', this.x + this.size / 2, this.y + this.size / 2, 100) : null;

    if (hasAxe && treeNearby && this.inventory.countOf('WOOD') < 20) { 
      this.setTarget(treeNearby); this.currentIntent = 'Voy a talar un árbol'; return; 
    }
    
    if (hasPick && rockNearby && this.inventory.countOf('STONE') < 20) { 
      this.setTarget(rockNearby); this.currentIntent = 'Voy a minar una piedra'; return; 
    }

    // ═══════════════════════════════════════════════════════
    // PRIORIDAD 5: EXPLORAR HACIA EL PORTAL
    // ═══════════════════════════════════════════════════════

    if (World.isHub) {
      if (!this.knownPortalPos && this.entityManager) {
        const p = this.entityManager.entities.find(e => e.type === ENTITY_TYPE.PORTAL);
        if (p) this.knownPortalPos = { x: p.x, y: p.y };
      }
      
      if (this.knownPortalPos) {
        this.currentIntent = 'Siento una presencia extraña...';
        const dx = this.knownPortalPos.x - this.x;
        const dy = this.knownPortalPos.y - this.y;
        if (Math.sqrt(dx*dx + dy*dy) > 30) {
           this.dirX = dx / (Math.sqrt(dx*dx + dy*dy) || 1);
           this.dirY = dy / (Math.sqrt(dx*dx + dy*dy) || 1);
        }
        return;
      }
    }

    // Si no hay nada más, deambula
    if (!this.target) {
       this.currentIntent = isNight ? 'Explorando de noche' : 'Explorando';
    }
  }

  placeCampfire() {
    if (!this.inventory || !this.entityManager || !this.inventory.removeOne('CAMPFIRE')) return;
    const cx = this.x + this.size / 2, cy = this.y + this.size / 2;
    let px = cx + 16, py = cy;
    const checkTile = (x, y) => { const t = this.world.getTile(Math.floor(x / TILE_SIZE), Math.floor(y / TILE_SIZE)); return t !== null && this.world.isWalkable(t); };
    if (!checkTile(px, py)) { px = cx - 16; py = cy; } if (!checkTile(px, py)) { px = cx; py = cy + 16; }
    if (!checkTile(px, py)) { px = cx; py = cy - 16; } if (!checkTile(px, py)) { px = cx; py = cy; }
    this.entityManager.placeCampfire(px, py);
    this.knowledge.successfulAttempt('colocar fogata en el suelo', { placed: 'CAMPFIRE' }); this.knowledge.learned('las fogatas se colocan en el suelo');
    this.currentIntent = 'Coloco una fogata'; this.inventoryOpen = 1.5; this.gainXp(2); this.fireCooldown = 20;
  }

  isEntityReachable(entity) {
    if (!entity) return false;
    if (this.entityCooldowns.has(entity)) return false;
    if (entity.type === ENTITY_TYPE.CAMPFIRE || entity.type === ENTITY_TYPE.PORTAL) return true;
    const tx = Math.floor(entity.x / TILE_SIZE), ty = Math.floor(entity.y / TILE_SIZE);
    const tile = this.entityManager.world.getTile(tx, ty);
    if (tile === null || !this.entityManager.world.isWalkable(tile)) return false;
    const playerH = this.entityManager.world.getHeightAt(this.x + this.size / 2, this.y + this.size / 2);
    const entityH = this.entityManager.world.getTileHeight(tx, ty);
    return Math.abs(entityH - playerH) <= ISO_H / 2;
  }

  findReachableEntity(type, px, py, radius) {
    let best = null, bestDist = radius;
    for (const e of this.entityManager.entities) {
      if (e.type !== type || !e.alive || e.harvested || !this.isEntityReachable(e)) continue;
      const d = e.distanceTo(px, py);
      if (d < bestDist) { bestDist = d; best = e; }
    }
    return best;
  }

  findReachableAny(px, py, radius) {
    let best = null, bestDist = radius;
    for (const e of this.entityManager.entities) {
      if (!e.alive || e.harvested || e.type === ENTITY_TYPE.CAMPFIRE || e.type === ENTITY_TYPE.SLIME || e.type === ENTITY_TYPE.PORTAL || !this.isEntityReachable(e)) continue;
      const d = e.distanceTo(px, py);
      if (d < bestDist) { bestDist = d; best = e; }
    }
    return best;
  }

  setTarget(entity) { this.target = entity; this.targetDuration = 8; this.stuckTimer = 0; }

  moveUpdate(dt, world) {
    if (this.isCrafting() || this.isChopping || this.isMining || this.hp <= 0) return;

    if (this.isFleeing) {
      const nx = this.x + this.dirX * this.speed * 1.5 * dt; const ny = this.y + this.dirY * this.speed * 1.5 * dt;
      if (this.canMoveTo(nx, this.y, world)) this.x = nx; if (this.canMoveTo(this.x, ny, world)) this.y = ny;
      this.clampToWorld(world); return;
    }

    if (this.target) {
      this.targetDuration -= dt;
      if (!this.target.alive || this.target.harvested || this.targetDuration <= 0) { this.target = null; return; }
      const playerCx = this.x + this.size / 2, playerCy = this.y + this.size / 2;
      const dist = this.target.distanceTo(playerCx, playerCy);
      if (dist < this.target.config.interactRadius) { this.tryInteractWith(this.target); this.target = null; return; }
      const dx = this.target.x - playerCx, dy = this.target.y - playerCy;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      this.dirX = dx / len; this.dirY = dy / len;
      const nx = this.x + this.dirX * this.speed * dt; const ny = this.y + this.dirY * this.speed * dt;
      if (this.canMoveTo(nx, this.y, world)) this.x = nx; if (this.canMoveTo(this.x, ny, world)) this.y = ny;
      this.clampToWorld(world); return;
    }

    if (World.isHub && this.knownPortalPos && !this.needThought) {
      const playerCx = this.x + this.size / 2, playerCy = this.y + this.size / 2;
      const distToPortal = Math.sqrt((this.knownPortalPos.x - playerCx)**2 + (this.knownPortalPos.y - playerCy)**2);
      
      if (distToPortal > 20) {
        const nx = this.x + this.dirX * this.speed * dt;
        const ny = this.y + this.dirY * this.speed * dt;
        if (this.canMoveTo(nx, this.y, world)) this.x = nx;
        else this.pickRandomDirection();
        
        if (this.canMoveTo(this.x, ny, world)) this.y = ny;
        else this.pickRandomDirection();
        
        this.clampToWorld(world);
        return;
      }
    }

    this.changeTimer -= dt;
    if (this.changeTimer <= 0) { this.pickRandomDirection(); this.changeTimer = 1 + Math.random() * 2.5; }
    const nx = this.x + this.dirX * this.speed * dt; const ny = this.y + this.dirY * this.speed * dt;
    if (this.canMoveTo(nx, this.y, world)) this.x = nx; else this.pickRandomDirection();
    if (this.canMoveTo(this.x, ny, world)) this.y = ny; else this.pickRandomDirection();
    this.clampToWorld(world);
  }

  clampToWorld(world) {
    const maxX = world.width * TILE_SIZE - this.size, maxY = world.height * TILE_SIZE - this.size;
    if (this.x < 0) { this.x = 0; this.dirX *= -1; } if (this.y < 0) { this.y = 0; this.dirY *= -1; }
    if (this.x > maxX) { this.x = maxX; this.dirX *= -1; } if (this.y > maxY) { this.y = maxY; this.dirY *= -1; }
  }

  tryInteractWith(entity) {
    if (!this.knowledge || entity.interactCooldown > 0) return;
    entity.interactCooldown = 1;

    if (entity.type === ENTITY_TYPE.PORTAL) {
      this.triggeredPortal = true;
      this.currentIntent = '¡Me teletransporto!';
      return;
    }

    if (entity.type === ENTITY_TYPE.CAMPFIRE) {
      this.currentIntent = 'Me caliento junto al fuego'; this.cold = 0; this.inventoryOpen = 0; return;
    }

    let toolId = null;
    if (this.inventory) {
      if (entity.type === ENTITY_TYPE.TREE) { if (this.inventory.hasItem('HACHA_TOSCA')) toolId = 'HACHA_TOSCA'; }
      else if (entity.type === ENTITY_TYPE.SLIME || entity.type === ENTITY_TYPE.SPIDER || entity.type === ENTITY_TYPE.GOBLIN || entity.type === ENTITY_TYPE.CHICKEN) { if (this.inventory.hasItem('SWORD_BASIC')) toolId = 'SWORD_BASIC'; }
      else if (entity.type === ENTITY_TYPE.ROCK) { if (this.inventory.hasItem('PICO_TOSCO')) toolId = 'PICO_TOSCO'; else if (this.inventory.hasItem('SWORD_BASIC')) toolId = 'SWORD_BASIC'; }
    }

    const result = entity.tryDestroy(toolId);

    if (result.success) {
      if (entity.type === ENTITY_TYPE.TREE) { this.startChop(entity); return; }
      if (entity.type === ENTITY_TYPE.ROCK && toolId === 'PICO_TOSCO') { this.startMine(entity); return; }
      
      for (const [itemId, qty] of Object.entries(result.drops)) this.inventory.addItem(itemId, qty);
      
      if (entity.type === ENTITY_TYPE.STICK_PICKUP) { this.currentIntent = '¡Una rama!'; this.gainXp(1); }
      else if (entity.type === ENTITY_TYPE.STONE_PICKUP) { this.currentIntent = '¡Una piedra!'; this.gainXp(1); }
      else if (entity.type === ENTITY_TYPE.CHICKEN) { this.currentIntent = '¡He conseguido un muslito!'; this.gainXp(3); }
      else if (entity.type === ENTITY_TYPE.SLIME) { this.currentIntent = '¡He derrotado al slime!'; this.gainXp(10); }
      else if (entity.type === ENTITY_TYPE.SPIDER) { this.currentIntent = '¡He derrotado a la araña!'; this.gainXp(15); }
      else if (entity.type === ENTITY_TYPE.GOBLIN) { this.currentIntent = '¡He derrotado al duende!'; this.gainXp(20); }
      else if (entity.type === ENTITY_TYPE.ROCK) { this.currentIntent = '¡He conseguido piedra!'; this.gainXp(2); }
      
      this.inventoryOpen = 1.5; return;
    }

    if (entity.type === ENTITY_TYPE.TREE) { 
      this.knowledge.touched('un árbol'); 
      this.knowledge.failedAttempt('talar un árbol con las manos'); 
      this.currentIntent = 'Necesito un hacha para el árbol'; 
      this.entityCooldowns.set(entity, 15);
      this.needThought = 'tree';
    }
    else if (entity.type === ENTITY_TYPE.ROCK) { 
      this.knowledge.touched('una piedra'); 
      this.currentIntent = 'Necesito un pico para la piedra'; 
      this.entityCooldowns.set(entity, 15);
      this.needThought = 'rock';
    }
    else if (entity.type === ENTITY_TYPE.SLIME || entity.type === ENTITY_TYPE.SPIDER || entity.type === ENTITY_TYPE.GOBLIN) { 
      this.currentIntent = '¡Necesito un arma!'; 
      this.entityCooldowns.set(entity, 15); 
    }
    else if (entity.type === ENTITY_TYPE.CHICKEN) { this.knowledge.touched('un pollo'); this.currentIntent = 'El pollo escapa... necesito algo afilado'; }
    
    this.inventoryOpen = 1.5;
  }

  learnFromCurrentTile(world) {
    if (!this.knowledge) return;
    const cx = this.x + this.size / 2, cy = this.y + this.size / 2;
    const tx = Math.floor(cx / TILE_SIZE), ty = Math.floor(cy / TILE_SIZE);
    const tile = world.getTile(tx, ty);
    if (tile === null) return;
    if (!this.seenTileTypes.has(tile)) { this.seenTileTypes.add(tile); this.knowledge.saw(`un terreno de ${this.tileNames[tile] || 'algo desconocido'}`); }
  }

  seeEntities() {
    if (!this.knowledge || !this.entityManager) return;
    const cx = this.x + this.size / 2, cy = this.y + this.size / 2;
    for (const e of this.entityManager.entities) {
      if (!e.alive || e.harvested || e.distanceTo(cx, cy) > 60) continue;
      if (!this.seenEntityTypes.has(e.type)) {
        this.seenEntityTypes.add(e.type);
        this.knowledge.saw(e.config.nameSingular);
        if (e.type === ENTITY_TYPE.CHICKEN) this.hasSeenChicken = true;
      }
    }
  }

  openInventoryAndUse(itemId, intentText) {
    if (!this.inventory) return;
    this.inventory.isOpen = true; this.inventory.selectSlotOf(itemId);
    this.inventory.removeOne(itemId); this.inventoryOpen = 1.8 + Math.random() * 1.2; this.currentIntent = intentText;
  }

  gainXp(amount) { this.xp += amount; }

  isBlockedByEntity(px, py) {
    if (!this.entityManager) return false;
    const pLeft = px, pRight = px + this.size; const pTop = py, pBottom = py + this.size;

    for (const e of this.entityManager.entities) {
      if (e.type === ENTITY_TYPE.STICK_PICKUP || e.type === ENTITY_TYPE.STONE_PICKUP || e.type === ENTITY_TYPE.CHICKEN || e.type === ENTITY_TYPE.SLIME || e.type === ENTITY_TYPE.PORTAL) continue;
      if (!e.alive || e.harvested) continue;

      let eLeft, eRight, eTop, eBottom;
      if (e.type === ENTITY_TYPE.TREE) { const treeWidth = 16; eLeft = e.x - treeWidth / 2; eRight = e.x + treeWidth / 2; eTop = e.y - treeWidth / 2; eBottom = e.y + treeWidth / 2; }
      else { const hitboxSize = e.config.size || 12; eLeft = e.x; eRight = e.x + hitboxSize; eTop = e.y; eBottom = e.y + hitboxSize; }
      if (pLeft < eRight && pRight > eLeft && pTop < eBottom && pBottom > eTop) return true;
    }
    return false;
  }

  canMoveTo(px, py, world) {
    const margin = 1.5;
    const points = [ [px + margin, py + margin], [px + this.size - margin, py + margin], [px + margin, py + this.size - margin], [px + this.size - margin, py + this.size - margin] ];
    const currentHeight = world.getHeightAt(this.x + this.size / 2, this.y + this.size / 2);

    for (const [cx, cy] of points) {
      const tx = Math.floor(cx / TILE_SIZE), ty = Math.floor(cy / TILE_SIZE);
      const tile = world.getTile(tx, ty);
      if (tile === null || !world.isWalkable(tile)) return false;
      const targetHeight = world.getTileHeight(tx, ty);
      const diff = targetHeight - currentHeight;
      const maxStep = ISO_H / 2;
      if (diff > maxStep) return false; if (diff < -maxStep) return false;
    }
    if (this.isBlockedByEntity(px, py)) return false;
    return true;
  }

  pickRandomDirection() { const angle = Math.random() * Math.PI * 2; this.dirX = Math.cos(angle); this.dirY = Math.sin(angle); }
  draw(ctx, camera) {}
}