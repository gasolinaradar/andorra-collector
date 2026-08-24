# @gasolinaradar/andorra-collector

<!-- EN -->

A Node.js collector for the **Govern d'Andorra fuel price service (IPE)**. It queries the public ArcGIS feature service that backs `sig.govern.ad/IPE/PreusCarburants` and returns a **normalized, ready-to-use** array of fuel stations with prices and coordinates.

<!-- ES -->

Collector de Node.js para el **servicio de precios de carburants del Govern d'Andorra (IPE)**. Consulta el servicio ArcGIS público que alimenta `sig.govern.ad/IPE/PreusCarburants` y devuelve un array de estaciones **normalizado y listo para usar** con precios y coordenadas.

---

## Features / Características

**EN:**

- Official Govern d'Andorra fuel price service (IPE), covering all 7 parishes.
- Single request to the public ArcGIS `CARBURANTS` feature service — no HTML scraping.
- Normalizes station name, parish, postal code, coordinates and per-fuel prices.
- Coordinates are requested pre-reprojected to WGS84 (`outSR=4326`) directly from the server.
- Prices are keyed by slugified fuel label (`Gasolina sense plom 95 octans` → `gasolinasenseplom95octans`).
- Built-in retry with exponential backoff.
- Injectable logger, HTTP client, and URL.
- Progress reporting hook for long runs.
- Zero configuration: works with sensible defaults.

**ES:**

- Servicio oficial de precios de carburantes del Govern d'Andorra (IPE), con las 7 parròquies.
- Una única petición al servicio ArcGIS público `CARBURANTS` — sin scraping de HTML.
- Normaliza nombre de estación, parròquia, código postal, coordenadas y precios por carburante.
- Las coordenadas se piden ya reproyectadas a WGS84 (`outSR=4326`) directamente desde el servidor.
- Los precios se indexan por etiqueta de carburante convertida a slug (`Gasolina sense plom 95 octans` → `gasolinasenseplom95octans`).
- Reintentos con backoff exponencial integrados.
- Logger, cliente HTTP y URL inyectables.
- Hook de reporte de progreso para ejecuciones largas.
- Cero configuración: funciona con valores por defecto sensatos.

---

## Installation / Instalación

```bash
npm install @gasolinaradar/andorra-collector
```

---

## Quick start / Inicio rápido

```js
const { fetchStations } = require('@gasolinaradar/andorra-collector');

async function main() {
  const stations = await fetchStations();
  console.log(`Fetched ${stations.length} fuel stations`);
  console.log(stations[0]);
}

main();
```

---

## API

### `fetchStations(options?) → Promise<Station[]>`

Queries the ArcGIS feature service and returns the normalized stations in one step.

```js
const { fetchStations } = require('@gasolinaradar/andorra-collector');

const stations = await fetchStations({
  logger: console,
  timeout: 15000,
  retries: 3,
});
```

### `createAndorraCollector(options?) → Collector`

Returns an object matching the common **collector contract** used by ingestion pipelines:

```js
{ name: 'andorra', country: 'AD', fetch(context) }
```

```js
const { createAndorraCollector } = require('@gasolinaradar/andorra-collector');

const andorraCollector = createAndorraCollector({
  logger,
});

const stations = await andorraCollector.fetch({
  reportProgress(percent, metadata = {}) {
    console.log(`${percent}%`, metadata);
  },
});
```

---

## Options / Opciones

| Option       | Type                     | Default | Description                                                              |
| ------------ | ------------------------ | ------- | ------------------------------------------------------------------------ |
| `url`        | `string \| () => string` | IPE FeatureServer query URL | Feature service query endpoint. As a function, it is evaluated on every fetch. |
| `timeout`    | `number`                 | `15000` | HTTP timeout in milliseconds.                                            |
| `retries`    | `number`                 | `3`     | Retry attempts for the request before failing.                          |
| `logger`     | `{ info, warn, debug }`  | `console` | Injectable logger.                                                    |
| `httpClient` | `{ get(url, opts) }`     | `axios` | Injectable HTTP client (useful for tests or custom TLS settings).      |

| Opción       | Tipo                      | Por defecto | Descripción                                                                |
| ------------ | ------------------------- | ----------- | -------------------------------------------------------------------------- |
| `url`        | `string \| () => string`  | URL de query del FeatureServer del IPE | Endpoint de consulta del feature service. Como función, se evalúa en cada fetch. |
| `timeout`    | `number`                  | `15000`     | Timeout HTTP en milisegundos.                                              |
| `retries`    | `number`                  | `3`         | Intentos de reintento de la petición antes de fallar.                      |
| `logger`     | `{ info, warn, debug }`   | `console`   | Logger inyectable.                                                         |
| `httpClient` | `{ get(url, opts) }`      | `axios`     | Cliente HTTP inyectable (útil en tests o para configuración TLS personalizada). |

---

## Output schema / Esquema de salida

Each normalized station looks like this / Cada estación normalizada tiene esta forma:

```js
{
  source: 'andorra',
  country: 'AD',
  sourceStationId: '14',
  name: 'MEROIL River',
  address: undefined,
  municipality: 'Sant Julià de Lòria',
  province: 'Andorra',
  postalCode: 'AD600',
  schedule: undefined,
  services: undefined,
  location: {
    type: 'Point',
    coordinates: [1.486377, 42.455067], // [longitude, latitude]
  },
  prices: {
    gasolinasenseplom95octans: 1.513,
    gasoildelocomoci: 1.667,
  },
  lastUpdated: Date,
}
```

Notes / Notas:

- Prices are keyed by slugified label and are `number`. When a station has no priced products, `prices` is `undefined`.
- Coordinates are `[longitude, latitude]` (GeoJSON order), requested from the server pre-reprojected to WGS84. Stations without usable coordinates are skipped (logged as warnings).
- `postalCode` is Andorra's parish-level postal code (`AD100`–`AD700`), taken directly from the source.
- `address`, `schedule` and `services` are not published by this feed and are always `undefined`.

---

## Progress reporting / Reporte de progreso

The collector accepts an optional `context.reportProgress(percent, metadata)` callback:

```js
const stations = await andorraCollector.fetch({
  reportProgress(percent, metadata) {
    // percent: 5   -> requesting the price rows
    // percent: 60  -> price rows received, normalizing
    // percent: 100 -> completed
    console.log(percent, metadata.stage);
  },
});
```

---

## Data source / Fuente de datos

**EN:** The data is the public fuel price service (IPE) of the **Govern d'Andorra**, Oficina de l'energia i del canvi climàtic:

**ES:** Los datos provienen del servicio público de precios de carburantes (IPE) del **Govern d'Andorra**, Oficina de l'energia i del canvi climàtic:

- `https://sig.govern.ad/IPE/PreusCarburants` (public page / página pública)
- `https://sig.govern.ad/server/rest/services/CARBURANTS/CARBURANTS/FeatureServer/1` (feature service used by this collector / feature service usado por este collector)

This project is **not affiliated with** the Govern d'Andorra. The data belongs to the Govern d'Andorra and is provided "as is". See the legal documents below.

Este proyecto **no está afiliado** al Govern d'Andorra. Los datos pertenecen al Govern d'Andorra y se proporcionan "tal cual". Consulta los documentos legales a continuación.

---

## Legal / Legal

**EN:**

- [LEGAL.md](./LEGAL.md) — Legal notice and disclaimer (bilingual).
- [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) — Data attribution and third-party licenses.
- [LICENSE](./LICENSE) — MIT License (applies to this software, **not** to the underlying Govern d'Andorra data).

**ES:**

- [LEGAL.md](./LEGAL.md) — Aviso legal y descargo de responsabilidad (bilingüe).
- [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) — Atribución de datos y licencias de terceros.
- [LICENSE](./LICENSE) — Licencia MIT (aplica a este software, **no** a los datos subyacentes del Govern d'Andorra).

---

## Tests

```bash
npm test           # unit tests (mocked HTTP)
npm run test:live  # live tests hitting the real ArcGIS feature service (network required)
```

---

## License / Licencia

**EN:** MIT. See [LICENSE](./LICENSE). The Govern d'Andorra data is **not** covered by this license.

**ES:** MIT. Consulta [LICENSE](./LICENSE). Los datos del Govern d'Andorra **no** están cubiertos por esta licencia.
