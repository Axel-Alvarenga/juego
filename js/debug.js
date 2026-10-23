// ============================================================
// debug.js
// Panel de debug activable con la tecla D.
// Muestra en tiempo real el estado interno de YonyZ.
//
// Solo para desarrollo. En un juego final esto se quitaría o
// se dejaría oculto por defecto.
// ============================================================

class DebugPanel {
  constructor() {
    this.enabled = false;

    // Layout (esquina superior derecha)
    this.width = 200;
    this.height = 230;
    this.x = 480 - this.width - 4; // 480 = RENDER_W
    this.y = 4;

    this.lineHeight = 8;
    this.padding = 4;
  }

  toggle() {
    this.enabled = !this.enabled;
  }

  draw(ctx, player, inventory) {
    if (!this.enabled) return;

    const { x, y, width, height, padding, lineHeight } = this;

    // Fondo
    ctx.fillStyle = 'rgba(10, 10, 15, 0.9)';
    ctx.fillRect(x, y, width, height);

    // Borde
    ctx.strokeStyle = '#ff4d4d';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);

    // Título
    drawPixelText(ctx, 'DEBUG [D]', x + padding, y + 3, '#ff4d4d');

    let cy = y + 13;

    // --- Separador ---
    ctx.fillStyle = '#3a3a4d';
    ctx.fillRect(x + padding, cy, width - padding * 2, 1);
    cy += 3;

    // --- Crafting ---
    drawPixelText(ctx, 'CRAFT', x + padding, cy, '#ffd84a');
    cy += 8;
    drawPixelText(ctx, `st: ${player.craftState}`, x + padding, cy, '#ffffff');
    cy += lineHeight;
    drawPixelText(ctx, `t: ${player.craftTimer.toFixed(2)}`, x + padding, cy, '#ffffff');
    cy += lineHeight;
    drawPixelText(ctx, `st: ${player.craftStateTimer.toFixed(2)}`, x + padding, cy, '#ffffff');
    cy += lineHeight + 2;

    // --- Cerebro ---
    drawPixelText(ctx, 'CEREBRO', x + padding, cy, '#ffd84a');
    cy += 8;
    drawPixelText(ctx, `think: ${player.thinkTimer.toFixed(2)}`, x + padding, cy, '#ffffff');
    cy += lineHeight;
    const intent = player.currentIntent || '-';
    const intentShort = intent.length > 22 ? intent.substring(0, 22) + '..' : intent;
    drawPixelText(ctx, `intent:`, x + padding, cy, '#ffffff');
    cy += lineHeight;
    drawPixelText(ctx, intentShort, x + padding + 4, cy, '#8aff8a');
    cy += lineHeight + 2;

    // --- Movimiento ---
    drawPixelText(ctx, 'MOVIMIENTO', x + padding, cy, '#ffd84a');
    cy += 8;
    const targetStr = player.target
      ? player.target.type + ` (${player.targetDuration.toFixed(1)}s)`
      : 'ninguno';
    drawPixelText(ctx, `target: ${targetStr}`, x + padding, cy, '#ffffff');
    cy += lineHeight;
    drawPixelText(ctx, `dir: ${player.dirX.toFixed(2)}, ${player.dirY.toFixed(2)}`, x + padding, cy, '#ffffff');
    cy += lineHeight + 2;

    // --- Posición ---
    drawPixelText(ctx, 'POSICIÓN', x + padding, cy, '#ffd84a');
    cy += 8;
    drawPixelText(ctx, `x: ${player.x.toFixed(1)} y: ${player.y.toFixed(1)}`, x + padding, cy, '#ffffff');
    cy += lineHeight;
    drawPixelText(ctx, `h: ${player.heightPx.toFixed(1)}`, x + padding, cy, '#ffffff');
    cy += lineHeight + 2;

    // --- Inventario ---
    drawPixelText(ctx, 'INVENTARIO', x + padding, cy, '#ffd84a');
    cy += 8;
    if (inventory) {
      let itemCount = 0;
      for (const slot of inventory.slots) {
        if (slot.itemId !== 'NONE' && slot.count > 0) {
          const item = ITEMS[slot.itemId];
          if (!item) continue;
          const name = item.name.substring(0, 12);
          drawPixelText(ctx, `${name}: ${slot.count}`, x + padding, cy, '#ffffff');
          cy += lineHeight;
          itemCount++;
          if (cy > y + height - 20) break;
        }
      }
      if (itemCount === 0) {
        drawPixelText(ctx, '(vacío)', x + padding, cy, '#7a7a90');
        cy += lineHeight;
      }
    }

    // --- Cooldowns de crafting ---
    cy = y + height - 30;
    drawPixelText(ctx, 'COOLDOWNS', x + padding, cy, '#ffd84a');
    cy += 8;

    if (typeof craftFailCooldowns !== 'undefined') {
      const keys = Object.keys(craftFailCooldowns);
      if (keys.length === 0) {
        drawPixelText(ctx, '(ninguno)', x + padding, cy, '#7a7a90');
      } else {
        for (const k of keys.slice(0, 3)) {
          const remaining = craftFailCooldowns[k];
          drawPixelText(ctx, `${k}: ${remaining.toFixed(1)}s`, x + padding, cy, '#ffaa55');
          cy += lineHeight;
        }
      }
    }
  }
}