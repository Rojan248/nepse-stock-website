async function discover() {
    try {
        const nepseModule = await import('nepse-api-helper');
        const nepseAxios = nepseModule.nepseAxios;
        const createHeaders = nepseModule.createHeaders;
        const nepseClient = nepseModule.nepseClient;
        await nepseClient.initialize({ useWasm: true });
        const token = await nepseClient.getToken();
        const headers = { ...createHeaders(token), 'Referer': 'https://nepalstock.com.np/' };

        const date = '2025-12-22';
        const url = `${nepseModule.BASE_URL}/api/nots/index/sub-indices?date=${date}`;
        console.log(`Testing ${url}...`);
        try {
            const response = await nepseAxios.get(url, { headers });
            console.log(`Success:`, response.data.length, 'items');
            if (response.data.length > 0) {
                console.log('Sample:', JSON.stringify(response.data[0]));
            }
        } catch (e) {
            console.log(`Failed:`, e.message, e.response?.data);
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
discover();
