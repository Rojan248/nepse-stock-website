const libraryFetcher = require('./src/services/scrapers/libraryFetcher');

async function run() {
    console.log("Starting debug fetch...");
    try {
        const data = await libraryFetcher.fetchData();
        console.log("Fetch result count:", data ? data.stocks.length : 'null');
    } catch (e) {
        console.error("Error:", e);
    }
}

run();
