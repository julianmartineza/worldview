import { esc, formatYear, km2Short, label } from "../format";
import { FEATURED, featuredKey, resolveFeatured, type Featured } from "../geo/featured";
import { normalize, type World } from "../geo/load";
import { activeLayer } from "../layer";
import type { Country } from "../types";

type Result = { c: Country; f?: undefined } | { f: Featured; c?: undefined };

const featuredSearch = FEATURED.map((f) => ({ f, search: normalize(`${f.name} ${f.group} ${f.part ?? ""} ${f.year}`) }));

let uid = 0;

export function createSearch(
  el: HTMLElement,
  world: World,
  opts: { placeholder: string; label: string; onPick: (c: Country) => void },
) {
  const id = `search-${++uid}`;
  el.classList.add("search");
  el.innerHTML = `
    <input type="search" role="combobox" autocomplete="off" spellcheck="false"
      aria-label="${esc(opts.label)}" aria-controls="${id}" aria-expanded="false" aria-autocomplete="list"
      placeholder="${esc(opts.placeholder)}">
    <ul role="listbox" id="${id}" hidden></ul>`;
  const input = el.querySelector("input")!;
  const list = el.querySelector("ul")!;
  let results: Result[] = [];
  let active = 0;

  function find(q: string): Result[] {
    const n = normalize(q.trim());
    if (!n) return [];
    const L = activeLayer();
    const pool = L.year === null ? world.countries : [...world.countries, ...L.countries, ...L.parts];
    const found = pool
      .filter((c) => c.search.includes(n))
      .sort((a, b) => {
        const sa = normalize(a.name).startsWith(n) ? 0 : 1;
        const sb = normalize(b.name).startsWith(n) ? 0 : 1;
        return sa - sb || b.area - a.area;
      });
    const keys = new Set(found.map((c) => c.key));
    // Imperios destacados de otras épocas, sin descargar su año todavía
    const extra = featuredSearch
      .filter((x) => x.search.includes(n) && !keys.has(featuredKey(x.f)))
      .map((x) => ({ f: x.f }));
    return [...found.slice(0, 6).map((c) => ({ c })), ...extra].slice(0, 9);
  }

  function render() {
    list.hidden = results.length === 0;
    input.setAttribute("aria-expanded", String(!list.hidden));
    list.innerHTML = results
      .map(
        (r, i) =>
          `<li role="option" id="${id}-${i}" aria-selected="${i === active}" data-i="${i}">${
            r.c
              ? `<span>${r.c.flag} ${esc(label(r.c))}</span><small>${km2Short(r.c.officialArea ?? r.c.area)}</small>`
              : `<span>${esc(r.f.name)} (${formatYear(r.f.year)})</span><small>histórico</small>`
          }</li>`,
      )
      .join("");
    if (results.length) input.setAttribute("aria-activedescendant", `${id}-${active}`);
    else input.removeAttribute("aria-activedescendant");
  }

  async function pick(r: Result | undefined) {
    if (!r) return;
    results = [];
    render();
    const c = r.c ?? (await resolveFeatured(world, r.f));
    if (!c) return;
    input.value = label(c);
    opts.onPick(c);
  }

  input.addEventListener("input", () => {
    results = find(input.value);
    active = 0;
    render();
  });
  input.addEventListener("focus", () => input.select());
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!results.length) return;
      active = (active + (e.key === "ArrowDown" ? 1 : results.length - 1)) % results.length;
      render();
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(results[active]);
    } else if (e.key === "Escape") {
      results = [];
      render();
    }
  });
  list.addEventListener("pointerdown", (e) => {
    const li = (e.target as HTMLElement).closest("li");
    if (li) {
      e.preventDefault();
      pick(results[Number(li.dataset.i)]);
    }
  });
  input.addEventListener("blur", () => {
    results = [];
    render();
  });

  return {
    set(c: Country | null | undefined) {
      input.value = c ? label(c) : "";
    },
    focus() {
      input.focus();
    },
  };
}
