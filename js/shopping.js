// shopping.js — la liste de courses est toujours derivee de la semaine,
// jamais stockee. Modifier un creneau suffit donc a la mettre a jour.

import { SLOTS, slotLabel, normKey, cap, CATEGORIES } from "./model.js";
import { state, mealById, save } from "./store.js";

// Prefixe des cles d'articles ajoutes a la main : un extra « Lait » reste une
// ligne distincte (verte) du « Lait » d'un repas, et se coche independamment.
const EXTRA_PREFIX = "+";

/**
 * Fusionne les ingredients de tous les repas planifies, puis les articles
 * ajoutes a la main. Chaque ligne d'ingredient garde son contexte : pour quel
 * jour, pour quel repas.
 * `key` sert aux cases cochees ; `cat` au rayon, partage entre un ingredient
 * et un extra du meme nom (on ne classe « Lait » qu'une fois).
 * `extra` porte l'id de l'article ajoute a la main, absent sinon.
 * @returns {Array<{key:string, cat:string, name:string, ctx:string[], extra?:string}>} trie alphabetiquement
 */
export function shoppingList() {
  const map = new Map();

  // On parcourt les creneaux dans l'ordre de la semaine : les contextes
  // apparaissent donc de lundi a dimanche sous chaque ingredient. Un creneau
  // peut contenir plusieurs repas (plat + dessert, par exemple).
  SLOTS.forEach(sid => {
    (state.week.slots[sid] || []).forEach(planned => {
      const meal = mealById(planned.mealId);
      if (!meal) return;

      (meal.ingredients || []).forEach(raw => {
        const name = String(raw).trim();
        const key = normKey(name);
        if (!key) return;
        if (!map.has(key)) map.set(key, { key, cat: key, name: cap(name), ctx: [] });

        const line = slotLabel(sid) + " · " + meal.name + (planned.people ? " (" + planned.people + " pers.)" : "");
        const entry = map.get(key);
        // Deux fois le meme plat le meme soir ne doit pas doubler la ligne de contexte.
        if (!entry.ctx.includes(line)) entry.ctx.push(line);
      });
    });
  });

  state.extras.forEach(x => {
    const cat = normKey(x.name);
    if (!cat) return;
    const key = EXTRA_PREFIX + cat;
    if (!map.has(key)) map.set(key, { key, cat, name: cap(x.name.trim()), ctx: [], extra: x.id });
  });

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

export const remaining = list => list.filter(i => !state.checked[i.key]).length;
export const doneCount = list => list.filter(i => state.checked[i.key]).length;

// Rayon d'un ingredient, choisi une fois par l'utilisateur (voir store.setCategory).
// "" = jamais choisi.
export const categoryOf = key => state.categories[key] || "";

// Identifiant du groupe "Pris" (regroupe tous les articles coches, quel que
// soit leur rayon). Ne peut pas entrer en collision avec un vrai rayon ou
// avec "" (non classe).
const DONE_KEY = "__pris__";

// Groupe la liste pour l'affichage : les rayons ne montrent que ce qu'il
// reste a acheter ("Non classe" en tete, puis l'ordre du magasin), et tout
// article coche - quel que soit son rayon - rejoint une seule pile "Pris"
// en fin de page. Les groupes vides sont omis. shoppingList() est deja trie
// alphabetiquement, donc l'ordre est conserve sans re-tri.
export function groupForDisplay(list) {
  const groups = new Map(["", ...CATEGORIES].map(c => [c, []]));
  const done = [];
  list.forEach(i => {
    if (state.checked[i.key]) { done.push(i); return; }
    const cat = categoryOf(i.cat);
    if (!groups.has(cat)) groups.set(cat, []); // rayon inconnu (fichier importe d'une version future)
    groups.get(cat).push(i);
  });
  const result = [...groups.entries()]
    .filter(([, items]) => items.length)
    .map(([cat, items]) => ({ key: cat, label: cat || "Non classé", items }));
  if (done.length) result.push({ key: DONE_KEY, label: "Pris", items: done });
  return result;
}

// Oublie les cases cochees dont l'ingredient a disparu de la semaine.
export function pruneChecked(list) {
  const keys = new Set(list.map(i => i.key));
  let changed = false;
  Object.keys(state.checked).forEach(k => {
    if (!keys.has(k)) {
      delete state.checked[k];
      changed = true;
    }
  });
  if (changed) save();
}
