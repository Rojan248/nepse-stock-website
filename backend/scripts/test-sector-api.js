async function discover() {
    try {
        const nepseModule = await import('nepse-api-helper');
        const nepseAxios = nepseModule.nepseAxios;
        const createHeaders = nepseModule.createHeaders;
        const nepseClient = nepseModule.nepseClient;
        await nepseClient.initialize({ useWasm: true });
        const token = await nepseClient.getToken();
        const headers = createHeaders(token);

        const endpoint = '/api/nots/market/sectorwise-summary';
        console.log(`Testing ${endpoint}...`);
        try {
            const response = await nepseAxios.get(`${nepseModule.BASE_URL}${endpoint}`, { headers });
            console.log(`Success:`, response.data.length, 'items');
            if (response.data.length > 0) {
                console.log('Sample indices:', response.data.map(idx => idx.sectorName).join(', '));
                console.log('Full first item:', JSON.stringify(response.data[0], null, 2));
            }
        } catch (e) {
            console.log(`Failed:`, e.message);
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
discover();
