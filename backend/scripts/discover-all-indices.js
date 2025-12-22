async function discover() {
    try {
        const nepseModule = await import('nepse-api-helper');
        const nepseClient = nepseModule.nepseClient;
        const nepseAxios = nepseModule.nepseAxios;
        const createHeaders = nepseModule.createHeaders;
        const BASE_URL = nepseModule.BASE_URL;

        await nepseClient.initialize({ useWasm: true });
        const token = await nepseClient.getToken();
        const headers = createHeaders(token);

        console.log('Fetching all indices...');
        const response = await nepseAxios.get(`${BASE_URL}/api/nots/nepse-index`, { headers });
        console.log('Indices count:', response.data.length);
        console.log('Indices list:', response.data.map(idx => `${idx.id}: ${idx.index}`).join(', '));

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
discover();
