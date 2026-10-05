type Pt = [number, number];

export interface GestureHandlers {
  /** Comienza un arrastre con un dedo o el ratón */
  down(p: Pt): void;
  move(p: Pt, dx: number, dy: number): void;
  /** `moved` es falso si fue un clic */
  up(p: Pt, moved: boolean): void;
  zoom(factor: number, center: Pt): void;
  hover(p: Pt | null): void;
}

/** Arrastre, clic, rueda y pellizco unificados sobre un elemento. */
export function attachGestures(el: HTMLElement, h: GestureHandlers) {
  const pointers = new Map<number, Pt>();
  let start: Pt = [0, 0];
  let last: Pt = [0, 0];
  let moved = false;
  let pinch = 0;
  el.style.touchAction = "none";

  const pos = (e: PointerEvent | WheelEvent): Pt => {
    const r = el.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const pinchState = () => {
    const [a, b] = [...pointers.values()];
    return {
      dist: Math.hypot(a[0] - b[0], a[1] - b[1]),
      mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as Pt,
    };
  };

  el.addEventListener("pointerdown", (e) => {
    el.setPointerCapture(e.pointerId);
    const p = pos(e);
    pointers.set(e.pointerId, p);
    if (pointers.size === 1) {
      start = last = p;
      moved = false;
      h.down(p);
    } else if (pointers.size === 2) {
      moved = true;
      pinch = pinchState().dist;
    }
  });

  el.addEventListener("pointermove", (e) => {
    const p = pos(e);
    if (!pointers.has(e.pointerId)) return h.hover(p);
    pointers.set(e.pointerId, p);
    if (pointers.size === 1) {
      if (Math.hypot(p[0] - start[0], p[1] - start[1]) > 4) moved = true;
      h.move(p, p[0] - last[0], p[1] - last[1]);
      last = p;
    } else if (pointers.size === 2) {
      const { dist, mid } = pinchState();
      if (pinch) h.zoom(dist / pinch, mid);
      pinch = dist;
    }
  });

  const end = (e: PointerEvent) => {
    if (!pointers.delete(e.pointerId)) return;
    if (pointers.size === 0) h.up(pos(e), moved);
    else if (pointers.size === 1) last = [...pointers.values()][0];
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
  el.addEventListener("pointerleave", () => pointers.size === 0 && h.hover(null));
  el.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      h.zoom(Math.exp(-e.deltaY * 0.0015), pos(e));
    },
    { passive: false },
  );
}
