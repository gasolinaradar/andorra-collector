function slugifyFuelName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, '');
}

function normalizeCoordinate(value) {
  if (value === null || value === undefined) {
    throw new Error('Missing coordinate value');
  }

  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid coordinate value: ${value}`);
  }

  return parsed;
}

function normalizePrice(value) {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function groupRowsByStation(rows) {
  const stationsById = new Map();

  for (const row of rows) {
    const attributes = row?.attributes;
    const idIPE = attributes?.idIPE;
    if (idIPE === undefined || idIPE === null) {
      continue;
    }

    if (!stationsById.has(idIPE)) {
      stationsById.set(idIPE, {
        idIPE,
        name: attributes.NOM || attributes.Denominacio_distribuidor || `Estació ${idIPE}`,
        parish: attributes.Parroquia || '',
        postalCode: attributes.Codi_parroquia || undefined,
        centroid: row.centroid,
        prices: {},
        lastUpdated: 0,
      });
    }

    const station = stationsById.get(idIPE);
    const fuelName = attributes.Tipus_carburant;
    const price = normalizePrice(attributes.PREU);
    if (fuelName && price !== null) {
      const slug = slugifyFuelName(fuelName);
      if (slug) {
        station.prices[slug] = price;
      }
    }

    if (typeof attributes.DataInici === 'number' && attributes.DataInici > station.lastUpdated) {
      station.lastUpdated = attributes.DataInici;
    }
  }

  return [...stationsById.values()];
}

function normalizeAndorraStation(station, logger = console) {
  if (!station.centroid) {
    logger.warn('Skipping Andorra station without coordinates', { idIPE: station.idIPE });
    return null;
  }

  let longitude;
  let latitude;
  try {
    longitude = normalizeCoordinate(station.centroid.x);
    latitude = normalizeCoordinate(station.centroid.y);
  } catch (error) {
    logger.warn('Skipping Andorra station with invalid coordinates', {
      idIPE: station.idIPE,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }

  const prices = Object.keys(station.prices).length > 0 ? station.prices : undefined;

  return {
    source: 'andorra',
    country: 'AD',
    sourceStationId: String(station.idIPE),
    name: station.name,
    address: undefined,
    municipality: station.parish,
    province: 'Andorra',
    postalCode: station.postalCode,
    schedule: undefined,
    services: undefined,
    location: {
      type: 'Point',
      coordinates: [longitude, latitude],
    },
    prices,
    lastUpdated: station.lastUpdated ? new Date(station.lastUpdated) : new Date(),
  };
}

function normalizeAndorraStations(rows, logger = console) {
  return groupRowsByStation(rows)
    .map((station) => normalizeAndorraStation(station, logger))
    .filter(Boolean);
}

module.exports = {
  slugifyFuelName,
  normalizeCoordinate,
  normalizePrice,
  groupRowsByStation,
  normalizeAndorraStation,
  normalizeAndorraStations,
};
