class CraftPanel {
  constructor() {
    this.visible = false;
    this.phase = 'idle';
    this.itemA = null;
    this.itemB = null;
    this.qtyA = 1;
    this.qtyB = 1;
    this.resultItem = null;

    this.phaseTime = 0;
    this.animTimer = 0;

    this.x = 6;
    this.y = 86;
    this.slotSize = 18;
    this.gap = 6;

    this.panelPadding = 4;
    this.panelW = this.slotSize * 2 + 14 + this.slotSize + this.gap * 3 + this.panelPadding * 2;
    this.panelH = this.slotSize + 14 + this.panelPadding * 2;
  }

  start(itemA, itemB, qtyA = 1, qtyB = 1) {
    this.visible = true;
    this.itemA = itemA;
    this.itemB = itemB;
    this.qtyA = qtyA;
    this.qtyB = qtyB;
    this.resultItem = null;
    this.phase = 'placing_a';
    this.phaseTime = 0;
    this.animTimer = 0;
  }

  goThinking() { this.phase = 'thinking'; this.phaseTime = 0; }
  showSuccess(resultItemId) { this.phase = 'success'; this.phaseTime = 0; this.resultItem = resultItemId; }
  showFail() { this.phase = 'fail'; this.phaseTime = 0; }

  close() {
    this.visible = false;
    this.phase = 'idle';
    this.itemA = null;
    this.itemB = null;
    this.resultItem = null;
  }

  update(dt) { if (this.visible) this.phaseTime += dt; }

  draw(ctx) {
    if (!this.visible) return;

    const x = this.x;
    const y = this.y;

    ctx.fillStyle = 'rgba(20, 20, 30, 0.92)';
    ctx.fillRect(x, y, this.panelW, this.panelH);
    ctx.strokeStyle = '#6a5a3a';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, this.panelW - 1, this.panelH - 1);

    drawPixelText(ctx, 'Mesa', x + 3, y + 2, '#a89878');

    const slotsY = y + 10;

    const slotAX = x + this.panelPadding;
    this.drawSlot(ctx, slotAX, slotsY);

    const hasSecondItem = this.itemB !== null;

    let slotBX = 0;
    let arrowX = 0;

    if (hasSecondItem) {
      const plusX = slotAX + this.slotSize + 2;
      drawPixelText(ctx, '+', plusX + 2, slotsY + 6, '#a89878');

      slotBX = plusX + 8;
      this.drawSlot(ctx, slotBX, slotsY);

      arrowX = slotBX + this.slotSize + 2;
    } else {
      arrowX = slotAX + this.slotSize + 2;
    }

    drawPixelText(ctx, '>', arrowX + 2, slotsY + 6, '#a89878');

    const resultX = arrowX + 8;
    this.drawSlot(ctx, resultX, slotsY);

    const shake = this.computeShake();

    if (this.phase === 'placing_a' || this.phase === 'thinking' || this.phase === 'success' || this.phase === 'fail') {
      if (this.phaseTime > 0.05 || this.phase !== 'placing_a') {
        this.drawItemInSlot(ctx, slotAX, slotsY, this.itemA, this.qtyA, shake.x, shake.y);
      }
    }

    if (hasSecondItem && (this.phase === 'placing_b' || this.phase === 'thinking' || this.phase === 'success' || this.phase === 'fail')) {
      this.drawItemInSlot(ctx, slotBX, slotsY, this.itemB, this.qtyB, shake.x, shake.y);
    }

    if (this.phase === 'thinking') {
      const dots = Math.floor(this.phaseTime * 3) % 4;
      const dotStr = '.'.repeat(dots);
      drawPixelText(ctx, dotStr, resultX + 6, slotsY + 8, '#ffd84a');
    } else if (this.phase === 'success') {
      const flash = Math.sin(this.phaseTime * 20) * 0.5 + 0.5;
      ctx.fillStyle = `rgba(255, 220, 100, ${flash * 0.5})`;
      ctx.fillRect(resultX - 2, slotsY - 2, this.slotSize + 4, this.slotSize + 4);
      this.drawItemInSlot(ctx, resultX, slotsY, this.resultItem, 1, 0, 0);
    }
  }

  computeShake() {
    if (this.phase !== 'fail') return { x: 0, y: 0 };
    if (this.phaseTime > 0.6) return { x: 0, y: 0 };
    const intensity = Math.max(0, 1 - this.phaseTime / 0.6);
    const sx = Math.sin(this.phaseTime * 50) * 2 * intensity;
    const sy = Math.cos(this.phaseTime * 50) * 1 * intensity;
    return { x: Math.round(sx), y: Math.round(sy) };
  }

  drawSlot(ctx, sx, sy) {
    ctx.fillStyle = '#1e1e2b';
    ctx.fillRect(sx, sy, this.slotSize, this.slotSize);
    ctx.strokeStyle = '#3a3a4d';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx + 0.5, sy + 0.5, this.slotSize - 1, this.slotSize - 1);
  }

  drawItemInSlot(ctx, sx, sy, itemId, quantity, offsetX, offsetY) {
    if (!itemId) return;
    const item = ITEMS[itemId];
    if (!item) return;

    const padding = 2;
    const inner = this.slotSize - padding * 2;
    const ix = sx + padding + offsetX;
    const iy = sy + padding + offsetY;

    drawItemIcon(ctx, item, ix, iy, inner);

    // ⚠️ SOLO DIBUJAR CANTIDAD SI ES MAYOR A 1
    if (quantity > 1) {
      const txt = `x${quantity}`;
      const w = measurePixelText(txt);
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.fillRect(sx + this.slotSize - w - 2, sy + this.slotSize - 8, w + 2, 8);
      drawPixelText(ctx, txt, sx + this.slotSize - w - 1, sy + this.slotSize - 7, '#ffffff');
    }
  }
}