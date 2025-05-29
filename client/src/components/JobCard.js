import React from 'react';

export default function JobCard({ job }) {
  return (
    <div style={{
      background:     'white',
      border:         '1px solid #ddd',
      padding:        '1rem',
      margin:         '0.5rem 0',
      borderRadius:   4,
      boxShadow:      '0 1px 3px rgba(0,0,0,0.1)'
    }}>
      <h4 style={{ margin: '0 0 0.5rem' }}>
        <a href={job.url} target="_blank" rel="noopener noreferrer">
          {job.title}
        </a>
      </h4>
      <p style={{ margin: '0.25rem 0' }}>
        {job.company} — {job.location}
      </p>
      <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: '#555' }}>
        Posted: {new Date(job.postedAt).toLocaleDateString()}
      </p>
    </div>
  );
}
