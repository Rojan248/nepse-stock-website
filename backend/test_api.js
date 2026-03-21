require('dotenv').config();

(async () => {
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const fallback = process.env.GEMINI_MODEL_FALLBACK || 'gemini-2.0-flash';
  const apiKey = process.env.GEMINI_API_KEY;

  for (const m of [model, fallback]) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Say hi in 3 words' }] }] })
      });
      console.log(`${m}: ${res.status} ${res.statusText}`);
      if (res.status !== 200) {
        const body = await res.text();
        console.log(`  Error: ${body.substring(0, 300)}`);
      } else {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        console.log(`  Response: ${text}`);
      }
    } catch(e) {
      console.log(`${m}: FETCH ERROR: ${e.message}`);
    }
  }
  process.exit(0);
})();
