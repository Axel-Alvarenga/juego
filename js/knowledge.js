// ============================================================
// knowledge.js
// Estructura del conocimiento de YonyZ.
//
// YonyZ aprende fragmentos de información por experiencia.
// Cada fragmento es una entrada en su memoria con:
//   - categoría (visto, tocado, aprendido, intento fallido,
//     intento exitoso, pista, creencia, creencia corregida)
//   - texto legible
//   - datos adicionales (opcional)
//   - timestamp: día + hora del mundo
//   - corregida: si es una creencia que se demostró falsa
//
// YonyZ NUNCA olvida. Lo aprendido se queda para siempre.
// Las creencias pueden corregirse pero no borrarse.
// ============================================================

// Categorías de conocimiento
const KNOWLEDGE_CATEGORY = {
  VISTO:              'visto',
  TOCADO:             'tocado',
  APRENDIDO:          'aprendido',
  INTENTO_FALLIDO:    'intento_fallido',
  INTENTO_EXITOSO:    'intento_exitoso',
  PISTA:              'pista',
  CREENCIA:           'creencia',
};

// Nombres legibles para mostrar en el libro
const KNOWLEDGE_CATEGORY_LABEL = {
  'visto':            'Cosas que he visto',
  'tocado':           'Cosas que he tocado',
  'aprendido':        'Cosas que he aprendido',
  'intento_fallido':  'Intentos fallidos',
  'intento_exitoso':  'Intentos exitosos',
  'pista':            'Pistas',
  'creencia':         'Mis creencias',
};

class Knowledge {
  constructor() {
    // Array de entradas. Cada entrada tiene:
    // { category, text, data, timestamp, corrected, correction }
    this.entries = [];

    // Índice rápido por "clave" para evitar duplicados exactos.
    // clave = category + '::' + text (o data.key si existe)
    this._keys = new Set();

    // Reloj del mundo (lo actualiza main.js cada frame)
    this.clock = {
      totalSeconds: 0,   // segundos totales transcurridos
      day: 1,            // día actual
      hour: 8,           // hora del día (0-23)
      minute: 0,         // minuto (0-59)
    };

    // Configuración del reloj
    this.SECONDS_PER_DAY = 60;   // 1 día de juego = 60 segundos reales
    this.START_HOUR = 8;         // empieza a las 08:00
  }

  // Avanza el reloj del mundo.
  advanceClock(dt) {
    this.clock.totalSeconds += dt;

    const dayProgress = (this.clock.totalSeconds % this.SECONDS_PER_DAY) / this.SECONDS_PER_DAY;
    // La hora va de START_HOUR a START_HOUR + 24 (es decir, día completo en ciclo)
    const hoursFloat = (this.START_HOUR + dayProgress * 24) % 24;

    this.clock.day = Math.floor(this.clock.totalSeconds / this.SECONDS_PER_DAY) + 1;
    this.clock.hour = Math.floor(hoursFloat);
    this.clock.minute = Math.floor((hoursFloat - this.clock.hour) * 60);
  }

  // Formatea el timestamp actual como string legible.
  getTimestamp() {
    const h = String(this.clock.hour).padStart(2, '0');
    const m = String(this.clock.minute).padStart(2, '0');
    return `Día ${this.clock.day}, ${h}:${m}`;
  }

  // Añade una entrada al conocimiento. Devuelve true si se añadió,
  // false si ya existía una entrada idéntica.
  add(category, text, data = null) {
    if (!text || typeof text !== 'string') return false;

    const key = category + '::' + text;
    if (this._keys.has(key)) return false;

    this._keys.add(key);

    this.entries.push({
      category,
      text,
      data,
      timestamp: this.getTimestamp(),
      corrected: false,
      correction: null,
    });

    return true;
  }

  // Atajo: registra una "visto"
  saw(text, data = null) {
    return this.add(KNOWLEDGE_CATEGORY.VISTO, text, data);
  }

  // Atajo: registra "tocado"
  touched(text, data = null) {
    return this.add(KNOWLEDGE_CATEGORY.TOCADO, text, data);
  }

  // Atajo: registra "aprendido"
  learned(text, data = null) {
    return this.add(KNOWLEDGE_CATEGORY.APRENDIDO, text, data);
  }

  // Atajo: intento fallido
  failedAttempt(text, data = null) {
    return this.add(KNOWLEDGE_CATEGORY.INTENTO_FALLIDO, text, data);
  }

  // Atajo: intento exitoso
  successfulAttempt(text, data = null) {
    return this.add(KNOWLEDGE_CATEGORY.INTENTO_EXITOSO, text, data);
  }

  // Atajo: pista
  hint(text, data = null) {
    return this.add(KNOWLEDGE_CATEGORY.PISTA, text, data);
  }

  // Atajo: creencia (puede ser falsa)
  belief(text, data = null) {
    return this.add(KNOWLEDGE_CATEGORY.CREENCIA, text, data);
  }

  // Corrige una creencia existente. La marca como corregida y
  // añade un texto de corrección. NO la borra.
  correctBelief(originalText, correctionText) {
    for (const entry of this.entries) {
      if (entry.category === KNOWLEDGE_CATEGORY.CREENCIA
          && entry.text === originalText
          && !entry.corrected) {
        entry.corrected = true;
        entry.correction = correctionText;
        return true;
      }
    }
    return false;
  }

  // --- Consultas ---

  // ¿YonyZ ya sabe algo que contenga este texto (en cualquier categoría)?
  knows(text) {
    return this.entries.some(e => e.text === text);
  }

  // Devuelve todas las entradas de una categoría
  byCategory(category) {
    return this.entries.filter(e => e.category === category);
  }

  // Devuelve todas las entradas (para el diario)
  all() {
    return this.entries;
  }

  // Número total de descubrimientos
  count() {
    return this.entries.length;
  }

  // ¿Conoce alguna receta que implique "itemA"+"itemB"?
  // (Útil para el cerebro de YonyZ)
  knowsCombination(itemA, itemB) {
    return this.entries.some(e =>
      e.category === KNOWLEDGE_CATEGORY.INTENTO_EXITOSO &&
      e.data &&
      e.data.a === itemA && e.data.b === itemB
    );
  }

  // ¿Ha fallado alguna vez esta combinación?
  failedCombination(itemA, itemB) {
    return this.entries.some(e =>
      e.category === KNOWLEDGE_CATEGORY.INTENTO_FALLIDO &&
      e.data &&
      e.data.a === itemA && e.data.b === itemB
    );
  }

  // ¿Tiene alguna pista que contenga esta palabra?
  // (Para decidir comportamiento futuro: "si tiene pista de 'afilado' y ve piedra, intenta afilar")
  hasHintAbout(keyword) {
    return this.entries.some(e =>
      e.category === KNOWLEDGE_CATEGORY.PISTA &&
      e.text.toLowerCase().includes(keyword.toLowerCase())
    );
  }
}