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
        const dates = [
            new Date().toISOString().split('T')[0],
            '2025-12-22',
            '2025-12-21'
        ];

        for (const date of dates) {
            console.log(`Checking date ${date}...`);
            const url = `https://www.nepalstock.com.np/api/nots/datewise-indices?indexId=${id}&startDate=${date}&endDate=${date}`;
            try {
                const response = await nepseAxios.get(url, { headers });
                console.log(`Result for ${date}:`, response.data.length, 'items');
                if (response.data.length > 0) {
                    console.log('Sample:', JSON.stringify(response.data[0]));
                }
            } catch (e) {
                console.log(`Error for ${date}:`, e.message);
            }
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
discover();
