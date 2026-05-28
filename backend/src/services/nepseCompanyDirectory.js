const { getOrdinaryShareSymbols, normalizeSymbol } = require('./dataEnricher');

async function fetchOfficialCompanyList() {
    const { nepseClient, nepseAxios, createHeaders, BASE_URL } = await import('nepse-api-helper');

    await nepseClient.initialize({ useWasm: true });
    const token = await nepseClient.getToken();
    const headers = createHeaders(token);
    const response = await nepseAxios.get(`${BASE_URL}/api/nots/company/list`, {
        headers,
        timeout: 20000
    });

    return Array.isArray(response.data) ? response.data : [];
}

function buildCompanyMap(companyList) {
    return new Map(
        (companyList || [])
            .map(company => [normalizeSymbol(company.symbol), company])
            .filter(([symbol]) => symbol)
    );
}

function buildOrdinaryShareMap(companyList) {
    const symbols = getOrdinaryShareSymbols(companyList);
    const companyMap = buildCompanyMap(companyList);

    return new Map(
        Array.from(symbols)
            .map(symbol => [symbol, companyMap.get(symbol)])
            .filter(([, company]) => company)
    );
}

module.exports = {
    fetchOfficialCompanyList,
    buildCompanyMap,
    buildOrdinaryShareMap
};
