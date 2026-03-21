require('dotenv').config();

(async () => {
  const keys = process.env.GEMINI_API_KEYS.split(',').map(k => k.trim());
  const model = 'gemini-2.0-flash';

  for (let i = 0; i < keys.length; i++) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${keys[i]}`;
    console.log(`\n=== Key ${i + 1} (${keys[i].substring(0, 12)}...) ===`);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Say OK' }] }] })
      });
      console.log(`Status: ${res.status}`);
      const body = await res.text();
      console.log(`Full response: ${body}`);
    } catch(e) {
      console.log(`Fetch error: ${e.message}`);
    }
  }
  process.exit(0);
})();
