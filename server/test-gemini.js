const Groq = require('groq-sdk');
require('dotenv').config();

async function testGroq() {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  
  try {
    console.log('Testing Groq API...');
    const models = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'];
    for (const m of models) {
      try {
        console.log(`Trying ${m}...`);
        const c = await groq.chat.completions.create({
          messages: [{ role: 'user', content: 'Say hello in one sentence' }],
          model: m,
        });
        console.log(`✅ ${m}:`, c.choices[0].message.content);
      } catch (e) {
        console.log(`❌ ${m}:`, e.message.split('\n')[0]);
      }
    }
  } catch (error) {
    console.error('❌ ERROR:', error.message);
  }
}

testGroq();
