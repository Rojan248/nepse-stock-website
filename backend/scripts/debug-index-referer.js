async function discover() {
    try {
        const nepseModule = await import('nepse-api-helper');
        const nepseAxios = nepseModule.nepseAxios;
        const createHeaders = nepseModule.createHeaders;
        const nepseClient = nepseModule.nepseClient;
        await nepseClient.initialize({ useWasm: true });
        const token = await nepseClient.getToken();
        const headers = {
            ...createHeaders(token),
            'Referer': 'https://www.nepalstock.com.np/',
            'Origin': 'https://www.nepalstock.com.np'
        };

        const id = 51; // Banking
        const today = '2025-12-21'; // Using a known good date first

        console.log(`Checking ID ${id} with Referer...`);
        const url = `https://www.nepalstock.com.np/api/nots/datewise-indices?indexId=${id}&startDate=${today}&endDate=${today}`;
        try {
            const response = await nepseAxios.get(url, { headers });
            console.log(`Result:`, response.data.length, 'items');
            if (response.data.length > 0) {
                console.log('Sample:', JSON.stringify(response.data[0]));
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
