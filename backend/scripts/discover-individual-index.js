async function discover() {
    try {
        const nepseModule = await import('nepse-api-helper');
        const nepseAxios = nepseModule.nepseAxios;
        const createHeaders = nepseModule.createHeaders;
        const nepseClient = nepseModule.nepseClient;
        await nepseClient.initialize({ useWasm: true });
        const token = await nepseClient.getToken();
        const headers = createHeaders(token);

        const sectorIds = [51, 52, 53, 54, 55, 56, 59, 60, 61, 64, 65, 66, 67];
        const date = '2025-12-21'; // Last business date

        for (const id of sectorIds) {
            console.log(`Testing ID ${id}...`);
            // Try different patterns for individual index
            const patterns = [
                `/api/nots/index/sector/${id}`,
                `/api/nots/nepse-index/${id}`,
                `/api/nots/datewise-indices?indexId=${id}&startDate=${date}&endDate=${date}`
            ];

            for (const p of patterns) {
                try {
                    const response = await nepseAxios.get(`${nepseModule.BASE_URL}${p}`, { headers });
                    if (response.data) {
                        console.log(`SUCCESS [${id}] pattern ${p}: Found ${Array.isArray(response.data) ? response.data.length : 'object'} items`);
                        if (Array.isArray(response.data) && response.data.length > 0) {
                            console.log('Sample data:', JSON.stringify(response.data[0]));
                            break; // Found it!
                        } else if (!Array.isArray(response.data)) {
                            console.log('Sample data:', JSON.stringify(response.data));
                            break;
                        }
                    }
                } catch (e) {
                    // console.log(`Failed [${id}] pattern ${p}: ${e.message}`);
                }
            }
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
discover();
