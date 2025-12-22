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
            'Referer': 'https://www.nepalstock.com.np/datewise-indices',
            'Origin': 'https://www.nepalstock.com.np'
        };

        const id = 51;
        const date = '2025-12-22';
        const url = `https://www.nepalstock.com.np/api/nots/datewise-indices?indexId=${id}&startDate=${date}&endDate=${date}`;
        console.log(`Testing Today URL: ${url}`);
        try {
            const response = await nepseAxios.get(url, { headers });
            console.log(`SUCCESS! Items:`, response.data.length);
            if (response.data.length > 0) {
                console.log('Data:', JSON.stringify(response.data[0]));
            }
        } catch (e) {
            console.log(`Failed:`, e.message);
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
discover();
