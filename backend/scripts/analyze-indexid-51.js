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
        const url = `https://www.nepalstock.com.np/api/nots/nepse-index?indexId=${id}`;
        const response = await nepseAxios.get(url, { headers });
        console.log(`Results for indexId=${id}:`, response.data.length, 'items');
        response.data.forEach(idx => {
            console.log(`- ${idx.id}: ${idx.index} (${idx.currentValue})`);
        });

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
discover();
