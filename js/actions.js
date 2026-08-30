// actions.js — un seul ecouteur de clic pour toute l'application.
// Chaque bouton porte un data-act ; le switch ci-dessous est la carte
// complete des interactions possibles. Ajouter une fonctionnalite =
// ajouter un data-act dans une vue et un case ici.

import { SLOTS, slotLabel, iso, mondayOf, parseIso } from "./model.js";
import * as store from "./store.js";
import { state, mealById } from "./store.js";
import { ui } from "./uistate.js";
import { render, renderSheet, renderTabbar, openSheet, closeSheet, closeDialog, isDialogOpen, toast, ask, refreshCheck } from "./render.js";
import { mealList } from "./views.js";

export function initActions() {
  document.addEventListener("click", onClick);
  document.addEventListener("input", onInput);
  document.addEventListener("keydown", onKey);
  document.getElementById("scrim").addEventListener("click", closeSheet);
  window.addEventListener("scroll", () => {
    document.getElementById("topbar").classList.toggle("edge", window.scrollY > 4);
  }, { passive: true });
}

async function onClick(e) {
  const el = e.target.closest("[data-act]");
  if (!el) return;

  // Le voile du dialogue porte lui aussi data-act="dlg-no" : on ignore les clics
  // qui viennent de l'interieur de la boite sans toucher un bouton.
  if (el.dataset.act === "dlg-no" && e.target.closest(".dlg") && e.target !== el) return;

  const d = el.dataset;

  switch (d.act) {

    /* ---------- navigation ---------- */
    case "tab":
      if (ui.tab === d.tab) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
      ui.tab = d.tab;
      ui.query = "";
      render();
      window.scrollTo(0, 0);
      break;

    case "close": closeSheet(); break;
    case "dlg-yes": closeDialog(true); break;
    case "dlg-no": closeDialog(false); break;

    /* ---------- semaine ---------- */
    case "slot":
      ui.pick = null;
      openSheet({ type: "slot", slot: d.slot });
      break;

    case "pick-expand": {
      const already = ui.pick && ui.pick.slot === d.slot && ui.pick.mealId === d.id;
      if (already) {
        ui.pick = null;
      } else {
        const planned = state.week.slots[d.slot];
        const people = planned && planned.mealId === d.id ? (planned.people || 0) : 0;
        ui.pick = { slot: d.slot, mealId: d.id, people };
      }
      renderSheet();
      break;
    }

    case "pick-people":
      if (ui.pick) {
        ui.pick.people = Math.max(0, Math.min(20, ui.pick.people + Number(d.d)));
        renderSheet();
      }
      break;

    case "pick-confirm":
      store.setSlot(d.slot, d.id);
      store.setPeople(d.slot, ui.pick ? ui.pick.people : 0);
      ui.pick = null;
      closeSheet();
      render();
      toast(mealById(d.id).name + " · " + slotLabel(d.slot));
      break;

    case "clear-slot":
      store.clearSlot(d.slot);
      closeSheet();
      render();
      break;

    case "people":
      store.bumpPeople(d.slot, Number(d.d));
      renderSheet();
      render();
      break;

    /* ---------- bibliotheque ---------- */
    case "meal":
      openSheet({ type: "meal", id: d.id });
      break;

    case "fav":
      store.toggleFav(d.id);
      if (ui.sheet && ui.sheet.type === "meal") renderSheet();
      render();
      break;

    case "new-meal":
      ui.draft = { id: null, name: "", ingredients: [""] };
      openSheet({ type: "edit" });
      break;

    case "edit-meal": {
      const m = mealById(d.id);
      ui.draft = { id: m.id, name: m.name, ingredients: (m.ingredients || []).slice() };
      if (!ui.draft.ingredients.length) ui.draft.ingredients = [""];
      openSheet({ type: "edit" });
      break;
    }

    case "ing-add":
      readDraft();
      ui.draft.ingredients.push("");
      renderSheet();
      focusLastIngredient();
      break;

    case "ing-del":
      readDraft();
      ui.draft.ingredients.splice(Number(d.i), 1);
      if (!ui.draft.ingredients.length) ui.draft.ingredients = [""];
      renderSheet();
      break;

    case "save-meal": {
      readDraft();
      const name = ui.draft.name.trim();
      if (!name) {
        toast("Donnez un nom au repas");
        const f = document.getElementById("mname");
        if (f) f.focus();
        break;
      }
      const ingredients = ui.draft.ingredients.map(s => s.trim()).filter(Boolean);
      if (ui.draft.id) store.updateMeal(ui.draft.id, name, ingredients);
      else store.addMeal(name, ingredients);
      closeSheet();
      render();
      toast("Repas enregistré");
      break;
    }

    case "del-meal": {
      const m = mealById(d.id);
      const used = store.slotsUsing(m.id);
      const ok = await ask({
        title: "Supprimer " + m.name + " ?",
        danger: true,
        ok: "Supprimer",
        text: used.length
          ? "Ce repas est planifié " + used.length + " fois cette semaine. Ces créneaux seront vidés."
          : "Le repas quitte définitivement la bibliothèque."
      });
      if (!ok) break;
      store.removeMeal(m.id);
      closeSheet();
      render();
      break;
    }

    /* ---------- courses ---------- */
    case "check":
      store.toggleChecked(d.key);
      refreshCheck(el);
      break;

    case "reset-checks":
      store.resetChecked();
      render();
      break;

    /* ---------- plus ---------- */
    case "end-week": {
      const ok = await ask({
        title: "Terminer cette semaine ?",
        ok: "Terminer",
        text: "La semaine actuelle sera archivée et une nouvelle semaine vide pourra être créée. La bibliothèque de repas reste intacte."
      });
      if (!ok) break;
      store.endWeek();
      ui.tab = "semaine";
      render();
      window.scrollTo(0, 0);
      toast("Nouvelle semaine prête");
      break;
    }

    case "redo": {
      if (store.plannedCount()) {
        const ok = await ask({
          title: "Remplacer la semaine en cours ?",
          ok: "Remplacer",
          text: "Les repas actuellement planifiés seront écrasés par ceux de cette semaine archivée."
        });
        if (!ok) break;
      }
      store.redoWeek(d.id);
      ui.tab = "semaine";
      render();
      window.scrollTo(0, 0);
      toast("Semaine reprise");
      break;
    }

    case "del-hist":
      store.removeHistory(d.id);
      render();
      break;

    case "seed":
      store.seed();
      ui.tab = "repas";
      render();
      toast("6 repas ajoutés");
      break;

    case "export": exportFile(); break;
    case "import": importFile(); break;

    case "wipe": {
      const ok = await ask({
        title: "Tout effacer ?",
        danger: true,
        ok: "Effacer",
        text: "Repas, semaine, courses et historique seront supprimés. C'est définitif."
      });
      if (!ok) break;
      store.replaceState(store.blank());
      ui.tab = "semaine";
      render();
      break;
    }
  }
}

/* ---------- saisie ---------- */

function onInput(e) {
  const t = e.target;

  // Recherche : on ne rafraichit que la liste, sinon le champ perdrait le focus.
  if (t.id === "q") {
    ui.query = t.value;
    const c = document.getElementById("meal-list");
    if (c) c.innerHTML = mealList();
    return;
  }

  if (t.id === "mname" && ui.draft) ui.draft.name = t.value;

  if (t.dataset && t.dataset.ing !== undefined && ui.draft) {
    ui.draft.ingredients[Number(t.dataset.ing)] = t.value;
  }

  if (t.id === "wstart" && t.value) {
    store.setWeekStart(t.value);
    render();
  }
}

function onKey(e) {
  // Entree dans un champ ingredient : ligne suivante, comme dans une liste papier.
  if (e.key === "Enter" && e.target.dataset && e.target.dataset.ing !== undefined) {
    e.preventDefault();
    readDraft();
    ui.draft.ingredients.push("");
    renderSheet();
    focusLastIngredient();
  }
  if (e.key === "Escape") {
    if (isDialogOpen()) closeDialog(false);
    else if (ui.sheet) closeSheet();
  }
}

// Relit les champs avant tout re-rendu de la feuille d'edition,
// pour ne pas perdre ce qui vient d'etre tape.
function readDraft() {
  if (!ui.draft) return;
  const n = document.getElementById("mname");
  if (n) ui.draft.name = n.value;
  document.querySelectorAll("[data-ing]").forEach(i => {
    ui.draft.ingredients[Number(i.dataset.ing)] = i.value;
  });
}

function focusLastIngredient() {
  const all = document.querySelectorAll("[data-ing]");
  if (all.length) all[all.length - 1].focus();
}

/* ---------- fichiers ---------- */

function exportFile() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "semaine-" + state.week.start + ".json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function importFile() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";
  input.onchange = () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const d = JSON.parse(reader.result);
        if (!d || !Array.isArray(d.meals)) throw new Error("format");
        store.replaceState({
          meals: d.meals,
          week: d.week && d.week.start ? d.week : store.emptyWeek(),
          checked: d.checked || {},
          history: d.history || []
        });
        render();
        toast("Fichier importé");
      } catch (err) {
        toast("Fichier illisible");
      }
    };
    reader.readAsText(file);
  };
  input.click();
}
