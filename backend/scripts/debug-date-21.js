async function discover() {
    try {
        const nepseModule = await import('nepse-api-helper');
        const nepseAxios = nepseModule.nepseAxios;
        const createHeaders = nepseModule.createHeaders;
        const nepseClient = nepseModule.nepseClient;
        await nepseClient.initialize({ useWasm: true });
        const token = await nepseClient.getToken();
        const headers = createHeaders(token);

        const id = 51; // Banking
        const date = '2025-12-21';

        console.log(`Checking date ${date} for ID ${id}...`);
        const url = `https://www.nepalstock.com.np/api/nots/datewise-indices?indexId=${id}&startDate=${date}&endDate=${date}`;
        try {
            const response = await nepseAxios.get(url, { headers });
            console.log(`Result for ${date}:`, response.data.length, 'items');
            if (response.data.length > 0) {
                console.log('Sample:', JSON.stringify(response.data[0]));
            } else {
                console.log('No data returned.');
            }
        } catch (e) {
            console.log(`Error:`, e.message);
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
discover();
