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
        const start = '2025-12-15';
        const end = '2025-12-22';

        console.log(`Checking range ${start} to ${end} for ID ${id}...`);
        const url = `https://www.nepalstock.com.np/api/nots/datewise-indices?indexId=${id}&startDate=${start}&endDate=${end}`;
        try {
            const response = await nepseAxios.get(url, { headers });
            console.log(`Result:`, response.data.length, 'items');
            if (response.data.length > 0) {
                console.log('Last item:', JSON.stringify(response.data[response.data.length - 1]));
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
