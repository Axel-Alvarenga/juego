const CRAFTING_RECIPES = [
  { a: 'STONE', b: 'STONE', result: 'SHARP_STONE', consumed: { STONE: 2 }, resultCount: 1, learnText: 'dos piedras frotadas se afilan entre sí' },
  { a: 'WOOD', b: 'SHARP_STONE', result: 'SWORD_BASIC', consumed: { WOOD: 1, SHARP_STONE: 2 }, resultCount: 1, learnText: 'madera + piedra afilada = espada tosca' },
  { a: 'WOOD', b: 'WOOD', result: 'CAMPFIRE', consumed: { WOOD: 2 }, resultCount: 1, learnText: 'dos maderas hacen una fogata' },
  { a: 'WOOD', b: 'SHARP_STONE', result: 'HACHA_TOSCA', consumed: { WOOD: 2, SHARP_STONE: 1 }, resultCount: 1, learnText: 'madera + piedra afilada = hacha tosca' },
  { a: 'WOOD', b: 'SHARP_STONE', result: 'PICO_TOSCO', consumed: { WOOD: 2, SHARP_STONE: 2 }, resultCount: 1, learnText: 'madera + piedra afilada = pico tosco' },
];

const CRAFTING_HINTS = { 'WOOD+STONE': 'la piedra tendría que estar afilada', default: 'eso no funciona, me falta algo' };
const CRAFTING_FAIL_COOLDOWN = 15;
const craftFailCooldowns = {};

function craftKey(a, b) { return [a, b].sort().join('+'); }
function isCraftOnCooldown(a, b) { return (craftFailCooldowns[craftKey(a, b)] || 0) > 0; }
function updateCraftCooldowns(dt) {
  for (const key in craftFailCooldowns) {
    craftFailCooldowns[key] -= dt;
    if (craftFailCooldowns[key] <= 0) delete craftFailCooldowns[key];
  }
}

function findPossibleRecipes(itemA, itemB) {
  const matches = [];
  for (const r of CRAFTING_RECIPES) {
    if (!r.result) continue;
    if ((r.a === itemA && r.b === itemB) || (r.a === itemB && r.b === itemA)) {
      matches.push(r);
    }
  }
  return matches;
}

// ⚠️ AHORA ACEPTA UNA LISTA DE EXCLUSIÓN (excludeResults)
function findCraftableRecipe(inventory, itemA, itemB, excludeResults = []) {
  let possible = findPossibleRecipes(itemA, itemB);
  
  // Filtramos las recetas que el jugador ya tiene o no quiere fabricar
  if (excludeResults.length > 0) {
    possible = possible.filter(r => !excludeResults.includes(r.result));
  }

  if (possible.length === 0) return null;

  // Ordenamos por coste de materiales (menor a mayor)
  possible.sort((r1, r2) => {
    const cost1 = Object.values(r1.consumed).reduce((a, b) => a + b, 0);
    const cost2 = Object.values(r2.consumed).reduce((a, b) => a + b, 0);
    return cost1 - cost2;
  });

  for (const recipe of possible) {
    let canCraft = true;
    for (const [itemId, qty] of Object.entries(recipe.consumed)) {
      if (inventory.countOf(itemId) < qty) { canCraft = false; break; }
    }
    if (canCraft) return recipe;
  }
  return null;
}

function executeCraft(inventory, itemA, itemB, targetResult = null, excludeResults = []) {
  let recipe = null;
  if (targetResult) {
    recipe = CRAFTING_RECIPES.find(r => r.result === targetResult);
    if (recipe && excludeResults.includes(targetResult)) recipe = null; // Si está excluido, no hacerlo
  } else {
    recipe = findCraftableRecipe(inventory, itemA, itemB, excludeResults);
  }
  
  if (!recipe) return { success: false, hint: CRAFTING_HINTS.default };

  // Sin materiales suficientes no se crea nada (también para recetas objetivo)
  for (const [itemId, qty] of Object.entries(recipe.consumed)) {
    if (inventory.countOf(itemId) < qty) return { success: false, hint: CRAFTING_HINTS.default };
  }

  for (const [itemId, qty] of Object.entries(recipe.consumed)) {
    for (let i = 0; i < qty; i++) inventory.removeOne(itemId);
  }
  inventory.addItem(recipe.result, recipe.resultCount || 1);

  return { success: true, result: recipe.result, count: recipe.resultCount || 1, recipe };
}