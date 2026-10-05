import type { Ghost } from "./types";

export type ViewName = "globe" | "map" | "wall" | "compare";

export interface State {
  view: ViewName;
  selected: string | null;
  ghosts: Ghost[];
  projection: "equal" | "mercator";
  tissot: boolean;
  compareA: string | null;
  compareB: string | null;
  compareFull: boolean;
  /** Época mostrada: null = hoy */
  year: number | null;
}

export const state: State = {
  view: "globe",
  selected: null,
  ghosts: [],
  projection: "equal",
  tissot: false,
  compareA: null,
  compareB: null,
  compareFull: false,
  year: null,
};

const listeners = new Set<() => void>();

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setState(patch: Partial<State>) {
  Object.assign(state, patch);
  // Un suscriptor que falla no debe dejar a los demás sin actualizar
  listeners.forEach((fn) => {
    try {
      fn();
    } catch (err) {
      console.error(err);
    }
  });
}
