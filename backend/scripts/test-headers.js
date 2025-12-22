async function discover() {
    try {
        const nepseModule = await import('nepse-api-helper');
        const nepseAxios = nepseModule.nepseAxios;
        const createHeaders = nepseModule.createHeaders;
        const nepseClient = nepseModule.nepseClient;
        await nepseClient.initialize({ useWasm: true });
        const token = await nepseClient.getToken();

        const axios = (await import('axios')).default;

        const headers = {
            ...createHeaders(token),
            'Referer': 'https://www.nepalstock.com.np/datewise-indices',
            'Origin': 'https://www.nepalstock.com.np',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        };

        const id = 51;
        const date = '2025-12-22';
        const url = `https://www.nepalstock.com.np/api/nots/datewise-indices?indexId=${id}&startDate=${date}&endDate=${date}`;
        console.log(`Testing URL: ${url}`);

        try {
            const res = await axios.get(url, { headers });
            console.log(`Success! Items:`, res.data.length);
            if (res.data.length > 0) {
                console.log('Sample:', JSON.stringify(res.data[0]));
            }
        } catch (e) {
            console.log(`Failed:`, e.message, e.response?.status);
            const url2 = `https://nepalstock.com.np/api/nots/datewise-indices?indexId=${id}&startDate=${date}&endDate=${date}`;
            try {
                const res2 = await axios.get(url2, { headers });
                console.log(`Success (No WWW)! Items:`, res2.data.length);
                if (res2.data.length > 0) {
                    console.log('Sample (No WWW):', JSON.stringify(res2.data[0]));
                }
            } catch (e2) {
                console.log(`Failed (No WWW):`, e2.message);
            }
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
discover();
