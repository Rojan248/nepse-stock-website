async function discover() {
    try {
        const nepseModule = await import('nepse-api-helper');
        const nepseAxios = nepseModule.nepseAxios;
        const createHeaders = nepseModule.createHeaders;
        const nepseClient = nepseModule.nepseClient;
        await nepseClient.initialize({ useWasm: true });
        const token = await nepseClient.getToken();
        const headers = { ...createHeaders(token), 'Referer': 'https://nepalstock.com.np/' };

        const response = await nepseAxios.get(`${nepseModule.BASE_URL}/api/nots/index`, { headers });
        console.log('Banking Index sectorMaster:', JSON.stringify(response.data[0].sectorMaster, null, 2));

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
discover();
