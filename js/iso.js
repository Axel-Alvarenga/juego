const ISO_W = 32;
const ISO_H = 16;

const SPRITE_PAD_TOP = 100;
const SPRITE_PAD_BOTTOM = 120;
const SPRITE_W = ISO_W;
const SPRITE_H = ISO_H + SPRITE_PAD_TOP + SPRITE_PAD_BOTTOM;

function isoToScreen(x, y) { return { px: (x - y) * (ISO_W / 2), py: (x + y) * (ISO_H / 2) }; }
function screenToIso(px, py) { return { x: (px / (ISO_W / 2) + py / (ISO_H / 2)) / 2, y: (py / (ISO_H / 2) - px / (ISO_W / 2)) / 2 }; }

const tileSpriteCache = new Map();

function createTileBlock(tile, variantSeed) {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_W; canvas.height = SPRITE_H;
  const c = canvas.getContext('2d');
  const cx = SPRITE_W / 2; const cy = SPRITE_PAD_TOP;

  const rnd = (i) => {
    const s = Math.sin(variantSeed * 12.9898 + i * 78.233) * 43758.5453;
    return s - Math.floor(s);
  };

  let cTop, cDark, cSide;
  
  // 🎨 PALETA DE COLORES
  if (tile === TILE.SAND) {
    cTop = '#fce38a'; cDark = '#e6c87a'; cSide = '#c2a255';
  } else if (tile === TILE.GRASS) {
    const jitter = Math.floor(rnd(99) * 10) - 5;
    cTop = `hsl(${75 + jitter}, 75%, ${55 + jitter}%)`;
    cDark = `hsl(${85 + jitter}, 60%, ${35 + jitter}%)`;
    cSide = `hsl(${30 + jitter}, 65%, ${45 + jitter}%)`;
  } else if (tile === TILE.FOREST) {
    const jitter = Math.floor(rnd(99) * 10) - 5;
    cTop = `hsl(${110 + jitter}, 60%, ${40 + jitter}%)`;
    cDark = `hsl(${110 + jitter}, 50%, ${25 + jitter}%)`;
    cSide = `hsl(${25 + jitter}, 50%, ${35 + jitter}%)`;
  } else if (tile === TILE.TUNDRA) {
    cTop = '#9db39d'; cDark = '#6e806e'; cSide = '#8c6d55';
  } else if (tile === TILE.SNOW) {
    cTop = '#ffffff'; cDark = '#dce6f2'; cSide = '#a3b8c9';
  } else if (tile === TILE.STONE) {
    cTop = '#a8a8a8'; cDark = '#7a7a7a'; cSide = '#5c5c5c';
  } else if (tile === TILE.WATER) {
    // 🟦 COLORES DEL AGUA CLARA
    cTop = '#59b5ff';
    cDark = '#3d9bf5';
    cSide = '#2a7bc7';
  } else if (tile === TILE.DEEP_WATER) {
    // 🟦 COLORES DEL AGUA PROFUNDA
    cTop = '#3d9bf5';
    cDark = '#2a7bc7';
    cSide = '#1e5c9e';
  }

  // --- Paredes Laterales ---
  c.fillStyle = cSide; c.beginPath();
  c.moveTo(cx - ISO_W / 2, cy); c.lineTo(cx, cy + ISO_H / 2);
  c.lineTo(cx, SPRITE_H); c.lineTo(cx - ISO_W / 2, SPRITE_H - ISO_H / 2);
  c.closePath(); c.fill();

  c.fillStyle = 'rgba(0,0,0,0.15)'; c.beginPath();
  c.moveTo(cx, cy + ISO_H / 2); c.lineTo(cx + ISO_W / 2, cy);
  c.lineTo(cx + ISO_W / 2, SPRITE_H - ISO_H / 2); c.lineTo(cx, SPRITE_H);
  c.closePath(); c.fill();

  // Textura de la tierra (no para agua)
  if (tile !== TILE.WATER && tile !== TILE.DEEP_WATER) {
    c.fillStyle = 'rgba(0,0,0,0.08)';
    for (let i = 0; i < SPRITE_H - cy; i += 6) {
      c.fillRect(cx - ISO_W / 4, cy + i + 4, ISO_W / 2, 1);
    }
  }

  // --- Cima (Rombo) ---
  c.fillStyle = cTop; c.beginPath();
  c.moveTo(cx, cy - ISO_H / 2); c.lineTo(cx + ISO_W / 2, cy);
  c.lineTo(cx, cy + ISO_H / 2); c.lineTo(cx - ISO_W / 2, cy);
  c.closePath(); c.fill();

  c.fillStyle = cDark; c.beginPath();
  c.moveTo(cx - ISO_W / 2, cy); c.lineTo(cx, cy + ISO_H / 2);
  c.lineTo(cx + ISO_W / 2, cy); c.lineTo(cx, cy + ISO_H / 2 - 1);
  c.closePath(); c.fill();

  c.fillStyle = 'rgba(255,255,255,0.2)'; c.beginPath();
  c.moveTo(cx, cy - ISO_H / 2); c.lineTo(cx + ISO_W / 2, cy);
  c.lineTo(cx, cy); c.lineTo(cx - ISO_W / 2, cy);
  c.closePath(); c.fill();

  // --- Detalles Superficiales ---
  if (tile === TILE.GRASS) {
    c.fillStyle = `hsl(80, 80%, 70%)`;
    for (let i = 0; i < 8; i++) {
      c.fillRect(cx - 10 + Math.floor(rnd(i * 2) * 20), cy - 4 + Math.floor(rnd(i * 2 + 1) * 8), 1, 2);
    }
    if (rnd(50) > 0.8) {
      c.fillStyle = rnd(51) > 0.5 ? '#ffdd55' : '#ff8888';
      c.fillRect(cx - 4 + rnd(52) * 8, cy - 2 + rnd(53) * 4, 2, 2);
    }
  }

  if (tile === TILE.SNOW) {
    c.fillStyle = '#ffffff';
    for (let i = 0; i < 15; i++) {
      c.fillRect(cx - 12 + rnd(i * 3) * 24, cy - 6 + rnd(i * 3 + 1) * 12, 2, 1);
    }
  }

  if (tile === TILE.WATER || tile === TILE.DEEP_WATER) {
    // Destellos de espuma blanca
    c.fillStyle = 'rgba(255, 255, 255, 0.4)';
    for (let i = 0; i < 4; i++) {
      const rx = cx - 10 + Math.floor(rnd(i * 4) * 20);
      const ry = cy - 4 + Math.floor(rnd(i * 4 + 1) * 8);
      c.fillRect(rx, ry, 3, 1);
    }
  }

  return { canvas, anchorY: cy };
}

function getTileSprite(tile, variant) {
  const key = `${tile}_${variant}`;
  let sprite = tileSpriteCache.get(key);
  if (sprite) return sprite;
  sprite = createTileBlock(tile, variant);
  tileSpriteCache.set(key, sprite);
  return sprite;
}