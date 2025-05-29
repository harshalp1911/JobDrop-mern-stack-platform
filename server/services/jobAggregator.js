const axios = require('axios');
const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST;
const RAPIDAPI_KEY  = process.env.RAPIDAPI_KEY;

const searchTermMap = {
  SDE:                   'software engineer',
  'Front-end':           'frontend developer',
  'AI/ML':               'machine learning engineer',
  'Full-Stack Developer':'full stack developer',
  'Backend Developer':   'backend developer',
};

async function fetchJobs(domains, location, postedWithin, jobTypes = ['fulltime']) {
  const hoursOld = (() => {
    const n = parseInt(postedWithin, 10) || 7;
    return postedWithin.endsWith('d') ? n * 24 : n;
  })();

  const allJobs = [];

  for (const domain of domains) {
    const keyword = searchTermMap[domain] || domain;
    for (const jobType of jobTypes) {
      const payload = {
        search_term:    keyword,
        location:       location || '',
        results_wanted: 20,
        site_name:      ['indeed','linkedin','zip_recruiter','glassdoor'],
        distance:       50,
        job_type:       jobType,
        is_remote:      false,
        linkedin_fetch_description: false,
        hours_old:      hoursOld,
      };
      const resp = await axios.request({
        method: 'POST',
        url:    `https://${RAPIDAPI_HOST}/getjobs`,
        headers: {
          'Content-Type':    'application/json',
          'x-rapidapi-host': RAPIDAPI_HOST,
          'x-rapidapi-key':  RAPIDAPI_KEY,
        },
        data: payload,
      });

      const jobsData = resp.data.data ?? resp.data.jobs ?? [];
      for (const job of jobsData) {
        allJobs.push({
          domain,
          jobType,
          title:      job.job_title    || job.title,
          company:    job.employer_name|| job.company,
          location:   job.job_city     || job.location,
          postedAt:   new Date(job.posted_at || job.date_posted || Date.now()),
          url:        job.job_link     || job.job_url,
          source:     job.job_site     || job.site,
          experience: job.experience_range || ''
        });
      }
    }
  }

  // fallback if none found
  if (allJobs.length === 0) {
    /* ... identical fallback logic ... */
  }

  // dedupe
  const seen = new Set();
  return allJobs.filter(j => {
    if (seen.has(j.url)) return false;
    seen.add(j.url);
    return true;
  });
}

module.exports = { fetchJobs };
