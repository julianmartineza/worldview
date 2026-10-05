# Tamaño real

Comparador interactivo del tamaño real de los países: globo 3D, mapa de áreas iguales
(Equal Earth ↔ Mercator), países arrastrables que conservan su área y comparación
a escala entre dos países. La pestaña «A escala» muestra todos los países juntos, a la misma
escala y sin distorsión, ordenados por tamaño, continente o nombre. El control de **época**
muestra las fronteras de 48 momentos, del 2000 a. C. a 2010, y permite medir, mover y comparar
imperios (mongol, romano, inca, español, británico, la URSS…) contra los países de hoy.

## Uso

Node está instalado en `~/.local/node` (sin sudo). Para usarlo en la terminal:

```sh
export PATH="$HOME/.local/node/bin:$PATH"
npm install
npm run dev      # http://localhost:5173
npm test         # áreas y rotaciones
npm run build    # sitio estático en dist/
npm run data     # regenera public/data/ (descarga metadatos)
npm run history  # regenera public/data/history/ (fronteras históricas)
```

## Cómo funciona

- Las áreas se calculan sobre la esfera (`d3.geoArea` × R², R = 6.371 km), no en píxeles.
- Mover un país es una rotación de la esfera (`src/geo/rotate.ts`): conserva forma y área.
  Por eso en Mercator el país crece o se encoge al cambiar de latitud.
- La comparación proyecta cada país con una azimutal de áreas iguales centrada en él,
  con la misma escala en km para ambos.

Datos: Natural Earth 1:50 m (vía `world-atlas`) y `mledoze/countries` para nombres en
español y áreas oficiales. Algunas cifras oficiales difieren del polígono: Francia incluye
la Guayana en el mapa pero no en la cifra; India reclama territorio que Natural Earth
dibuja con la frontera de facto.

Fronteras históricas: [historical-basemaps](https://github.com/aourednik/historical-basemaps)
(A. Ourednik), GPL-3.0. Son aproximadas, sobre todo antes de 1648, y el dataset mezcla estados
con pueblos sin estado; la app distingue estos últimos y no los compara como países. Los
imperios agrupan a sus colonias y vasallos según el campo `SUBJECTO` del dataset.

## Licencia

GPL-3.0-or-later. Ver `LICENSE`.
