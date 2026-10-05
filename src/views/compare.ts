import { geoPath } from "d3";
import { esc, km, km2, num1, pct, times } from "../format";
import type { World } from "../geo/load";
import { LAND_AREA_KM2, localProjection } from "../geo/measure";
import { setState, state, subscribe } from "../state";
import type { Country } from "../types";
import { createSearch } from "../ui/search";
import { areaOf, dims } from "../ui/measures";

type Slot = "a" | "b";

function niceKm(x: number) {
  const p = 10 ** Math.floor(Math.log10(x));
  return [1, 2, 5, 10].map((m) => m * p).filter((v) => v <= x).pop() ?? p;
}

export function createCompare(
  el: HTMLElement,
  world: World,
  actions: { showOnMap(a: string, b: string): void },
) {
  el.innerHTML = `
    <div class="compare">
      <div class="compare-pickers">
        <div class="picker"><span class="swatch a" aria-hidden="true"></span><div data-slot="a"></div></div>
        <button class="icon-btn" data-swap aria-label="Intercambiar países" title="Intercambiar">⇄</button>
        <div class="picker"><span class="swatch b" aria-hidden="true"></span><div data-slot="b"></div></div>
      </div>
      <p class="compare-headline" aria-live="polite"></p>
      <div class="compare-body">
        <figure class="compare-figure">
          <svg role="img" aria-label="Siluetas superpuestas a la misma escala"></svg>
          <figcaption>
            <span>Misma escala y sin distorsión. Arrastra las siluetas para alinearlas.</span>
            <label class="check"><input type="checkbox" data-full> Incluir territorios lejanos</label>
          </figcaption>
        </figure>
        <div class="compare-stats"></div>
      </div>
    </div>`;

  const svg = el.querySelector("svg")!;
  const figure = el.querySelector<HTMLElement>(".compare-figure")!;
  const headline = el.querySelector<HTMLElement>(".compare-headline")!;
  const stats = el.querySelector<HTMLElement>(".compare-stats")!;
  const pickers = {
    a: createSearch(el.querySelector('[data-slot="a"]')!, world, {
      label: "Primer país",
      placeholder: "Primer país…",
      onPick: (c) => setState({ compareA: c.key }),
    }),
    b: createSearch(el.querySelector('[data-slot="b"]')!, world, {
      label: "Segundo país",
      placeholder: "Segundo país…",
      onPick: (c) => setState({ compareB: c.key }),
    }),
  };
  el.querySelector("[data-swap]")!.addEventListener("click", () =>
    setState({ compareA: state.compareB, compareB: state.compareA }),
  );
  el.querySelector<HTMLInputElement>("[data-full]")!.addEventListener("change", (e) =>
    setState({ compareFull: (e.target as HTMLInputElement).checked }),
  );
  stats.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest("[data-map]") && state.compareA && state.compareB)
      actions.showOnMap(state.compareA, state.compareB);
  });

  const offsets: Record<Slot, [number, number]> = { a: [0, 0], b: [0, 0] };
  let base = { x: 0, y: 0, s: 1 };
  const get = (k: string | null) => (k ? world.byKey.get(k) ?? null : null);

  function drawFigure() {
    const W = svg.clientWidth;
    const H = svg.clientHeight;
    if (!W || !H) return;
    const items = (
      [
        ["a", get(state.compareA)],
        ["b", get(state.compareB)],
      ] as [Slot, Country | null][]
    )
      .filter((x): x is [Slot, Country] => !!x[1])
      .map(([slot, c]) => {
        const geo = state.compareFull ? c.feature : c.main;
        const path = geoPath(localProjection(c.anchor));
        return { slot, c, d: path(geo) ?? "", b: path.bounds(geo), area: path.area(geo) };
      })
      .sort((p, q) => q.area - p.area);
    if (!items.length) {
      svg.innerHTML = "";
      return;
    }
    const x0 = Math.min(...items.map((i) => i.b[0][0]));
    const y0 = Math.min(...items.map((i) => i.b[0][1]));
    const x1 = Math.max(...items.map((i) => i.b[1][0]));
    const y1 = Math.max(...items.map((i) => i.b[1][1]));
    const pad = 28;
    const s = Math.min((W - 2 * pad) / (x1 - x0), (H - 2 * pad - 24) / (y1 - y0));
    base = { x: W / 2 - (s * (x0 + x1)) / 2, y: (H - 24) / 2 - (s * (y0 + y1)) / 2, s };

    const bar = niceKm(W / 4 / s);
    svg.innerHTML =
      items
        .map(
          (i) => `<g class="shape shape-${i.slot}" data-slot="${i.slot}" transform="${transform(i.slot)}">
            <path d="${i.d}" vector-effect="non-scaling-stroke"><title>${esc(i.c.name)}</title></path></g>`,
        )
        .join("") +
      `<g class="scalebar" transform="translate(${pad},${H - 14})">
        <line x1="0" x2="${bar * s}" y1="0" y2="0"/><line x1="0" x2="0" y1="-5" y2="0"/>
        <line x1="${bar * s}" x2="${bar * s}" y1="-5" y2="0"/>
        <text x="${bar * s + 8}" y="4">${km(bar)}</text></g>`;
  }

  const transform = (slot: Slot) =>
    `translate(${base.x + offsets[slot][0]},${base.y + offsets[slot][1]}) scale(${base.s})`;

  let dragging: { slot: Slot; g: SVGGElement; last: [number, number] } | null = null;
  svg.addEventListener("pointerdown", (e) => {
    const g = (e.target as Element).closest<SVGGElement>("g.shape");
    if (!g) return;
    svg.setPointerCapture(e.pointerId);
    g.parentNode!.appendChild(g);
    dragging = { slot: g.dataset.slot as Slot, g, last: [e.clientX, e.clientY] };
  });
  svg.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const o = offsets[dragging.slot];
    o[0] += e.clientX - dragging.last[0];
    o[1] += e.clientY - dragging.last[1];
    dragging.last = [e.clientX, e.clientY];
    dragging.g.setAttribute("transform", transform(dragging.slot));
  });
  const stop = () => (dragging = null);
  svg.addEventListener("pointerup", stop);
  svg.addEventListener("pointercancel", stop);

  function renderText() {
    const A = get(state.compareA);
    const B = get(state.compareB);
    if (!A || !B) {
      headline.innerHTML = "Elige dos países para verlos uno encima del otro a escala real.";
      stats.innerHTML = "";
      return;
    }
    const [big, small] = areaOf(A) >= areaOf(B) ? [A, B] : [B, A];
    const r = areaOf(big) / areaOf(small);
    headline.innerHTML =
      r < 1.05
        ? `<strong>${esc(A.name)}</strong> y <strong>${esc(B.name)}</strong> tienen casi el mismo tamaño.`
        : `<strong>${esc(big.name)}</strong> es <strong>${times(r)}</strong> el tamaño de <strong>${esc(small.name)}</strong>. ${esc(small.name)} ocupa el ${pct((100 / r))} de ${esc(big.name)}.`;

    const dA = dims(A);
    const dB = dims(B);
    const row = (label: string, a: string, b: string, ratio?: number) =>
      `<tr><th scope="row">${label}</th><td>${a}</td><td>${b}</td><td>${ratio ? `${num1(ratio)}×` : ""}</td></tr>`;
    const max = Math.max(areaOf(A), areaOf(B));
    stats.innerHTML = `
      <div class="bars">
        ${[
          ["a", A],
          ["b", B],
        ]
          .map(
            ([slot, c]) => `<div class="bar-row"><span>${(c as Country).flag} ${esc((c as Country).name)}</span>
            <div class="bar"><i class="${slot}" style="width:${(areaOf(c as Country) / max) * 100}%"></i></div></div>`,
          )
          .join("")}
      </div>
      <table>
        <thead><tr><th></th><th><span class="swatch a"></span>${esc(A.name)}</th><th><span class="swatch b"></span>${esc(B.name)}</th><th>A/B</th></tr></thead>
        <tbody>
          ${row("Área", km2(areaOf(A)), km2(areaOf(B)), areaOf(A) / areaOf(B))}
          ${row("Ancho E–O", km(dA.width), km(dB.width), dA.width / dB.width)}
          ${row("Alto N–S", km(dA.height), km(dB.height), dA.height / dB.height)}
          ${row("Distancia más larga", km(dA.diameter), km(dB.diameter), dA.diameter / dB.diameter)}
          ${row("Del planeta", pct((areaOf(A) / LAND_AREA_KM2) * 100), pct((areaOf(B) / LAND_AREA_KM2) * 100))}
        </tbody>
      </table>
      <button class="btn" data-map>Ver ${esc(A.name)} sobre ${esc(B.name)} en el mapa</button>`;
  }

  let key = "";
  subscribe(() => {
    const k = `${state.compareA}|${state.compareB}|${state.compareFull}`;
    if (k === key) return;
    key = k;
    offsets.a = [0, 0];
    offsets.b = [0, 0];
    pickers.a.set(get(state.compareA));
    pickers.b.set(get(state.compareB));
    renderText();
    drawFigure();
  });
  new ResizeObserver(() => drawFigure()).observe(figure);
}
