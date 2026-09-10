const axios = require('axios');
const { normalizeAndorraStations } = require('./normalize');
const { retry } = require('./retry');

const DEFAULT_ANDORRA_FEATURE_SERVER_URL =
  'https://sig.govern.ad/server/rest/services/CARBURANTS/CARBURANTS/FeatureServer/1/query';
const DEFAULT_TIMEOUT = 15000;
const DEFAULT_RETRIES = 3;
const OUT_FIELDS =
  'idIPE,NOM,Denominacio_distribuidor,Codi_parroquia,Parroquia,Tipus_carburant,PREU,DataInici,idProducte';

function resolveLogger(loggerOption) {
  return loggerOption && typeof loggerOption.info === 'function' ? loggerOption : console;
}

function resolveHttpClient(httpClientOption) {
  return httpClientOption && typeof httpClientOption.get === 'function' ? httpClientOption : axios;
}

function resolveUrl(urlOption, fallback) {
  const value = typeof urlOption === 'function' ? urlOption() : urlOption;
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

async function fetchPriceRows(httpClient, logger, url, timeout) {
  logger.info('Requesting Andorra IPE fuel price rows', { url });
  const response = await httpClient.get(url, {
    params: {
      where: '1=1',
      outFields: OUT_FIELDS,
      returnGeometry: false,
      returnCentroid: true,
      outSR: 4326,
      f: 'json',
    },
    timeout,
  });

  const data = response.data;
  if (data?.error) {
    throw new Error(`Andorra IPE query error: ${data.error.message || 'unknown'}`);
  }
  if (!data || !Array.isArray(data.features)) {
    throw new Error('Unexpected Andorra IPE response');
  }

  logger.info('Received Andorra IPE fuel price rows', {
    url,
    status: response.status,
    rowCount: data.features.length,
  });

  return data.features;
}

async function fetchStations(options = {}, hooks = {}) {
  const logger = resolveLogger(options.logger);
  const httpClient = resolveHttpClient(options.httpClient);
  const url = resolveUrl(options.url, DEFAULT_ANDORRA_FEATURE_SERVER_URL);
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  const retries = options.retries ?? DEFAULT_RETRIES;
  const reportProgress =
    typeof hooks.reportProgress === 'function' ? hooks.reportProgress : () => {};

  logger.info('Starting Andorra IPE collector fetch');
  reportProgress(5, { stage: 'fetching_price_rows' });
  const rows = await retry(() => fetchPriceRows(httpClient, logger, url, timeout), {
    retries,
    minTimeoutMs: 1000,
    logger,
  });
  reportProgress(60, { stage: 'price_rows_received', rowCount: rows.length });

  let stations;
  try {
    stations = normalizeAndorraStations(rows, logger);
  } catch (err) {
    logger.warn('Andorra normalization failed entirely; returning empty batch', {
      error: err.message,
    });
    stations = [];
  }

  reportProgress(100, { stage: 'completed', stationCount: stations.length });
  return stations;
}

module.exports = {
  fetchStations,
  fetchPriceRows,
  DEFAULT_ANDORRA_FEATURE_SERVER_URL,
};
