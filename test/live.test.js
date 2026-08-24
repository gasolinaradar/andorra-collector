const { test } = require('node:test');
const assert = require('node:assert');
const { fetchStations } = require('../src/fetch');

test('fetchStations returns real, normalized Andorra fuel stations', async () => {
  const stations = await fetchStations({ logger: { info() {}, warn() {}, debug() {} } });

  assert.ok(Array.isArray(stations));
  assert.ok(stations.length > 0, 'expected at least one Andorra fuel station');

  const station = stations[0];
  assert.equal(station.source, 'andorra');
  assert.equal(station.country, 'AD');
  assert.equal(typeof station.sourceStationId, 'string');
  assert.equal(typeof station.name, 'string');
  assert.ok(Array.isArray(station.location.coordinates));
  const [longitude, latitude] = station.location.coordinates;
  assert.ok(longitude > 1 && longitude < 2, 'longitude should fall within Andorra');
  assert.ok(latitude > 42 && latitude < 43, 'latitude should fall within Andorra');
});
