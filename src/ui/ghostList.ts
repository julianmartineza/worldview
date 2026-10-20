import { esc, km2Short, label, lat, times } from "../format";
import type { World } from "../geo/load";
import { mercatorFactor } from "../geo/measure";
import { setState, state, subscribe } from "../state";
import { removeGhost, resetGhost } from "../views/truesize";
import { tr } from "../i18n";

export function createGhostList(el: HTMLElement, world: World) {
  el.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-act]");
    if (!b) return;
    const id = Number(b.dataset.id);
    if (b.dataset.act === "reset") resetGhost(world, id);
    else if (b.dataset.act === "remove") removeGhost(id);
    else if (b.dataset.act === "clear") setState({ ghosts: [] });
  });

  let last: unknown;
  subscribe(() => {
    if (state.ghosts === last) return;
    last = state.ghosts;
    if (!state.ghosts.length) {
      el.innerHTML = `<p class="empty">${tr(
        "Elige un país y pulsa «Mover sobre el mapa». Luego arrástralo a donde quieras: conserva su tamaño real.",
        "Pick a country and press “Move on the map”. Then drag it anywhere: it keeps its true size.",
      )}</p>`;
      return;
    }
    el.innerHTML =
      `<ul class="ghosts">${state.ghosts
        .map((g) => {
          const c = world.byKey.get(g.key)!;
          // Cuánto cambia su tamaño aparente en Mercator respecto a su posición original
          const rel = mercatorFactor(g.target[1]) / mercatorFactor(c.anchor[1]);
          const moved = Math.abs(rel - 1) > 0.02;
          return `<li>
            <span class="dot" style="background:${g.color}"></span>
            <div class="ghost-text">
              <strong>${c.flag} ${esc(label(c))}</strong>
              <small>${km2Short(c.area)} · ${lat(g.target[1])}${
                moved
                  ? ` · ${tr("en Mercator aquí se ve", "in Mercator it looks")} ${times(rel)} ${
                      rel < 1 ? tr("(se encoge)", "(shrinks)") : tr("(se infla)", "(inflates)")
                    }`
                  : ""
              }</small>
            </div>
            <button class="icon-btn" data-act="reset" data-id="${g.id}" title="${tr("Volver a su lugar", "Back to its place")}" aria-label="${tr("Devolver", "Return")} ${esc(c.name)} ${tr("a su lugar", "to its place")}">↺</button>
            <button class="icon-btn" data-act="remove" data-id="${g.id}" title="${tr("Quitar", "Remove")}" aria-label="${tr("Quitar", "Remove")} ${esc(c.name)}">✕</button>
          </li>`;
        })
        .join("")}</ul>` +
      (state.ghosts.length > 1 ? `<button class="link" data-act="clear">${tr("Quitar todos", "Remove all")}</button>` : "");
  });
}
