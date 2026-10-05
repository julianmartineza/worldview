import { esc, formatYear, km, km2, km2Short, lat, pct, times } from "../format";
import type { World } from "../geo/load";
import { LAND_AREA_KM2, mercatorFactor } from "../geo/measure";
import { setState, state, subscribe } from "../state";
import type { Country } from "../types";
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
    const go = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-goto]");
    if (go) return setState({ selected: go.dataset.goto! });
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-act]");
    if (!b || !state.selected) return;
    if (b.dataset.act === "move") actions.move(state.selected);
    else actions.compare(state.selected);
  });

  /** El país actual de área más parecida, para dar escala a una entidad histórica. */
  function nearestToday(area: number): Country {
    return world.countries.reduce((best, c) =>
      Math.abs(Math.log(c.area / area)) < Math.abs(Math.log(best.area / area)) ? c : best,
    );
  }

  function historyBlock(c: Country) {
    const near = nearestToday(c.area);
    const parent = c.parent ? world.byKey.get(c.parent) : null;
    const parts = (c.parts ?? []).map((k) => world.byKey.get(k)!).filter(Boolean);
    const shown = parts.slice(0, 8);
    return `
      <p class="mercator-note">Comparable a hoy: <button class="link" data-goto="${near.key}">${near.flag} ${esc(near.name)}</button> (${km2Short(near.area)})</p>
      ${parent ? `<p class="note">Parte de <button class="link" data-goto="${parent.key}">${esc(parent.name)}</button>.</p>` : ""}
      ${
        shown.length
          ? `<h4 class="parts-title">Territorios</h4><ul class="parts">${shown
              .map((p) => `<li><button class="link" data-goto="${p.key}">${esc(p.name)}</button><span>${km2Short(p.area)}</span></li>`)
              .join("")}</ul>${parts.length > shown.length ? `<p class="note">y ${parts.length - shown.length} territorios más.</p>` : ""}`
          : ""
      }
      ${c.people ? `<p class="note">Pueblo o cultura sin estado: su extensión es orientativa.</p>` : ""}
      ${c.precision === 1 ? `<p class="note">Fronteras aproximadas en la fuente (historical-basemaps).</p>` : ""}`;
  }

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
    const historic = c.year !== undefined;
    const region = [historic && `Año ${formatYear(c.year!)}`, c.region && REGION[c.region], c.capital && `capital ${c.capital}`]
      .filter(Boolean)
      .join(" · ");
    el.innerHTML = `
      <header class="info-head">
        <span class="flag" aria-hidden="true">${c.flag}</span>
        <div><h2>${esc(c.name)}</h2>${region ? `<p>${esc(region)}</p>` : ""}</div>
      </header>
      <p class="big-number">${km2(area)}<small>${c.officialArea ? "área oficial" : historic ? "área calculada de sus fronteras" : "área calculada"}</small></p>
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
      ${historic ? historyBlock(c) : ""}
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
