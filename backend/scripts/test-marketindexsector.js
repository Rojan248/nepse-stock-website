async function discover() {
    try {
        const nepseModule = await import('nepse-api-helper');
        const nepseAxios = nepseModule.nepseAxios;
        const createHeaders = nepseModule.createHeaders;
        const nepseClient = nepseModule.nepseClient;
        await nepseClient.initialize({ useWasm: true });
        const token = await nepseClient.getToken();
        const headers = { ...createHeaders(token), 'Referer': 'https://www.nepalstock.com.np/' };

        const ep = '/api/nots/market/index/sector';
        console.log(`Testing ${ep}...`);
        try {
            const response = await nepseAxios.get(`https://www.nepalstock.com.np${ep}`, { headers });
            console.log(`Success:`, response.data.length, 'items');
            if (response.data.length > 0) {
                console.log('Sample:', JSON.stringify(response.data[0]));
            }
        } catch (e) {
            console.log(`Failed:`, e.message, e.response?.status);
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
discover();
