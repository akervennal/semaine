// model.js — vocabulaire de l'application : jours, creneaux, dates, petits utilitaires.
// Aucun etat, aucun DOM. Tout est pur et testable.

export const DAYS = [
  { k: "lun", n: "Lundi" },
  { k: "mar", n: "Mardi" },
  { k: "mer", n: "Mercredi" },
  { k: "jeu", n: "Jeudi" },
  { k: "ven", n: "Vendredi" },
  { k: "sam", n: "Samedi" },
  { k: "dim", n: "Dimanche" }
];

export const MOMENTS = [
  { k: "midi", n: "Midi" },
  { k: "soir", n: "Soir" }
];

// Les 14 creneaux, dans l'ordre de la semaine : "lun-midi", "lun-soir", "mar-midi"...
export const SLOTS = DAYS.flatMap(d => MOMENTS.map(m => d.k + "-" + m.k));

export const slotDay = id => DAYS.find(d => d.k === id.split("-")[0]);
export const slotMoment = id => MOMENTS.find(m => m.k === id.split("-")[1]);
export const slotLabel = id => slotDay(id).n + " " + slotMoment(id).n.toLowerCase();
export const dayIndex = id => DAYS.findIndex(d => d.k === id.split("-")[0]);

// Une semaine peut commencer n'importe quel jour (pas forcement lundi) : on fait
// tourner DAYS pour que l'affichage commence au jour reel de `startIso`. Les cles
// de creneau (lun-midi, mar-soir...) restent inchangees, seul l'ordre d'affichage bouge.
export function orderedDays(startIso) {
  const idx = (parseIso(startIso).getDay() + 6) % 7;
  return DAYS.slice(idx).concat(DAYS.slice(0, idx));
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// Rayons pour trier la liste de courses. Repris des categories de la liste
// de courses de Reminders (Apple), traduites, avec "Epicerie" (conserves,
// pates, riz, condiments...) remis pour ne rien laisser sans rayon evident.
export const CATEGORIES = [
  "Fruits & légumes",
  "Viande",
  "Crèmerie, œufs & fromage",
  "Boulangerie",
  "Pains & céréales",
  "Épicerie",
  "Surgelés",
  "Pâtisserie",
  "Snacks & confiseries",
  "Produits ménagers",
  "Soins & santé",
  "Vins, bières & spiritueux"
];

/* ---------- dates ---------- */
// Midi comme heure de reference : evite les decalages de fuseau au passage a l'ISO.

export function iso(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

export function parseIso(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

export function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export const fmtDay = d => d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
export const fmtShort = d => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }).replace(".", "");

// "du 31 août au 6 septembre" — le mois n'est repete que s'il change.
export function weekRange(startIso) {
  const a = parseIso(startIso);
  const b = addDays(a, 6);
  return "du " + (a.getMonth() === b.getMonth() ? a.getDate() : fmtDay(a)) + " au " + fmtDay(b);
}

/* ---------- texte ---------- */

export function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

// Cle de comparaison des ingredients : insensible a la casse, aux accents et aux espaces.
// C'est elle qui fait que "Creme", "crème " et "CRÈME" ne font qu'une ligne de courses.
export function normKey(s) {
  return String(s).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
}
