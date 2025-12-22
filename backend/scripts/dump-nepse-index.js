async function discover() {
    try {
        const nepseModule = await import('nepse-api-helper');
        const nepseClient = nepseModule.nepseClient;
        await nepseClient.initialize({ useWasm: true });

        const indices = await nepseClient.getNepseIndex();
        console.log('Total Indices Found:', indices.length);
        console.log('Indices:', JSON.stringify(indices, null, 2));

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
discover();
