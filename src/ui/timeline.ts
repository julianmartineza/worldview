import { formatYear } from "../format";
import { historyYears } from "../geo/history";
import { setYear } from "../layer";
import { state, subscribe } from "../state";

/** Deslizador de época: los años del dataset y "Hoy" al final. */
export async function createTimeline(el: HTMLElement) {
  const years = await historyYears();
  const today = years.length;
  el.innerHTML = `
    <label for="era">Época</label>
    <div class="era-track">
      <input id="era" type="range" min="0" max="${today}" step="1" value="${today}">
      <div class="era-ends"><span>${formatYear(years[0])}</span><span>Hoy</span></div>
    </div>
    <output for="era" aria-live="polite">Hoy</output>
    <button class="ghost-btn" data-today hidden>Volver a hoy</button>`;
  const input = el.querySelector("input")!;
  const output = el.querySelector("output")!;
  const todayBtn = el.querySelector<HTMLButtonElement>("[data-today]")!;
  let timer = 0;

  const yearAt = (i: number) => (i >= today ? null : years[i]);
  const text = (y: number | null) => (y === null ? "Hoy" : formatYear(y));

  function show(i: number, loading = false) {
    const t = text(yearAt(i));
    output.textContent = loading ? `${t} · cargando…` : t;
    input.setAttribute("aria-valuetext", t);
  }

  input.addEventListener("input", () => {
    const i = Number(input.value);
    show(i, yearAt(i) !== state.year);
    clearTimeout(timer);
    // Espera a que el usuario suelte o se detenga antes de descargar el año
    timer = window.setTimeout(() => setYear(yearAt(i)), 160);
  });
  todayBtn.addEventListener("click", () => setYear(null));

  subscribe(() => {
    const i = state.year === null ? today : years.indexOf(state.year);
    if (Number(input.value) !== i && document.activeElement !== input) input.value = String(i);
    show(Number(input.value), yearAt(Number(input.value)) !== state.year);
    todayBtn.hidden = state.year === null;
    el.parentElement!.classList.toggle("historic", state.year !== null);
  });
}
