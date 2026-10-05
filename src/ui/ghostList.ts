import { esc, km2Short, label, lat, times } from "../format";
import type { World } from "../geo/load";
import { mercatorFactor } from "../geo/measure";
import { setState, state, subscribe } from "../state";
import { removeGhost, resetGhost } from "../views/truesize";

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
      el.innerHTML = `<p class="empty">Elige un país y pulsa «Mover sobre el mapa». Luego arrástralo a donde quieras: conserva su tamaño real.</p>`;
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
                moved ? ` · en Mercator aquí se ve ${times(rel)} ${rel < 1 ? "(se encoge)" : "(se infla)"}` : ""
              }</small>
            </div>
            <button class="icon-btn" data-act="reset" data-id="${g.id}" title="Volver a su lugar" aria-label="Devolver ${esc(c.name)} a su lugar">↺</button>
            <button class="icon-btn" data-act="remove" data-id="${g.id}" title="Quitar" aria-label="Quitar ${esc(c.name)}">✕</button>
          </li>`;
        })
        .join("")}</ul>` +
      (state.ghosts.length > 1 ? `<button class="link" data-act="clear">Quitar todos</button>` : "");
  });
}
