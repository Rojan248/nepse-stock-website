async function discover() {
    try {
        const nepseModule = await import('nepse-api-helper');
        const nepseAxios = nepseModule.nepseAxios;
        const createHeaders = nepseModule.createHeaders;
        const nepseClient = nepseModule.nepseClient;
        await nepseClient.initialize({ useWasm: true });
        const token = await nepseClient.getToken();
        const headers = { ...createHeaders(token), 'Referer': 'https://www.nepalstock.com.np/' };

        const id = 51;
        const params = ['sectorId', 'subIndexId', 'id', 'category', 'index'];

        for (const p of params) {
            const url = `https://www.nepalstock.com.np/api/nots/nepse-index?${p}=${id}`;
            console.log(`Testing ${url}...`);
            try {
                const response = await nepseAxios.get(url, { headers });
                console.log(`Success ${p}:`, response.data.length, 'items');
                if (response.data.length > 0 && response.data[0].id == id) {
                    console.log('FOUND IT!');
                }
            } catch (e) {
                // console.log(`Failed ${p}:`, e.message);
            }
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
discover();
