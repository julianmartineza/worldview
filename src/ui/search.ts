import { esc, km2Short } from "../format";
import { normalize, type World } from "../geo/load";
import type { Country } from "../types";

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
  let results: Country[] = [];
  let active = 0;

  function find(q: string) {
    const n = normalize(q.trim());
    if (!n) return [];
    return world.countries
      .filter((c) => c.search.includes(n))
      .sort((a, b) => {
        const sa = normalize(a.name).startsWith(n) ? 0 : 1;
        const sb = normalize(b.name).startsWith(n) ? 0 : 1;
        return sa - sb || b.area - a.area;
      })
      .slice(0, 8);
  }

  function render() {
    list.hidden = results.length === 0;
    input.setAttribute("aria-expanded", String(!list.hidden));
    list.innerHTML = results
      .map(
        (c, i) =>
          `<li role="option" id="${id}-${i}" aria-selected="${i === active}" data-i="${i}">
            <span>${c.flag} ${esc(c.name)}</span><small>${km2Short(c.officialArea ?? c.area)}</small></li>`,
      )
      .join("");
    if (results.length) input.setAttribute("aria-activedescendant", `${id}-${active}`);
    else input.removeAttribute("aria-activedescendant");
  }

  function pick(c: Country | undefined) {
    if (!c) return;
    input.value = c.name;
    results = [];
    render();
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
      input.value = c?.name ?? "";
    },
    focus() {
      input.focus();
    },
  };
}
