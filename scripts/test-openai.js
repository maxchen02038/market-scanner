/*
 * test-openai.js
 * One tiny call to OpenAI to verify the OPENAI_KEY secret actually works.
 * Prints a clear diagnosis so we know whether to build on it.
 */

const KEY = process.env.OPENAI_KEY;

if (!KEY) {
  console.error('FAIL: OPENAI_KEY secret is not set (or is named differently).');
  console.error('   Fix: Settings > Secrets and variables > Actions > New repository secret');
  console.error('   Name it exactly: OPENAI_KEY');
  process.exit(1);
}

console.log('Key found. Length:', KEY.length, '| starts with:', KEY.slice(0, 7) + '...');

async function main() {
  let res;
  try {
    res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + KEY,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
        max_tokens: 5,
      }),
    });
  } catch (err) {
    console.error('FAIL: Could not reach api.openai.com at all.');
    console.error('   Error:', err.message);
    process.exit(1);
  }

  const text = await res.text();

  if (res.ok) {
    let reply = '(could not parse)';
    try { reply = JSON.parse(text).choices?.[0]?.message?.content ?? reply; } catch {}
    console.log('');
    console.log('SUCCESS — this is a working OpenAI key.');
    console.log('   Model replied:', reply);
    console.log('   We can build the AI scout on GitHub Actions as planned.');
    return;
  }

  // Not ok — diagnose the common cases
  console.error('');
  console.error('FAIL: OpenAI rejected the request. HTTP', res.status);
  console.error('   Response:', text.slice(0, 400));
  console.error('');

  if (res.status === 401) {
    console.error('   Diagnosis: 401 = invalid key for api.openai.com.');
    console.error('   This strongly suggests the key belongs to a DIFFERENT server');
    console.error('   (e.g. the local 10.200.210.26 endpoint), not OpenAI itself.');
  } else if (res.status === 429) {
    console.error('   Diagnosis: 429 = the key is valid but out of quota/credits.');
    console.error('   Add billing at platform.openai.com, then re-run.');
  } else if (res.status === 404) {
    console.error('   Diagnosis: 404 = key works but model "gpt-4o-mini" is unavailable to it.');
    console.error('   Tell me and I will try a different model name.');
  }
  process.exit(1);
}

main();
