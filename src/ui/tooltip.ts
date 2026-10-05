import { esc, km2Short } from "../format";
import type { Country } from "../types";

export type Tooltip = ReturnType<typeof createTooltip>;

export function createTooltip(el: HTMLElement) {
  return {
    show(c: Country, [x, y]: [number, number]) {
      el.innerHTML = `<strong>${c.flag} ${esc(c.name)}</strong><span>${km2Short(c.officialArea ?? c.area)}</span>`;
      el.hidden = false;
      const host = el.parentElement!.getBoundingClientRect();
      const left = Math.min(x + 14, host.width - el.offsetWidth - 8);
      const top = y + 16 + el.offsetHeight > host.height ? y - el.offsetHeight - 10 : y + 16;
      el.style.transform = `translate(${left}px, ${top}px)`;
    },
    hide() {
      el.hidden = true;
    },
  };
}
