// ============================================================
// journal.js
// El libro del observador. Muestra lo que YonyZ ha aprendido,
// agrupado por categoría. Se abre/cierra con la tecla L.
//
// El observador (tú) puede LEER pero no modificar nada.
// El juego NO se pausa mientras el libro está abierto.
// ============================================================

class Journal {
  constructor(knowledge) {
    this.knowledge = knowledge;
    this.isOpen = false;

    // Scroll interno del libro
    this.scrollY = 0;
    this.maxScrollY = 0;

    // Layout (en coords del canvas interno, 480x270)
    this.panelX = 20;
    this.panelY = 16;
    this.panelW = 440;
    this.panelH = 220;
    this.padding = 8;

    this.lineHeight = 10;
    this.categoryHeaderHeight = 14;
  }

  toggle() {
    this.isOpen = !this.isOpen;
    if (!this.isOpen) this.scrollY = 0;
  }

  // Manejo de scroll (rueda del ratón)
  onWheel(deltaY) {
    if (!this.isOpen) return;
    this.scrollY += deltaY * 0.5;
    this.scrollY = Math.max(0, Math.min(this.scrollY, this.maxScrollY));
  }

  draw(ctx) {
    if (!this.isOpen) return;

    const { panelX, panelY, panelW, panelH, padding } = this;

    // --- Fondo semitransparente de pantalla completa ---
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, 480, 270);

    // --- Panel principal (fondo tipo pergamino oscuro) ---
    ctx.fillStyle = '#2a2418';
    ctx.fillRect(panelX, panelY, panelW, panelH);

    // Borde exterior claro
    ctx.strokeStyle = '#c8b88a';
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX + 0.5, panelY + 0.5, panelW - 1, panelH - 1);

    // Línea interior decorativa
    ctx.strokeStyle = '#6a5a3a';
    ctx.strokeRect(panelX + 2.5, panelY + 2.5, panelW - 5, panelH - 5);

    // --- Cabecera ---
    const title = 'Diario de YonyZ';
    const titleW = measurePixelText(title);
    drawPixelText(ctx, title, panelX + (panelW - titleW) / 2, panelY + 6, '#e8d8a8');

    // Línea bajo el título
    ctx.fillStyle = '#6a5a3a';
    ctx.fillRect(panelX + padding, panelY + 16, panelW - padding * 2, 1);

    // --- Contenido con clip (para que no se salga del panel) ---
    const contentX = panelX + padding;
    const contentY = panelY + 20;
    const contentW = panelW - padding * 2;
    const contentH = panelH - 20 - 16; // deja espacio al pie

    ctx.save();
    ctx.beginPath();
    ctx.rect(contentX, contentY, contentW, contentH);
    ctx.clip();

    // Construir la lista de líneas a dibujar
    const lines = this.buildLines(contentW);

    // Calcular maxScroll
    const totalHeight = this.computeLinesHeight(lines);
    this.maxScrollY = Math.max(0, totalHeight - contentH);
    this.scrollY = Math.max(0, Math.min(this.scrollY, this.maxScrollY));

    // Dibujar líneas
    let drawY = contentY - this.scrollY;
    for (const line of lines) {
      if (drawY + line.height < contentY) { drawY += line.height; continue; }
      if (drawY > contentY + contentH) break;

      if (line.type === 'header') {
        drawPixelText(ctx, line.text, contentX, drawY, '#ffd84a');
        // Subrayado del header
        ctx.fillStyle = '#6a5a3a';
        ctx.fillRect(contentX, drawY + 8, contentW, 1);
      } else if (line.type === 'entry') {
        // Timestamp a la izquierda (gris)
        const ts = `[${line.timestamp}]`;
        drawPixelText(ctx, ts, contentX, drawY, '#8a7a5a');
        const tsW = measurePixelText(ts);

        drawPixelText(ctx, line.text, contentX + tsW + 6, drawY, '#e8d8a8');
      } else if (line.type === 'empty') {
        drawPixelText(ctx, line.text, contentX, drawY, '#6a5a3a');
      } else if (line.type === 'spacer') {
        // nada
      }

      drawY += line.height;
    }

    ctx.restore();

    // --- Pie del panel ---
    const total = this.knowledge.count();
    const footer = `Descubrimientos: ${total}`;
    const footerW = measurePixelText(footer);
    drawPixelText(ctx, footer,
      panelX + (panelW - footerW) / 2,
      panelY + panelH - 10, '#c8b88a');

    // Indicador "L para cerrar" esquina inferior derecha
    const closeText = 'L para cerrar';
    const closeW = measurePixelText(closeText);
    drawPixelText(ctx, closeText,
      panelX + panelW - padding - closeW,
      panelY + panelH - 10, '#6a5a3a');
  }

  // Construye la lista de "líneas" a dibujar (headers + entries + empties)
  buildLines(contentW) {
    const lines = [];
    const entries = this.knowledge.all();

    // Orden de categorías en el libro
    const order = [
      'visto',
      'tocado',
      'aprendido',
      'intento_fallido',
      'intento_exitoso',
      'pista',
    ];

    for (const cat of order) {
      const catEntries = entries.filter(e => e.category === cat);
      if (catEntries.length === 0) continue;

      // Header de categoría
      const label = KNOWLEDGE_CATEGORY_LABEL[cat] || cat;
      lines.push({ type: 'header', text: label, height: this.categoryHeaderHeight });

      // Entradas
      for (const entry of catEntries) {
        lines.push({
          type: 'entry',
          text: entry.text,
          timestamp: entry.timestamp,
          category: entry.category,
          height: this.lineHeight,
        });
      }
    }

    if (lines.length === 0) {
      lines.push({
        type: 'empty',
        text: 'YonyZ aún no ha aprendido nada...',
        height: this.lineHeight,
      });
    }

    return lines;
  }

  computeLinesHeight(lines) {
    return lines.reduce((sum, l) => sum + l.height, 0);
  }
}