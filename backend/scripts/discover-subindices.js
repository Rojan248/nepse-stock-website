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
            '/api/nots/indices',
            '/api/nots/index/sector',
            '/api/nots/nepse-data/sub-indices',
            '/api/nots/nepse-data/indices'
        ];

        for (const ep of endpoints) {
            console.log(`Testing ${ep}...`);
            try {
                const response = await nepseAxios.get(`https://www.nepalstock.com.np${ep}`, { headers });
                console.log(`Success ${ep}:`, response.data.length, 'items');
                if (response.data.length > 0) {
                    console.log('Sample:', JSON.stringify(response.data[0], null, 2));
                }
            } catch (e) {
                console.log(`Failed ${ep}:`, e.message);
            }
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
discover();
