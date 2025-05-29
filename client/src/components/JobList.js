import React from 'react';
import JobCard from './JobCard';

export default function JobList({ jobs }) {
  return (
    <div>
      <h3>Job Results</h3>
      {jobs.map(job => (
        <JobCard key={job.url} job={job} />
      ))}
    </div>
  );
}
