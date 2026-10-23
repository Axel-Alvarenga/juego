// ============================================================
// inventory.js
// Ítems y el inventario de YonyZ.
// ============================================================

const ITEMS = {
  WOOD:        { id: 'WOOD',        name: 'Madera',         color: '#8b5a2b', icon: 'wood' },
  STONE:       { id: 'STONE',       name: 'Piedra',         color: '#888888', icon: 'stone' },
  SHARP_STONE: { id: 'SHARP_STONE', name: 'Piedra afilada', color: '#aaaaaa', icon: 'sharp_stone' },
  SWORD_BASIC: { id: 'SWORD_BASIC', name: 'Espada tosca',   color: '#b8b8b8', icon: 'sword' },
  HACHA_TOSCA: { id: 'HACHA_TOSCA', name: 'Hacha tosca',    color: '#b8b8b8', icon: 'axe' },
  PICO_TOSCO:  { id: 'PICO_TOSCO',  name: 'Pico tosco',     color: '#b8b8b8', icon: 'pickaxe' },
  MEAT:        { id: 'MEAT',        name: 'Muslito',        color: '#c97a4a', icon: 'meat' },
  SLIME_GEL:   { id: 'SLIME_GEL',   name: 'Gelatina',       color: '#7bd64b', icon: 'slime_gel' },
  CAMPFIRE:    { id: 'CAMPFIRE',    name: 'Fogata',         color: '#ff8a3a', icon: 'campfire' },
};

function drawItemIcon(ctx, item, x, y, size) {
  switch (item.icon) {
    case 'slime_gel': ctx.fillStyle = '#7bd64b'; ctx.fillRect(x + 2, y + 4, size - 4, size - 6); ctx.fillStyle = '#b5f58d'; ctx.fillRect(x + 4, y + 5, 2, 2); break;
    case 'wood': ctx.fillStyle = '#8b5a2b'; ctx.fillRect(x + 1, y + 2, size - 2, size - 4); ctx.fillStyle = '#5c3a1a'; ctx.fillRect(x + 1, y + 2, size - 2, 1); break;
    case 'stone': ctx.fillStyle = '#888888'; ctx.fillRect(x + 2, y + 3, size - 4, size - 5); ctx.fillStyle = '#aaaaaa'; ctx.fillRect(x + 2, y + 3, size - 4, 1); break;
    case 'sharp_stone': ctx.fillStyle = '#9a9a9a'; ctx.fillRect(x + 2, y + 4, size - 4, size - 6); ctx.fillStyle = '#dddddd'; ctx.fillRect(x + 3, y + 2, size - 6, 2); break;
    case 'sword': ctx.fillStyle = '#d8d8d8'; ctx.fillRect(x + 5, y + 1, 2, size - 5); ctx.fillStyle = '#8b5a2b'; ctx.fillRect(x + 4, y + size - 5, 4, 3); break;
    case 'axe': ctx.fillStyle = '#8b5a2b'; ctx.fillRect(x + 6, y + 2, 2, size - 4); ctx.fillStyle = '#b8b8b8'; ctx.fillRect(x + 2, y + 2, 4, 3); break;
    case 'pickaxe': ctx.fillStyle = '#8b5a2b'; ctx.fillRect(x + 6, y + 4, 2, size - 6); ctx.fillStyle = '#b8b8b8'; ctx.fillRect(x + 1, y + 2, 8, 2); ctx.fillRect(x + 3, y + 1, 4, 1); break;
    case 'meat': ctx.fillStyle = '#c97a4a'; ctx.fillRect(x + 2, y + 3, size - 5, size - 5); break;
    case 'campfire': ctx.fillStyle = '#5c3a1a'; ctx.fillRect(x + 2, y + size - 4, size - 4, 2); ctx.fillStyle = '#ff5a2a'; ctx.fillRect(x + 5, y + 3, 3, 5); break;
    default: ctx.fillStyle = item.color || '#ffffff'; ctx.fillRect(x, y, size, size);
  }
}

class Inventory {
  constructor(slotCount = 10) {
    this.slotCount = slotCount;
    this.slots = new Array(slotCount).fill(null).map(() => ({ itemId: 'NONE', count: 0 }));
    this.activeSlot = 0;
    this.isOpen = false;
    this.slotSize = 16; this.slotGap = 2; this.slotPadding = 4;
    const totalWidth = slotCount * this.slotSize + (slotCount - 1) * this.slotGap;
    this.panelW = totalWidth + this.slotPadding * 2;
    this.panelH = this.slotSize + this.slotPadding * 2;
  }

  hasItem(itemId) { return this.slots.some(s => s.itemId === itemId && s.count > 0); }
  countOf(itemId) { return this.slots.reduce((n, s) => s.itemId === itemId ? n + s.count : n, 0); }

  addItem(itemId, amount = 1) {
    if (!ITEMS[itemId]) return false;
    for (let i = 0; i < this.slotCount; i++) {
      if (this.slots[i].itemId === itemId) { this.slots[i].count += amount; return true; }
    }
    for (let i = 0; i < this.slotCount; i++) {
      if (this.slots[i].itemId === 'NONE' || this.slots[i].count === 0) {
        this.slots[i].itemId = itemId; this.slots[i].count = amount; return true;
      }
    }
    return false;
  }

  removeOne(itemId) {
    for (let i = 0; i < this.slotCount; i++) {
      const s = this.slots[i];
      if (s.itemId === itemId && s.count > 0) {
        s.count--; if (s.count === 0) s.itemId = 'NONE'; return true;
      }
    }
    return false;
  }

  selectSlotOf(itemId) {
    for (let i = 0; i < this.slotCount; i++) {
      if (this.slots[i].itemId === itemId && this.slots[i].count > 0) { this.activeSlot = i; return true; }
    }
    return false;
  }

  draw(ctx, canvasW, canvasH) {
    const panelX = Math.floor((canvasW - this.panelW) / 2);
    const panelY = canvasH - this.panelH - 4;
    ctx.fillStyle = this.isOpen ? '#3b3b52' : '#242433';
    ctx.fillRect(panelX, panelY, this.panelW, this.panelH);
    ctx.fillStyle = this.isOpen ? '#ffd84a' : '#4a4a63';
    ctx.fillRect(panelX, panelY, this.panelW, 1);
    ctx.fillStyle = '#16161f';
    ctx.fillRect(panelX, panelY + this.panelH - 1, this.panelW, 1);
    for (let i = 0; i < this.slotCount; i++) {
      const sx = panelX + this.slotPadding + i * (this.slotSize + this.slotGap);
      const sy = panelY + this.slotPadding;
      this.drawSlot(ctx, sx, sy, i);
    }
  }

  drawSlot(ctx, sx, sy, index) {
    const isActive = index === this.activeSlot && this.isOpen;
    ctx.fillStyle = isActive ? '#3f3f5c' : '#1e1e2b';
    ctx.fillRect(sx, sy, this.slotSize, this.slotSize);
    ctx.strokeStyle = isActive ? '#ffd84a' : '#3a3a4d';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx + 0.5, sy + 0.5, this.slotSize - 1, this.slotSize - 1);
    const slot = this.slots[index];
    if (slot.itemId !== 'NONE' && slot.count > 0) {
      drawItemIcon(ctx, ITEMS[slot.itemId], sx + 2, sy + 2, this.slotSize - 4);
      if (slot.count > 1) {
        const txt = String(slot.count);
        const w = measurePixelText(txt);
        drawPixelText(ctx, txt, sx + this.slotSize - 1 - w, sy + this.slotSize - 7, '#ffffff');
      }
    }
    const label = index === 9 ? '0' : String(index + 1);
    drawPixelText(ctx, label, sx + 1, sy, '#7a7a90');
  }
}
