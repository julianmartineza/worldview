# Tamaño real

Comparador interactivo del tamaño real de los países: globo 3D, mapa de áreas iguales
(Equal Earth ↔ Mercator), países arrastrables que conservan su área y comparación
a escala entre dos países.

## Uso

Node está instalado en `~/.local/node` (sin sudo). Para usarlo en la terminal:

```sh
export PATH="$HOME/.local/node/bin:$PATH"
npm install
npm run dev      # http://localhost:5173
npm test         # áreas y rotaciones
npm run build    # sitio estático en dist/
npm run data     # regenera public/data/ (descarga metadatos)
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
