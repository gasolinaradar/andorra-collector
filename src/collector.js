const { fetchStations } = require('./fetch');

function createAndorraCollector(options = {}) {
  return {
    name: 'andorra',
    country: 'AD',
    async fetch(context = {}) {
      const reportProgress =
        typeof context?.reportProgress === 'function' ? context.reportProgress : () => {};
      return fetchStations(options, { reportProgress });
    },
  };
}

module.exports = {
  createAndorraCollector,
};
