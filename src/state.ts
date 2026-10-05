import type { Ghost } from "./types";

export type ViewName = "globe" | "map" | "compare";

export interface State {
  view: ViewName;
  selected: string | null;
  ghosts: Ghost[];
  projection: "equal" | "mercator";
  tissot: boolean;
  compareA: string | null;
  compareB: string | null;
  compareFull: boolean;
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
};

const listeners = new Set<() => void>();

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setState(patch: Partial<State>) {
  Object.assign(state, patch);
  listeners.forEach((fn) => fn());
}
