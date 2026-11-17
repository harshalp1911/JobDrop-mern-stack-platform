// Fail fast at startup if required settings are missing, instead of
// crashing later on the first request that needs them.
const REQUIRED = ['MONGODB_URI', 'JWT_SECRET', 'GROQ_API_KEY'];
const OPTIONAL = ['GOOGLE_CLIENT_ID'];

const isPlaceholder = (value) => !value || value.startsWith('your_');

function checkEnv() {
  const missing = REQUIRED.filter((key) => isPlaceholder(process.env[key]));
  if (missing.length) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    console.error('Copy server/.env.example to server/.env and fill them in.');
    process.exit(1);
  }

  if (process.env.JWT_SECRET.length < 32) {
    console.warn('Warning: JWT_SECRET is short. Use at least 32 random characters.');
  }

  OPTIONAL.filter((key) => isPlaceholder(process.env[key])).forEach((key) => {
    console.warn(`Note: ${key} is not set; Google sign-in is disabled.`);
  });
}

module.exports = checkEnv;
