export interface CanvasHandle {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  size: { w: number; h: number };
}

/** Canvas nítido en pantallas retina que sigue el tamaño de su contenedor. */
export function makeCanvas(el: HTMLElement, onResize: () => void): CanvasHandle {
  const canvas = document.createElement("canvas");
  el.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;
  const size = { w: 0, h: 0 };
  new ResizeObserver(() => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const dpr = window.devicePixelRatio || 1;
    size.w = r.width;
    size.h = r.height;
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    canvas.style.width = `${r.width}px`;
    canvas.style.height = `${r.height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    onResize();
  }).observe(el);
  return { canvas, ctx, size };
}

export interface Palette {
  ocean: string;
  land: string;
  landStroke: string;
  grat: string;
  hover: string;
  select: string;
  text: string;
  halo: string;
  tissot: string;
  shade: string;
}

let cached: Palette | null = null;
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => (cached = null));

export function palette(): Palette {
  if (cached) return cached;
  const s = getComputedStyle(document.documentElement);
  const v = (n: string) => s.getPropertyValue(n).trim();
  cached = {
    ocean: v("--ocean"),
    land: v("--land"),
    landStroke: v("--land-stroke"),
    grat: v("--grat"),
    hover: v("--hover"),
    select: v("--select"),
    text: v("--text"),
    halo: v("--bg"),
    tissot: v("--tissot"),
    shade: v("--shade"),
  };
  return cached;
}

/** Programa un único redibujado por cuadro. */
export function scheduler(draw: () => void) {
  let pending = false;
  return () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      draw();
    });
  };
}

export const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
