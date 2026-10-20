export type Lang = "es" | "en";

const KEY = "lang";

function detect(): Lang {
  if (typeof location === "undefined") return "es";
  const q = new URLSearchParams(location.search).get(KEY);
  if (q === "es" || q === "en") return q;
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "es" || saved === "en") return saved;
  } catch {
    // Sin almacenamiento: se decide por el navegador
  }
  return navigator.language.toLowerCase().startsWith("es") ? "es" : "en";
}

/** Idioma de la sesión; cambiarlo recarga la página, así que es fijo durante la ejecución. */
export const lang: Lang = detect();

export const tr = (es: string, en: string) => (lang === "en" ? en : es);

/** Traduce el HTML estático: el texto inglés va en data-en y los atributos en data-en-<attr>. */
export function translateDocument() {
  document.documentElement.lang = lang;
  if (lang === "es") return;
  for (const el of document.querySelectorAll<HTMLElement>("*")) {
    for (const { name, value } of [...el.attributes]) {
      if (name === "data-en") el.textContent = value;
      else if (name.startsWith("data-en-")) el.setAttribute(name.slice(8), value);
    }
  }
}

/** Guarda la preferencia y recarga con el nuevo idioma en la URL. */
export function switchLang(to: Lang) {
  if (to === lang) return;
  try {
    localStorage.setItem(KEY, to);
  } catch {
    // La URL basta para esta visita
  }
  const url = new URL(location.href);
  url.searchParams.set(KEY, to);
  location.assign(url);
}
