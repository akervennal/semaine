// app.js — point d'entree. Demarre le rendu, branche les actions,
// enregistre le service worker qui rend l'application utilisable hors ligne.

import { render } from "./render.js";
import { initActions } from "./actions.js";

initActions();
render();

// Le service worker n'existe qu'en https ou sur localhost : en ouvrant le
// fichier autrement, l'application fonctionne, simplement sans cache hors ligne.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(err => {
      console.warn("Service worker non enregistré :", err.message);
    });
  });
}
