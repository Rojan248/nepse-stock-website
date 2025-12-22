async function discover() {
    try {
        const nepseModule = await import('nepse-api-helper');
        const nepseAxios = nepseModule.nepseAxios;
        const createHeaders = nepseModule.createHeaders;
        const nepseClient = nepseModule.nepseClient;
        await nepseClient.initialize({ useWasm: true });
        const token = await nepseClient.getToken();
        const headers = createHeaders(token);

        const endpoints = [
            '/api/nots/index/sector',
            '/api/nots/indices/sector',
            '/api/nots/sector/indices',
            '/api/nots/sub-indices',
            '/api/nots/sub/indices',
            '/api/nots/market/index/sector',
            '/api/nots/market/indices',
            '/api/nots/market/sub-indices',
            '/api/nots/nepse-data/sector',
            '/api/nots/nepse-data/sub-index',
            '/api/nots/sectorwise-summary',
            '/api/nots/market-summary/sector',
            '/api/nots/nepse-index/sector'
        ];

        for (const ep of endpoints) {
            process.stdout.write(`Testing ${ep}... `);
            try {
                const response = await nepseAxios.get(`${nepseModule.BASE_URL}${ep}`, { headers });
                console.log(`SUCCESS [${response.data.length} items]`);
                if (response.data.length > 0) {
                    // console.log('Sample:', JSON.stringify(response.data[0]).slice(0, 100));
                }
            } catch (e) {
                console.log(`FAILED (${e.message})`);
            }
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
discover();
