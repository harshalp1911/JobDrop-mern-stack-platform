// User-generated data (resumes and interviews) is deleted automatically
// after this many days to stay within free-tier storage limits.
// MongoDB's TTL monitor runs about once a minute, so deletion is not instant.
const DATA_RETENTION_DAYS = 20;
const DATA_RETENTION_SECONDS = DATA_RETENTION_DAYS * 24 * 60 * 60;

module.exports = { DATA_RETENTION_DAYS, DATA_RETENTION_SECONDS };
