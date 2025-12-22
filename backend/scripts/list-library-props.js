async function discover() {
    try {
        const nepseModule = await import('nepse-api-helper');
        const nepseClient = nepseModule.nepseClient;
        console.log('NepseClient Properties:', Object.getOwnPropertyNames(nepseClient));
        console.log('NepseClient Prototype Properties:', Object.getOwnPropertyNames(Object.getPrototypeOf(nepseClient)));

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
discover();
