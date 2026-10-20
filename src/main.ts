import "./styles.css";
import { lang, switchLang, translateDocument, tr, type Lang } from "./i18n";
import { loadWorld } from "./geo/load";
import { setState, state, subscribe, type ViewName } from "./state";
import { createGhostList } from "./ui/ghostList";
import { createInfoPanel } from "./ui/infoPanel";
import { FEATURED, featuredKey, resolveFeatured } from "./geo/featured";
import { initLayer, setYear } from "./layer";
import { EMPIRE_PRESETS, PRESETS, renderPresets, type Preset } from "./ui/presets";
import { createTimeline } from "./ui/timeline";
import { createSearch } from "./ui/search";
import { createTooltip } from "./ui/tooltip";
import { createCompare } from "./views/compare";
import { createGlobe } from "./views/globe";
import { createMap } from "./views/equalArea";
import { createWall } from "./views/wall";
import { addGhost } from "./views/truesize";

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

translateDocument();
document.querySelectorAll<HTMLButtonElement>(".lang [data-lang]").forEach((b) => {
  b.setAttribute("aria-pressed", String(b.dataset.lang === lang));
  b.addEventListener("click", () => {
    saveCarry();
    switchLang(b.dataset.lang as Lang);
  });
});

// Lo que se está viendo sobrevive a la recarga que hace el cambio de idioma
const CARRY = "carry";
type Carry = Pick<typeof state, "view" | "selected" | "year" | "projection" | "compareA" | "compareB">;

function saveCarry() {
  const { view, selected, year, projection, compareA, compareB } = state;
  try {
    sessionStorage.setItem(CARRY, JSON.stringify({ view, selected, year, projection, compareA, compareB }));
  } catch {
    // Se empieza de cero en el otro idioma
  }
}

function takeCarry(): Carry | null {
  try {
    const raw = sessionStorage.getItem(CARRY);
    sessionStorage.removeItem(CARRY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function main() {
  const world = await loadWorld();
  initLayer(world);
  $("#loading").remove();

  const tooltip = createTooltip($("#tooltip"));
  const globe = createGlobe($("#view-globe"), world, tooltip);
  createMap($("#view-map"), world, tooltip);
  createWall($("#view-wall"), world, tooltip);
  createCompare($("#view-compare"), world, {
    showOnMap(a, b) {
      setState({ ghosts: [] });
      addGhost(world, a, world.byKey.get(b)!.anchor);
      setState({ view: "map", selected: b });
    },
  });

  const search = createSearch($("#search"), world, {
    label: tr("Buscar país", "Search country"),
    placeholder: tr("Busca un país…", "Search a country…"),
    onPick: async (c) => {
      // Una entidad histórica se muestra en su época
      if (c.year !== undefined && c.year !== state.year && state.view !== "compare") await setYear(c.year);
      setState({ selected: c.key });
      if (state.view === "globe") globe.flyTo(c.anchor);
    },
  });

  createInfoPanel($("#info"), world, {
    move(key) {
      const c = world.byKey.get(key)!;
      // Aparece desplazado para que se distinga del original
      addGhost(world, key, [c.anchor[0] + 15, c.anchor[1] > 60 ? c.anchor[1] - 15 : c.anchor[1]]);
      if (state.view !== "globe" && state.view !== "map") setState({ view: "map" });
    },
    compare(key) {
      setState({ compareA: key, view: "compare" });
    },
  });
  createGhostList($("#ghosts"), world);

  async function resolve(ref: string) {
    if (!ref.startsWith("h")) return world.byIso3.get(ref);
    const f = FEATURED.find((x) => featuredKey(x) === ref);
    return f ? resolveFeatured(world, f) : undefined;
  }

  async function applyPreset(p: Preset) {
    const [from, to] = await Promise.all([resolve(p.from), resolve(p.to)]);
    if (!from || !to) return;
    if (p.kind === "compare") return setState({ compareA: from.key, compareB: to.key, view: "compare" });
    // Los países actuales se ven en Mercator para notar la distorsión; los imperios, con áreas reales
    const historic = from.year !== undefined;
    await setYear(null);
    setState({ ghosts: [] });
    addGhost(world, from.key, to.anchor);
    setState({
      view: "map",
      projection: historic ? "equal" : "mercator",
      selected: from.key,
      compareA: from.key,
      compareB: to.key,
    });
  }

  renderPresets($("#presets"), PRESETS, applyPreset);
  renderPresets($("#presets-history"), EMPIRE_PRESETS, applyPreset);
  createTimeline($("#timeline"));

  document.querySelectorAll<HTMLButtonElement>(".tabs [data-view]").forEach((b) =>
    b.addEventListener("click", () => setState({ view: b.dataset.view as ViewName })),
  );

  subscribe(() => {
    document.querySelectorAll<HTMLButtonElement>(".tabs [data-view]").forEach((b) =>
      b.setAttribute("aria-selected", String(b.dataset.view === state.view)),
    );
    document.querySelectorAll<HTMLElement>(".view").forEach((v) => (v.hidden = v.id !== `view-${state.view}`));
    $(".app").dataset.view = state.view;
    if (!state.selected) search.set(null);
    else search.set(world.byKey.get(state.selected));
  });

  const col = world.byIso3.get("COL");
  const esp = world.byIso3.get("ESP");
  setState({ compareA: col?.key ?? null, compareB: esp?.key ?? null });

  const carry = takeCarry();
  if (carry) {
    if (carry.year !== null) await setYear(carry.year);
    // Las entidades de otras épocas solo existen si su año ya se cargó
    const known = (k: string | null) => (k && world.byKey.has(k) ? k : null);
    setState({
      view: carry.view,
      projection: carry.projection,
      selected: known(carry.selected),
      compareA: known(carry.compareA) ?? state.compareA,
      compareB: known(carry.compareB) ?? state.compareB,
    });
  }
}

main().catch((err) => {
  console.error(err);
  $("#loading").textContent = tr("No se pudieron cargar los datos del mapa.", "Could not load the map data.");
});
