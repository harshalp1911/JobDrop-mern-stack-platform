// Groq model used for every AI call. Override it with GROQ_MODEL in .env
// when Groq retires a model, without touching the code.
const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b';

const GROQ_MODEL = (process.env.GROQ_MODEL || '').trim() || DEFAULT_GROQ_MODEL;

module.exports = { GROQ_MODEL };
