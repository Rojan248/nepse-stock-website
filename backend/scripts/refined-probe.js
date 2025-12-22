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
        const date = '2025-12-21';

        const variations = [
            `/api/nots/nepse-index/${id}`,
            `/api/nots/nepse-index?indexId=${id}`,
            `/api/nots/index/${id}`,
            `/api/nots/index?indexId=${id}`,
            `/api/nots/datewise-indices?indexId=${id}&startDate=${date}&endDate=${date}`,
            `/api/nots/market/index/${id}`,
            `/api/nots/market/indices/${id}`,
            `/api/nots/indices/${id}`,
            `/api/nots/index/sector/${id}`,
            `/api/nots/sectorwise-summary/${id}`
        ];

        for (const v of variations) {
            try {
                const response = await nepseAxios.get(`${nepseModule.BASE_URL}${v}`, { headers });
                console.log(`OK ${v}: ${JSON.stringify(response.data).slice(0, 50)}`);
            } catch (e) {
                console.log(`ERR ${v}: ${e.response?.status || e.message}`);
            }
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
discover();
