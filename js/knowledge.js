// ============================================================
// knowledge.js
// Memoria de YonyZ.
//
// YonyZ aprende fragmentos de información por experiencia.
// Cada fragmento es una entrada con:
//   - category: tipo de conocimiento (ver KNOWLEDGE_CATEGORY)
//   - text:     descripción legible
//   - data:     datos extra opcionales (p. ej. combinaciones de ítems)
//   - timestamp: día y hora del mundo en que se aprendió
//
// YonyZ nunca olvida: las entradas no se borran ni se modifican.
// ============================================================

const KNOWLEDGE_CATEGORY = {
  VISTO:           'visto',
  TOCADO:          'tocado',
  APRENDIDO:       'aprendido',
  INTENTO_FALLIDO: 'intento_fallido',
  INTENTO_EXITOSO: 'intento_exitoso',
  PISTA:           'pista',
};

// Nombres legibles para mostrar en el libro
const KNOWLEDGE_CATEGORY_LABEL = {
  visto:           'Cosas que he visto',
  tocado:          'Cosas que he tocado',
  aprendido:       'Cosas que he aprendido',
  intento_fallido: 'Intentos fallidos',
  intento_exitoso: 'Intentos exitosos',
  pista:           'Pistas',
};

class Knowledge {
  constructor() {
    this.entries = [];
    // Evita duplicados exactos: clave = categoría + '::' + texto
    this._keys = new Set();
    // Función que devuelve el reloj del mundo ({ day, hour, minute })
    this.clockSource = null;
  }

  // Indica de dónde leer la hora del mundo.
  attachClock(fn) { this.clockSource = fn; }

  getTimestamp() {
    const c = this.clockSource ? this.clockSource() : { day: 1, hour: 0, minute: 0 };
    const h = String(c.hour).padStart(2, '0');
    const m = String(c.minute).padStart(2, '0');
    return `Día ${c.day}, ${h}:${m}`;
  }

  // Añade una entrada. Devuelve false si ya existía una idéntica.
  add(category, text, data = null) {
    if (!text || typeof text !== 'string') return false;

    const key = category + '::' + text;
    if (this._keys.has(key)) return false;
    this._keys.add(key);

    this.entries.push({ category, text, data, timestamp: this.getTimestamp() });
    return true;
  }

  saw(text, data = null)               { return this.add(KNOWLEDGE_CATEGORY.VISTO, text, data); }
  touched(text, data = null)           { return this.add(KNOWLEDGE_CATEGORY.TOCADO, text, data); }
  learned(text, data = null)           { return this.add(KNOWLEDGE_CATEGORY.APRENDIDO, text, data); }
  failedAttempt(text, data = null)     { return this.add(KNOWLEDGE_CATEGORY.INTENTO_FALLIDO, text, data); }
  successfulAttempt(text, data = null) { return this.add(KNOWLEDGE_CATEGORY.INTENTO_EXITOSO, text, data); }
  hint(text, data = null)              { return this.add(KNOWLEDGE_CATEGORY.PISTA, text, data); }

  // ¿Ya conoce una combinación exitosa de itemA + itemB?
  knowsCombination(itemA, itemB) {
    return this.entries.some(e =>
      e.category === KNOWLEDGE_CATEGORY.INTENTO_EXITOSO &&
      e.data && e.data.a === itemA && e.data.b === itemB
    );
  }

  // ¿Ha fallado alguna vez esta combinación?
  failedCombination(itemA, itemB) {
    return this.entries.some(e =>
      e.category === KNOWLEDGE_CATEGORY.INTENTO_FALLIDO &&
      e.data && e.data.a === itemA && e.data.b === itemB
    );
  }

  all() { return this.entries; }
  count() { return this.entries.length; }
}
