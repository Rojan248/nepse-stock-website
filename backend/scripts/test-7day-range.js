async function discover() {
    try {
        const nepseModule = await import('nepse-api-helper');
        const nepseAxios = nepseModule.nepseAxios;
        const createHeaders = nepseModule.createHeaders;
        const nepseClient = nepseModule.nepseClient;
        await nepseClient.initialize({ useWasm: true });
        const token = await nepseClient.getToken();

        // Use library's native agent and headers if possible
        const headers = {
            ...createHeaders(token),
            'Referer': 'https://nepalstock.com.np/'
        };

        const id = 51;
        // Search last 7 days to be safe
        const end = new Date().toISOString().split('T')[0];
        const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const url = `${nepseModule.BASE_URL}/api/nots/datewise-indices?indexId=${id}&startDate=${start}&endDate=${end}`;
        console.log(`Testing Range URL: ${url}`);

        try {
            const response = await nepseAxios.get(url, { headers });
            console.log(`Success! Items:`, response.data.length);
            if (response.data.length > 0) {
                // Sort by date descending
                const latest = response.data.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
                console.log('Latest Item:', JSON.stringify(latest));
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
