import { esc, km, km2, km2Short, lat, pct, times } from "../format";
import type { World } from "../geo/load";
import { LAND_AREA_KM2, mercatorFactor } from "../geo/measure";
import { state, subscribe } from "../state";
import { areaOf, dims, hasRemoteParts } from "./measures";

const REGION: Record<string, string> = {
  Africa: "África",
  Americas: "América",
  Asia: "Asia",
  Europe: "Europa",
  Oceania: "Oceanía",
  Antarctic: "Antártida",
};

export function createInfoPanel(
  el: HTMLElement,
  world: World,
  actions: { move(key: string): void; compare(key: string): void },
) {
  el.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-act]");
    if (!b || !state.selected) return;
    if (b.dataset.act === "move") actions.move(state.selected);
    else actions.compare(state.selected);
  });

  function render() {
    const c = state.selected ? world.byKey.get(state.selected) : null;
    if (!c) {
      el.innerHTML = `<p class="empty">Toca un país en el mapa o búscalo para ver cuánto mide de verdad.</p>`;
      return;
    }
    const d = dims(c);
    const area = areaOf(c);
    const f = mercatorFactor(c.anchor[1]);
    const gap = c.officialArea ? Math.abs(c.area - c.officialArea) / c.officialArea : 0;
    const region = [c.region && REGION[c.region], c.capital && `capital ${c.capital}`]
      .filter(Boolean)
      .join(" · ");
    el.innerHTML = `
      <header class="info-head">
        <span class="flag" aria-hidden="true">${c.flag}</span>
        <div><h2>${esc(c.name)}</h2>${region ? `<p>${esc(region)}</p>` : ""}</div>
      </header>
      <p class="big-number">${km2(area)}<small>${c.officialArea ? "área oficial" : "área calculada"}</small></p>
      <dl class="facts">
        <div><dt>De la tierra firme del planeta</dt><dd>${pct((area / LAND_AREA_KM2) * 100)}</dd></div>
        <div><dt>Ancho este–oeste</dt><dd>${km(d.width)}</dd></div>
        <div><dt>Alto norte–sur</dt><dd>${km(d.height)}</dd></div>
        <div><dt>Distancia más larga</dt><dd>${km(d.diameter)}</dd></div>
        <div><dt>Costas y fronteras</dt><dd>${km(d.perimeter)}</dd></div>
        <div><dt>Latitud del centro</dt><dd>${lat(c.anchor[1])}</dd></div>
      </dl>
      <p class="mercator-note">${
        f < 1.15
          ? "Está cerca del ecuador: en un mapa Mercator se ve casi de su tamaño real."
          : `En un mapa Mercator se ve <strong>${times(f)}</strong> más grande que un país de igual área en el ecuador.`
      }</p>
      ${hasRemoteParts(c) ? `<p class="note">Ancho, alto y distancia se miden sobre el territorio principal, sin islas o territorios lejanos.</p>` : ""}
      ${
        gap > 0.03
          ? `<p class="note">El polígono del mapa mide ${km2Short(c.area)}. La diferencia con la cifra oficial viene de territorios de ultramar, aguas interiores o fronteras en disputa.</p>`
          : ""
      }
      <div class="actions">
        <button class="btn primary" data-act="move">Mover sobre el mapa</button>
        <button class="btn" data-act="compare">Comparar con…</button>
      </div>`;
  }

  let last: string | null | undefined;
  subscribe(() => {
    if (state.selected !== last) {
      last = state.selected;
      render();
    }
  });
  render();
}
