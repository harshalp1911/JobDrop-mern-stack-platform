// Quick check that GROQ_API_KEY works and the interview model responds.
// Run from the server folder: npm run check:groq
require('dotenv').config();
const Groq = require('groq-sdk');

const MODEL = 'llama-3.3-70b-versatile'; // keep in sync with services/ai.js

async function main() {
  if (!process.env.GROQ_API_KEY) {
    console.error('GROQ_API_KEY is not set in server/.env');
    process.exit(1);
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  console.log(`Testing ${MODEL}...`);

  try {
    const completion = await groq.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: 'Say hello in one sentence.' }],
    });
    console.log('OK:', completion.choices[0].message.content);
  } catch (error) {
    console.error('Failed:', error.message.split('\n')[0]);
    process.exit(1);
  }
}

main();
