const { test } = require('node:test');
const assert = require('node:assert');
const { createAndorraCollector } = require('../src/collector');
const { fetchStations, fetchPriceRows } = require('../src/fetch');
const {
  slugifyFuelName,
  normalizeCoordinate,
  groupRowsByStation,
  normalizeAndorraStations,
} = require('../src/normalize');
const { retry } = require('../src/retry');

const SILENT_LOGGER = { info() {}, warn() {}, debug() {} };

function sampleFeatures() {
  return [
    {
      attributes: {
        idIPE: 14,
        NOM: 'MEROIL River',
        Denominacio_distribuidor: 'ESTACIO ENCLAR CARBURANTS ANDORRANS',
        Codi_parroquia: 'AD600',
        Parroquia: 'Sant Julià de Lòria',
        Tipus_carburant: 'Gasolina sense plom 95 octans',
        PREU: 1.513,
        DataInici: 1787183940000,
        idProducte: 4,
      },
      centroid: { x: 1.4863772836809264, y: 42.455066801805977 },
    },
    {
      attributes: {
        idIPE: 14,
        NOM: 'MEROIL River',
        Denominacio_distribuidor: 'ESTACIO ENCLAR CARBURANTS ANDORRANS',
        Codi_parroquia: 'AD600',
        Parroquia: 'Sant Julià de Lòria',
        Tipus_carburant: 'Gasoil de locomoció',
        PREU: 1.667,
        DataInici: 1787183940000,
        idProducte: 6,
      },
      centroid: { x: 1.4863772836809264, y: 42.455066801805977 },
    },
    {
      attributes: {
        idIPE: 61,
        NOM: 'Garatge Oros',
        Denominacio_distribuidor: 'ANGELA MAS JOANIQUET',
        Codi_parroquia: 'AD200',
        Parroquia: 'Encamp',
        Tipus_carburant: 'Gasoil de calefacció domicili',
        PREU: 1.349,
        DataInici: 1786924800000,
        idProducte: 7,
      },
      centroid: { x: 1.583013826584048, y: 42.53677760943806 },
    },
  ];
}

test('slugifyFuelName lowercases and strips punctuation/accents-as-separators', () => {
  assert.equal(slugifyFuelName('Gasolina sense plom 95 octans'), 'gasolinasenseplom95octans');
  assert.equal(slugifyFuelName('AdBlue'), 'adblue');
});

test('normalizeCoordinate parses numeric and string values, rejects invalid ones', () => {
  assert.equal(normalizeCoordinate(1.58), 1.58);
  assert.equal(normalizeCoordinate('1.58'), 1.58);
  assert.throws(() => normalizeCoordinate('not-a-number'));
  assert.throws(() => normalizeCoordinate(undefined));
});

test('groupRowsByStation groups price rows by idIPE', () => {
  const grouped = groupRowsByStation(sampleFeatures());
  assert.equal(grouped.length, 2);

  const meroil = grouped.find((station) => station.idIPE === 14);
  assert.ok(meroil);
  assert.equal(meroil.name, 'MEROIL River');
  assert.equal(meroil.parish, 'Sant Julià de Lòria');
  assert.deepEqual(meroil.prices, {
    gasolinasenseplom95octans: 1.513,
    gasoildelocomoci: 1.667,
  });
});

test('normalizeAndorraStations builds the common station shape', () => {
  const stations = normalizeAndorraStations(sampleFeatures(), SILENT_LOGGER);
  assert.equal(stations.length, 2);

  const meroil = stations.find((station) => station.sourceStationId === '14');
  assert.equal(meroil.source, 'andorra');
  assert.equal(meroil.country, 'AD');
  assert.equal(meroil.name, 'MEROIL River');
  assert.equal(meroil.municipality, 'Sant Julià de Lòria');
  assert.equal(meroil.province, 'Andorra');
  assert.equal(meroil.postalCode, 'AD600');
  assert.deepEqual(meroil.location, {
    type: 'Point',
    coordinates: [1.4863772836809264, 42.455066801805977],
  });
  assert.equal(meroil.prices.gasolinasenseplom95octans, 1.513);
  assert.ok(meroil.lastUpdated instanceof Date);
});

test('normalizeAndorraStations skips stations without usable coordinates', () => {
  const features = [
    {
      attributes: {
        idIPE: 99,
        NOM: 'Broken station',
        Parroquia: 'Ordino',
        Tipus_carburant: 'GLP',
        PREU: 1.1,
        DataInici: 1700000000000,
      },
      centroid: null,
    },
  ];

  const stations = normalizeAndorraStations(features, SILENT_LOGGER);
  assert.equal(stations.length, 0);
});

test('fetchPriceRows throws on an ArcGIS error payload', async () => {
  const httpClient = {
    async get() {
      return { status: 200, data: { error: { message: 'Invalid query parameters.' } } };
    },
  };

  await assert.rejects(
    () => fetchPriceRows(httpClient, SILENT_LOGGER, 'https://example.test/query', 1000),
    /Andorra IPE query error/,
  );
});

test('fetchStations retries on failure and returns normalized stations', async () => {
  let calls = 0;
  const httpClient = {
    async get() {
      calls += 1;
      if (calls === 1) {
        throw new Error('network blip');
      }
      return { status: 200, data: { features: sampleFeatures() } };
    },
  };

  const progressUpdates = [];
  const stations = await fetchStations(
    { httpClient, logger: SILENT_LOGGER, retries: 2 },
    { reportProgress: (percent, meta) => progressUpdates.push({ percent, meta }) },
  );

  assert.equal(calls, 2);
  assert.equal(stations.length, 2);
  assert.equal(progressUpdates.at(-1).percent, 100);
});

test('createAndorraCollector matches the common collector contract', async () => {
  const httpClient = {
    async get() {
      return { status: 200, data: { features: sampleFeatures() } };
    },
  };

  const collector = createAndorraCollector({ httpClient, logger: SILENT_LOGGER });
  assert.equal(collector.name, 'andorra');
  assert.equal(collector.country, 'AD');
  assert.equal(typeof collector.fetch, 'function');

  const stations = await collector.fetch({});
  assert.equal(stations.length, 2);
});

test('retry gives up after exhausting attempts', async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      retry(
        async () => {
          calls += 1;
          throw new Error('always fails');
        },
        { retries: 2, minTimeoutMs: 1, logger: SILENT_LOGGER },
      ),
    /always fails/,
  );
  assert.equal(calls, 3);
});
