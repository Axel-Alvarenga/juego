const RENDER_W = 480;
const RENDER_H = 270;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

canvas.width  = RENDER_W;
canvas.height = RENDER_H;
// Debe ir DESPUÉS de fijar el tamaño: asignar width reinicia el contexto
ctx.imageSmoothingEnabled = false;

let world;
let entityManager;
let camera = { x: 0, y: 0, viewW: RENDER_W, viewH: RENDER_H };
const particles = [];

const player = new Player(0, 0); 
const knowledge = new Knowledge();
knowledge.attachClock(() => world.getClock());
const journal = new Journal(knowledge);
const inventory = new Inventory(10);
const craftPanel = new CraftPanel();
const debugPanel = new DebugPanel();

player.attachKnowledge(knowledge);
player.attachInventory(inventory);
player.attachCraftPanel(craftPanel);

function reloadWorld(isHub) {
  World.isHub = isHub;
  world = new World(200, 200);
  entityManager = new EntityManager(world);
  player.attachEntities(entityManager);
  player.attachWorld(world);

  const spawn = world.findSpawnTile();
  player.x = spawn.x * TILE_SIZE + (TILE_SIZE - 12) / 2;
  player.y = spawn.y * TILE_SIZE + (TILE_SIZE - 12) / 2;
  player.heightPx = world.getHeightAt(player.x + 6, player.y + 6);
  
  player.target = null; player.targetDuration = 0;
  player.isChopping = false; player.chopTarget = null;
  player.isMining = false; player.mineTarget = null;
  player.abortCraft();
  player.knownPortalPos = null;
  player.entityCooldowns.clear();
  particles.length = 0;
  player.currentIntent = isHub ? '¡Un mundo tranquilo!' : '¿Dónde estoy?';
  player.triggeredPortal = false;

  const worldTileX = (player.x + player.size / 2) / TILE_SIZE;
  const worldTileY = (player.y + player.size / 2) / TILE_SIZE;
  const iso = isoToScreen(worldTileX, worldTileY);
  camera.x = Math.floor(iso.px - camera.viewW / 2);
  camera.y = Math.floor(iso.py - camera.viewH / 2 - player.heightPx);
}

reloadWorld(true);

window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if (key === 'l') { journal.toggle(); e.preventDefault(); }
  else if (key === 'd') { debugPanel.toggle(); e.preventDefault(); }
  else if (key === 'r') { reloadWorld(true); e.preventDefault(); }
});

window.addEventListener('wheel', (e) => {
  if (journal.isOpen) { journal.onWheel(e.deltaY); e.preventDefault(); }
}, { passive: false });

function updateCamera() {
  camera.viewW = canvas.width; camera.viewH = canvas.height;
  const worldTileX = (player.x + player.size / 2) / TILE_SIZE;
  const worldTileY = (player.y + player.size / 2) / TILE_SIZE;
  const iso = isoToScreen(worldTileX, worldTileY);
  camera.x = Math.floor(iso.px - camera.viewW / 2);
  camera.y = Math.floor(iso.py - camera.viewH / 2 - player.heightPx);
}

function spawnFireParticles(dt, em) {
  for (const e of em.entities) {
    if (e.type !== ENTITY_TYPE.CAMPFIRE) continue;
    if (Math.random() < dt * 15) {
      particles.push({ type: 'fire', x: e.x, y: e.y, vx: (Math.random() - 0.5) * 10, vy: -15 - Math.random() * 15, life: 0.8 + Math.random() * 0.5, maxLife: 1.3, color: Math.random() > 0.5 ? '#ffaa3a' : '#ff5a2a' });
    }
  }
}

function spawnSnowParticles(dt, world, camera) {
  const isNight = world.getDaylight() < 0.3;
  if (Math.random() < dt * 20) {
    const rx = camera.x + Math.random() * camera.viewW; const ry = camera.y + Math.random() * camera.viewH;
    const tx = Math.floor(screenToIso(rx, ry).x); const ty = Math.floor(screenToIso(rx, ry).y);
    const tile = world.getTile(tx, ty);
    if (tile === TILE.SNOW || tile === TILE.TUNDRA || (isNight && Math.random() < 0.1)) {
      particles.push({ type: 'snow', x: rx, y: ry - 50, screenX: true, vx: -5 + Math.random() * 10, vy: 20 + Math.random() * 20, life: 2.0, maxLife: 2.0, color: '#ffffff' });
    }
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt; if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.type === 'fire') p.vy -= 5 * dt;
  }
}

function drawParticles(ctx, camera, daylight) {
  for (const p of particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    let px, py;
    if (p.screenX) { px = p.x - camera.x; py = p.y - camera.y; }
    else { const iso = isoToScreen(p.x / TILE_SIZE, p.y / TILE_SIZE); px = Math.floor(iso.px - camera.x); py = Math.floor(iso.py - camera.y); }
    ctx.globalAlpha = alpha * (daylight < 0.5 ? 1 : 0.5); ctx.fillStyle = p.color; ctx.fillRect(Math.floor(px), Math.floor(py), 1, 1);
  }
  ctx.globalAlpha = 1;
}

let lastTime = performance.now();

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.1); lastTime = now;

  world.advanceClock(dt);
  player.update(dt, world);
  entityManager.update(dt, player);
  updateCamera();

  if (player.triggeredPortal) reloadWorld(false);

  spawnFireParticles(dt, entityManager);
  spawnSnowParticles(dt, world, camera);
  updateParticles(dt);

  ctx.fillStyle = '#0b1220'; ctx.fillRect(0, 0, canvas.width, canvas.height);

  world.draw(ctx, camera);
  drawProps(ctx, camera, world.props);
  drawEntities(ctx, camera, entityManager);
  drawPlayerIso(ctx, camera);

  const daylight = world.getDaylight();
  drawParticles(ctx, camera, daylight);
  drawDayNightTint(ctx);
  drawCampfireLights(ctx);

  inventory.draw(ctx, canvas.width, canvas.height);
  drawStatusHUD(ctx);
  drawClockHUD(ctx);
  craftPanel.draw(ctx);
  debugPanel.draw(ctx, player, inventory);
  journal.draw(ctx);

  if (player.damageFlash > 0) { ctx.fillStyle = `rgba(255, 0, 0, ${player.damageFlash * 0.3})`; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  if (player.hp <= 0) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const text = "TE HAS DESMAYADO"; const textW = measurePixelText(text);
    drawPixelText(ctx, text, (canvas.width - textW) / 2, canvas.height / 2, '#ff4d4d');
  }

  requestAnimationFrame(loop);
}

function drawProps(ctx, camera, props) {
  const camX = Math.floor(camera.x), camY = Math.floor(camera.y);
  for (const prop of props) {
    const iso = isoToScreen(prop.tx, prop.ty);
    const px = Math.floor(iso.px - camX); const py = Math.floor(iso.py - camY) + 8;
    if (px < -20 || px > camera.viewW + 20 || py < -20 || py > camera.viewH + 20) continue;
    const heightPx = world.getHeightAt(prop.tx * TILE_SIZE + 8, prop.ty * TILE_SIZE + 8);
    if (prop.type === 'dry_tree') { ctx.fillStyle = '#4a3b2a'; ctx.fillRect(px - 1, py - heightPx - 8, 2, 8); ctx.fillRect(px - 3, py - heightPx - 6, 2, 1); ctx.fillRect(px + 1, py - heightPx - 5, 2, 1); }
    if (prop.type === 'dead_bush') { ctx.fillStyle = '#6b5a3a'; ctx.fillRect(px - 2, py - heightPx - 2, 4, 2); ctx.fillStyle = '#8a7a5a'; ctx.fillRect(px - 1, py - heightPx - 3, 1, 1); ctx.fillRect(px + 1, py - heightPx - 1, 1, 2); }
    if (prop.type === 'rock_small') { ctx.fillStyle = '#666666'; ctx.fillRect(px - 2, py - heightPx - 2, 4, 2); ctx.fillStyle = '#888888'; ctx.fillRect(px - 1, py - heightPx - 2, 2, 1); }
    if (prop.type === 'flowers') { ctx.fillStyle = '#4a8f3c'; ctx.fillRect(px, py - heightPx - 2, 1, 2); ctx.fillStyle = '#ffdd55'; ctx.fillRect(px - 1, py - heightPx - 3, 2, 2); }
  }
}

function drawDayNightTint(ctx) {
  const daylight = world.getDaylight();
  if (daylight >= 0.99) return;
  let color, alpha;
  if (daylight >= 0.5) { color = '#ff7a3a'; alpha = (1 - daylight) * 0.35; }
  else { color = '#0a1a3a'; alpha = (1 - daylight) * 0.7; }
  ctx.fillStyle = color; ctx.globalAlpha = alpha; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.globalAlpha = 1;
}

function drawCampfireLights(ctx) {
  const daylight = world.getDaylight();
  if (daylight >= 0.6) return;
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (const e of entityManager.entities) {
    if (e.type !== ENTITY_TYPE.CAMPFIRE && e.type !== ENTITY_TYPE.PORTAL) continue;
    const iso = isoToScreen((e.x + e.config.size/2) / TILE_SIZE, (e.y + e.config.size/2) / TILE_SIZE);
    const px = Math.floor(iso.px - camera.x); const py = Math.floor(iso.py - camera.y) + 8 - e.heightPx;
    if (px < -100 || px > camera.viewW + 100 || py < -100 || py > camera.viewH + 100) continue;
    const t = e.flickerPhase;
    const flicker = Math.sin(t) * 0.5 + Math.sin(t * 2.3) * 0.25 + Math.sin(t * 5.1) * 0.15 + Math.sin(t * 8.7) * 0.1;
    const isPortal = e.type === ENTITY_TYPE.PORTAL;
    const baseRadius = e.config.lightRadius;
    const radiusX = (baseRadius + flicker * 6) * 1.4; const radiusY = (baseRadius + flicker * 4) * 0.7;
    const alphaBase = 0.45 + flicker * 0.15;
    ctx.save(); ctx.translate(px, py); ctx.scale(1, radiusY / radiusX);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radiusX);
    if (isPortal) {
      grad.addColorStop(0.0, `rgba(200, 100, 255, ${alphaBase})`);
      grad.addColorStop(0.3, `rgba(140, 60, 200, ${alphaBase * 0.7})`);
      grad.addColorStop(0.7, `rgba(80, 20, 120, ${alphaBase * 0.2})`);
      grad.addColorStop(1.0, 'rgba(40, 0, 60, 0)');
    } else {
      grad.addColorStop(0.0, `rgba(255, 240, 180, ${alphaBase})`);
      grad.addColorStop(0.3, `rgba(255, 160, 60, ${alphaBase * 0.7})`);
      grad.addColorStop(0.7, `rgba(200, 60, 20, ${alphaBase * 0.2})`);
      grad.addColorStop(1.0, 'rgba(100, 20, 0, 0)');
    }
    ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(0, 0, radiusX, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  ctx.restore();
}

function drawClockHUD(ctx) {
  const clock = world.getClock(); const dayText = `Dia ${clock.day}`;
  const hh = String(clock.hour).padStart(2, '0'), mm = String(clock.minute).padStart(2, '0');
  const timeText = `${hh}:${mm}`;
  const innerW = Math.max(measurePixelText(dayText), measurePixelText(timeText)) + 8;
  const panelW = innerW, panelH = 22; const px = canvas.width - panelW - 4, py = 4;
  ctx.fillStyle = 'rgba(20, 20, 30, 0.85)'; ctx.fillRect(px, py, panelW, panelH);
  ctx.strokeStyle = '#4a4a63'; ctx.lineWidth = 1; ctx.strokeRect(px + 0.5, py + 0.5, panelW - 1, panelH - 1);
  drawPixelText(ctx, dayText, px + 4, py + 3, '#c8b88a'); drawPixelText(ctx, timeText, px + 4, py + 11, '#ffffff');
}

function drawEntities(ctx, camera, em) {
  const camX = Math.floor(camera.x), camY = Math.floor(camera.y);
  const visible = [];
  for (const e of em.entities) {
    if (!e.alive || e.harvested) continue;
    const iso = isoToScreen((e.x + e.config.size/2) / TILE_SIZE, (e.y + e.config.size/2) / TILE_SIZE);
    const px = Math.floor(iso.px - camX); const py = Math.floor(iso.py - camY) + 8 - e.heightPx;
    if (px < -40 || px > camera.viewW + 40 || py < -40 || py > camera.viewH + 40) continue;
    visible.push({ e, px, py, sortKey: e.x + e.y });
  }
  visible.sort((a, b) => a.sortKey - b.sortKey);
  for (const { e, px, py } of visible) { 
    drawEntity(ctx, e, px, py); 
    if (player.isChopping && player.chopTarget === e) drawActionProgress(ctx, px, py, player.chopTimer, player.chopDuration);
    else if (player.isMining && player.mineTarget === e) drawActionProgress(ctx, px, py, player.mineTimer, player.mineDuration);
  }
}

function drawActionProgress(ctx, px, py, currentTimer, maxDuration) {
  const barW = 24, barH = 4; const bx = px - barW / 2; const by = py - 40;
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);
  const pct = Math.min(1, currentTimer / maxDuration);
  ctx.fillStyle = '#ffd84a'; ctx.fillRect(bx, by, barW * pct, barH);
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.strokeRect(bx + 0.5, by + 0.5, barW - 1, barH - 1);
}

function drawIsoCube(ctx, x, y, w, h, colorTop, colorLeft, colorRight) {
  const halfW = w / 2; const halfH = w / 4; 
  ctx.fillStyle = colorLeft; ctx.beginPath(); ctx.moveTo(x - halfW, y); ctx.lineTo(x, y + halfH); ctx.lineTo(x, y + halfH + h); ctx.lineTo(x - halfW, y + h); ctx.closePath(); ctx.fill();
  ctx.fillStyle = colorRight; ctx.beginPath(); ctx.moveTo(x, y + halfH); ctx.lineTo(x + halfW, y); ctx.lineTo(x + halfW, y + h); ctx.lineTo(x, y + halfH + h); ctx.closePath(); ctx.fill();
  ctx.fillStyle = colorTop; ctx.beginPath(); ctx.moveTo(x, y - halfH); ctx.lineTo(x + halfW, y); ctx.lineTo(x, y + halfH); ctx.lineTo(x - halfW, y); ctx.closePath(); ctx.fill();
}

function drawVoxelTree(ctx, px, py) {
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(px, py, 14, 7, 0, 0, Math.PI * 2); ctx.fill();
  drawIsoCube(ctx, px, py - 4, 8, 12, '#e57399', '#b34d73', '#8a3654');
  drawIsoCube(ctx, px, py - 20, 24, 10, '#7bd64b', '#5bb52d', '#3d8c19');
  drawIsoCube(ctx, px, py - 28, 16, 8, '#7bd64b', '#5bb52d', '#3d8c19');
  drawIsoCube(ctx, px, py - 34, 10, 6, '#7bd64b', '#5bb52d', '#3d8c19');
}

function drawEntity(ctx, e, px, py) {
  if (e.type !== ENTITY_TYPE.TREE && e.type !== ENTITY_TYPE.PORTAL) {
    const shadowY = py; const shadowSize = e.config.shadowSize || 4;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(px, shadowY, shadowSize, shadowSize * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  }
  if (e.type === ENTITY_TYPE.STICK_PICKUP) { ctx.fillStyle = '#8b5a2b'; ctx.fillRect(px - 3, py - 1, 6, 1); }
  if (e.type === ENTITY_TYPE.STONE_PICKUP) { ctx.fillStyle = '#888888'; ctx.fillRect(px - 2, py - 2, 4, 3); }
  if (e.type === ENTITY_TYPE.CHICKEN) {
    ctx.fillStyle = '#ffa940'; ctx.fillRect(px - 3, py - 3, 1, 3); ctx.fillRect(px + 2, py - 3, 1, 3);
    ctx.fillStyle = '#f0f0f0'; ctx.fillRect(px - 4, py - 8, 8, 5); ctx.fillStyle = '#ffffff'; ctx.fillRect(px + 3, py - 12, 4, 4);
    ctx.fillStyle = '#ffa940'; ctx.fillRect(px + 7, py - 11, 1, 1); ctx.fillStyle = '#d33b3b'; ctx.fillRect(px + 3, py - 13, 2, 1);
    ctx.fillStyle = '#000000'; ctx.fillRect(px + 4, py - 11, 1, 1);
  }
  if (e.type === ENTITY_TYPE.TREE) { drawVoxelTree(ctx, px, py); }
  if (e.type === ENTITY_TYPE.ROCK) {
    ctx.fillStyle = '#888888'; ctx.fillRect(px - 6, py - 6, 12, 6); ctx.fillRect(px - 4, py - 9, 8, 4);
    ctx.fillStyle = '#aaaaaa'; ctx.fillRect(px - 4, py - 8, 4, 1);
  }
  
  // ⚠️ ANIMACIÓN DE ATAQUE
  const attackOffset = e.attackAnimTimer > 0 ? 3 : 0;
  const attackDirection = e.attackAnimTimer > 0 ? Math.atan2(player.y - e.y, player.x - e.x) : 0;
  const attackX = Math.cos(attackDirection) * attackOffset;
  const attackY = Math.sin(attackDirection) * attackOffset;

  if (e.type === ENTITY_TYPE.SLIME) {
    const jump = Math.abs(Math.sin(e.jumpPhase)) * 4; const bodyY = py - 5 - jump - attackY;
    const bodyX = px + attackX;
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(px, py, 5 - jump * 0.2, 2 - jump * 0.1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7bd64b'; ctx.fillRect(bodyX - 4, bodyY - 2, 8, 6); ctx.fillStyle = '#5bb52d'; ctx.fillRect(bodyX - 4, bodyY + 2, 8, 2); 
    ctx.fillStyle = '#ffffff'; ctx.fillRect(bodyX - 2, bodyY, 2, 2); ctx.fillRect(bodyX + 1, bodyY, 2, 2); 
    ctx.fillStyle = '#000000'; ctx.fillRect(bodyX - 2, bodyY + 1, 1, 1); ctx.fillRect(bodyX + 1, bodyY + 1, 1, 1); 
  }
  if (e.type === ENTITY_TYPE.SPIDER) {
    const bodyX = px + attackX;
    const bodyY = py + attackY;
    ctx.fillStyle = '#3a3a3a'; ctx.fillRect(bodyX - 4, bodyY - 4, 8, 4);
    ctx.fillStyle = '#1e1e1e'; ctx.fillRect(bodyX - 3, bodyY - 6, 6, 3);
    // Patas
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(bodyX - 6, bodyY - 2, 2, 1); ctx.fillRect(bodyX + 4, bodyY - 2, 2, 1);
    ctx.fillRect(bodyX - 6, bodyY, 2, 1);     ctx.fillRect(bodyX + 4, bodyY, 2, 1);
    ctx.fillRect(bodyX - 5, bodyY + 2, 2, 1); ctx.fillRect(bodyX + 3, bodyY + 2, 2, 1);
    // Ojos rojos
    ctx.fillStyle = '#ff4d4d'; ctx.fillRect(bodyX - 2, bodyY - 5, 1, 1); ctx.fillRect(bodyX + 1, bodyY - 5, 1, 1);
  }
  if (e.type === ENTITY_TYPE.GOBLIN) {
    const bodyX = px + attackX;
    const bodyY = py + attackY;
    ctx.fillStyle = '#4a8f3c'; ctx.fillRect(bodyX - 3, bodyY - 8, 6, 6); // Cuerpo
    ctx.fillStyle = '#3a7231'; ctx.fillRect(bodyX - 3, bodyY - 3, 6, 3); // Piernas
    ctx.fillStyle = '#4a8f3c'; ctx.fillRect(bodyX - 4, bodyY - 12, 8, 5); // Cabeza
    // Orejas puntiagudas
    ctx.fillStyle = '#3a7231'; ctx.fillRect(bodyX - 5, bodyY - 11, 1, 2); ctx.fillRect(bodyX + 4, bodyY - 11, 1, 2);
    // Ojos
    ctx.fillStyle = '#ff4d4d'; ctx.fillRect(bodyX - 2, bodyY - 10, 1, 1); ctx.fillRect(bodyX + 1, bodyY - 10, 1, 1);
  }
  
  if (e.type === ENTITY_TYPE.CAMPFIRE) {
    ctx.fillStyle = '#5c3a1a'; ctx.fillRect(px - 5, py - 2, 10, 2);
    const flicker = Math.sin(e.flickerPhase) * 1.5;
    ctx.fillStyle = '#ff5a2a'; ctx.fillRect(px - 3, py - 8 + flicker * 0.2, 6, 6);
    ctx.fillStyle = '#ffaa3a'; ctx.fillRect(px - 2, py - 9 + flicker * 0.3, 4, 5);
  }
  if (e.type === ENTITY_TYPE.PORTAL) {
    ctx.fillStyle = '#2a1a3a'; ctx.fillRect(px - 8, py - 14, 16, 14);
    const glow = Math.sin(e.flickerPhase) * 0.5 + 0.5;
    ctx.fillStyle = `rgba(200, 100, 255, ${0.5 + glow * 0.5})`; 
    ctx.beginPath(); ctx.ellipse(px, py - 7, 5, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff'; 
    ctx.beginPath(); ctx.ellipse(px, py - 7, 2, 3, 0, 0, Math.PI * 2); ctx.fill();
  }
}

function drawPlayerIso(ctx, camera) {
  if (player.hp <= 0) return;
  const camX = Math.floor(camera.x), camY = Math.floor(camera.y);
  const tx = (player.x + player.size / 2) / TILE_SIZE; const ty = (player.y + player.size / 2) / TILE_SIZE;
  const iso = isoToScreen(tx, ty);
  const groundPx = Math.floor(iso.px - camX); const groundPy = Math.floor(iso.py - camY) + 8 - player.heightPx;
  
  let shakeX = 0;
  if (player.isChopping) shakeX = Math.sin(player.chopTimer * 30) * 2;
  if (player.isMining) shakeX = Math.sin(player.mineTimer * 30) * 2;

  const isMoving = Math.abs(player.dirX) > 0.1 || Math.abs(player.dirY) > 0.1;
  const bob = isMoving ? Math.abs(Math.sin(player.walkAnim)) * 2 : Math.sin(player.walkAnim * 0.5) * 0.5;
  const px = groundPx + shakeX; const py = Math.floor(groundPy - bob);

  const isFlashing = player.damageFlash > 0 && Math.floor(player.damageFlash * 20) % 2 === 0;

  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(groundPx, groundPy + 1, 6 - bob * 0.5, 3 - bob * 0.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = isFlashing ? '#ff4d4d' : '#6b4c2a'; ctx.fillRect(px - 4, py - 10, 3, 5);
  ctx.fillStyle = isFlashing ? '#ff4d4d' : '#3a3a5c';
  if (isMoving) {
    const legOffset = Math.sin(player.walkAnim) * 1.5;
    ctx.fillRect(px - 3, py - 4 + legOffset, 2, 3); ctx.fillRect(px + 1, py - 4 - legOffset, 2, 3);
  } else {
    ctx.fillRect(px - 3, py - 3, 2, 3); ctx.fillRect(px + 1, py - 3, 2, 3);
  }

  const torsoColor = isFlashing ? '#ffffff' : '#e94b4b'; const torsoDark = isFlashing ? '#ffdddd' : '#b83232'; const torsoShadow = isFlashing ? '#ffaaaa' : '#8a2020';
  ctx.fillStyle = torsoColor; ctx.beginPath(); ctx.moveTo(px, py - 12); ctx.lineTo(px + 4, py - 9); ctx.lineTo(px, py - 6); ctx.lineTo(px - 4, py - 9); ctx.closePath(); ctx.fill();
  ctx.fillStyle = torsoDark; ctx.beginPath(); ctx.moveTo(px - 4, py - 9); ctx.lineTo(px, py - 6); ctx.lineTo(px, py - 3); ctx.lineTo(px - 4, py - 6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = torsoShadow; ctx.beginPath(); ctx.moveTo(px, py - 6); ctx.lineTo(px + 4, py - 9); ctx.lineTo(px + 4, py - 6); ctx.lineTo(px, py - 3); ctx.closePath(); ctx.fill();
  
  ctx.fillStyle = isFlashing ? '#ffcccc' : '#ffcf9e'; ctx.fillRect(px - 3, py - 17, 6, 5);
  ctx.fillStyle = isFlashing ? '#ff9999' : '#3d2314'; ctx.fillRect(px - 3, py - 18, 6, 2);
  
  ctx.fillStyle = '#000000';
  if (Math.abs(player.dirY) > Math.abs(player.dirX)) {
    if (player.dirY < 0) ctx.fillRect(px - 2, py - 15, 4, 1);
    else { ctx.fillRect(px - 2, py - 15, 1, 1); ctx.fillRect(px + 1, py - 15, 1, 1); }
  } else {
    if (player.dirX < 0) ctx.fillRect(px - 2, py - 15, 1, 1);
    else ctx.fillRect(px + 1, py - 15, 1, 1);
  }

  if (player.currentIntent) {
    const text = player.currentIntent; const textW = measurePixelText(text);
    const bubbleW = textW + 6, bubbleH = PIXEL_GLYPH_H + 4;
    const bx = Math.floor(px - bubbleW / 2), by = Math.floor(py - 26 - bubbleH);
    ctx.fillStyle = 'rgba(20, 20, 30, 0.9)'; ctx.fillRect(bx, by, bubbleW, bubbleH);
    ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 1; ctx.strokeRect(bx + 0.5, by + 0.5, bubbleW - 1, bubbleH - 1);
    drawPixelText(ctx, text, bx + 3, by + 2, '#ffffff');
  }
}

function drawStatusHUD(ctx) {
  const px = 4, py = 4, pw = 120, ph = 90;
  ctx.fillStyle = 'rgba(20, 20, 30, 0.85)'; ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = '#4a4a63'; ctx.lineWidth = 1; ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
  let rowY = py + 4;
  drawIconHeart(ctx, px + 4, rowY); drawPixelText(ctx, 'Vida', px + 14, rowY, '#ffffff');
  const hpText = `${player.hp}/${player.hpMax}`;
  drawPixelText(ctx, hpText, px + pw - 5 - measurePixelText(hpText), rowY, '#ff6b6b'); rowY += 11;
  drawIconStar(ctx, px + 4, rowY); drawPixelText(ctx, 'Exp', px + 14, rowY, '#ffffff');
  const xpText = player.xp.toFixed(1);
  drawPixelText(ctx, xpText, px + pw - 5 - measurePixelText(xpText), rowY, '#ffd84a'); rowY += 13;
  drawIconApple(ctx, px + 4, rowY); drawPixelText(ctx, 'Hambre', px + 14, rowY, '#ffffff');
  drawBar(ctx, px + 14, rowY + 10, pw - 18, 3, player.hunger, '#d33b3b'); rowY += 14;
  drawIconBolt(ctx, px + 4, rowY); drawPixelText(ctx, 'Energia', px + 14, rowY, '#ffffff');
  drawBar(ctx, px + 14, rowY + 10, pw - 18, 3, player.energy, '#4a8fd6'); rowY += 14;
  drawIconEye(ctx, px + 4, rowY); drawPixelText(ctx, 'Curiosidad', px + 14, rowY, '#ffffff');
  drawBar(ctx, px + 14, rowY + 10, pw - 18, 3, player.curiosity, '#e2b93c'); rowY += 14;
  if (player.cold > 0.5 || world.getDaylight() < 0.5) {
    drawIconSnow(ctx, px + 4, rowY); drawPixelText(ctx, 'Frio', px + 14, rowY, '#ffffff');
    drawBar(ctx, px + 14, rowY + 10, pw - 18, 3, player.cold, '#8ad2ff');
  }
}

function drawBar(ctx, x, y, w, h, value, color) {
  ctx.fillStyle = '#1a1a24'; ctx.fillRect(x, y, w, h);
  const v = Math.max(0, Math.min(100, value));
  ctx.fillStyle = color; ctx.fillRect(x, y, Math.floor(w * v / 100), h);
  ctx.strokeStyle = '#3a3a4d'; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function drawIconHeart(ctx, x, y) { ctx.fillStyle = '#ff4d4d'; ctx.fillRect(x + 1, y + 2, 2, 2); ctx.fillRect(x + 4, y + 2, 2, 2); ctx.fillRect(x, y + 3, 7, 2); ctx.fillRect(x + 1, y + 5, 5, 1); ctx.fillRect(x + 2, y + 6, 3, 1); }
function drawIconStar(ctx, x, y) { ctx.fillStyle = '#ffd84a'; ctx.fillRect(x + 3, y, 1, 1); ctx.fillRect(x + 2, y + 1, 3, 1); ctx.fillRect(x, y + 2, 7, 1); ctx.fillRect(x + 1, y + 3, 5, 1); ctx.fillRect(x + 1, y + 4, 2, 1); ctx.fillRect(x + 4, y + 4, 2, 1); ctx.fillRect(x, y + 5, 2, 1); ctx.fillRect(x + 5, y + 5, 2, 1); }
function drawIconApple(ctx, x, y) { ctx.fillStyle = '#4a8f3c'; ctx.fillRect(x + 3, y + 1, 1, 1); ctx.fillStyle = '#d33b3b'; ctx.fillRect(x + 1, y + 2, 4, 1); ctx.fillRect(x, y + 3, 6, 3); ctx.fillRect(x + 1, y + 6, 4, 1); }
function drawIconBolt(ctx, x, y) { ctx.fillStyle = '#ffe066'; ctx.fillRect(x + 2, y + 1, 2, 2); ctx.fillRect(x + 1, y + 3, 2, 2); ctx.fillRect(x + 2, y + 4, 2, 2); ctx.fillRect(x + 1, y + 6, 1, 2); }
function drawIconEye(ctx, x, y) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 2, y + 1, 3, 1); ctx.fillRect(x + 1, y + 2, 5, 1); ctx.fillRect(x, y + 3, 7, 1); ctx.fillRect(x + 1, y + 4, 5, 1); ctx.fillRect(x + 2, y + 5, 3, 1); ctx.fillStyle = '#4a8fd6'; ctx.fillRect(x + 3, y + 3, 1, 1); }
function drawIconSnow(ctx, x, y) { ctx.fillStyle = '#8ad2ff'; ctx.fillRect(x + 3, y, 1, 7); ctx.fillRect(x, y + 3, 7, 1); ctx.fillRect(x + 1, y + 1, 1, 1); ctx.fillRect(x + 5, y + 1, 1, 1); ctx.fillRect(x + 1, y + 5, 1, 1); ctx.fillRect(x + 5, y + 5, 1, 1); }

requestAnimationFrame(loop);