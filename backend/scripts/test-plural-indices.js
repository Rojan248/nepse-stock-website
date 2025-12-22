async function discover() {
    try {
        const nepseModule = await import('nepse-api-helper');
        const nepseAxios = nepseModule.nepseAxios;
        const createHeaders = nepseModule.createHeaders;
        const nepseClient = nepseModule.nepseClient;
        await nepseClient.initialize({ useWasm: true });
        const token = await nepseClient.getToken();
        const headers = createHeaders(token);

        const ep = '/api/nots/indices';
        console.log(`Testing ${ep}...`);
        try {
            const response = await nepseAxios.get(`${nepseModule.BASE_URL}${ep}`, { headers });
            console.log(`Success:`, Array.isArray(response.data) ? response.data.length : 'Not an array');
            if (response.data && response.data.length > 0) {
                console.log('Names:', response.data.map(i => i.index || i.indexName).join(', '));
                console.log('Sample:', JSON.stringify(response.data[0], null, 2));
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
