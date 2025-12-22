async function discover() {
    try {
        const nepseModule = await import('nepse-api-helper');
        const nepseClient = nepseModule.nepseClient;
        await nepseClient.initialize({ useWasm: true });

        console.log('Fetching via library...');
        const indices = await nepseClient.getNepseIndex();
        console.log('Total indices returned:', indices.length);
        console.log('Index Names:', indices.map(i => i.index).join(', '));

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
discover();
