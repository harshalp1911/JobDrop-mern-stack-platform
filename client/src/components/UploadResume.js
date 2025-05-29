// src/components/UploadResume.js
import React, { useState } from 'react';
import axios from 'axios';
import JobList from './JobList';
import Filters from './Filters';

export default function UploadResume() {
  const [file, setFile]                       = useState(null);
  const [message, setMessage]                 = useState('');
  const [parsedText, setParsedText]           = useState('');
  const [suggestions, setSuggestions]         = useState([]);
  const [checkedDomains, setCheckedDomains]   = useState([]);
  const [jobs, setJobs]                       = useState([]);
  const [loading, setLoading]                 = useState(false);

  // filters
  const [location, setLocation]               = useState('India');
  const [postedWithin, setPostedWithin]       = useState('7d');
  const [jobTypes, setJobTypes]               = useState(['fulltime']);
  const [experienceLevels, setExperienceLevels] = useState([]);

  const API = process.env.REACT_APP_API_URL;

  const handleChange = e => {
    setFile(e.target.files[0]);
    setMessage('');
    setParsedText('');
    setSuggestions([]);
    setJobs([]);
  };

  const handleUpload = async () => {
    if (!file) return alert('Please select a resume first.');
    setLoading(true);
    setMessage('Uploading résumé…');

    try {
      const form = new FormData();
      form.append('resume', file);
      const up = await axios.post(`${API}/api/resumes`, form, { withCredentials: true });

      setMessage('Extracting text…');
      const txt = await axios.get(`${API}/api/resumes/${up.data._id}/text`, { withCredentials: true });
      setParsedText(txt.data.text);

      setMessage('Classifying domains…');
      const cl = await axios.post(`${API}/api/classify`, { text: txt.data.text }, { withCredentials: true });
      setSuggestions(cl.data.suggestions);
      setCheckedDomains(cl.data.suggestions.map(s => s.domain));

      setMessage('');
    } catch (err) {
      console.error(err);
      alert('Failed to upload or analyze résumé.');
      setMessage('');
    } finally {
      setLoading(false);
    }
  };

  const toggleDomain = d =>
    setCheckedDomains(cd =>
      cd.includes(d) ? cd.filter(x => x !== d) : [...cd, d]
    );

  const fetchJobs = async () => {
    if (!checkedDomains.length) return alert('Pick at least one domain.');
    setLoading(true);
    setMessage('Fetching jobs…');

    try {
      const res = await axios.get(`${API}/api/jobs`, {
        params: {
          domains:           checkedDomains.join(','),
          location,
          postedWithin,
          jobTypes:          jobTypes.join(','),
          experienceLevels:  experienceLevels.join(','),
        },
        withCredentials: true
      });
      setJobs(res.data.jobs);
      setMessage('');
    } catch (err) {
      console.error(err);
      alert('Failed to fetch jobs.');
      setMessage('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="upload-container">
      <div className="upload-card">
        <h2>Upload &amp; Analyze your Résumé</h2>

        <div className="upload-actions">
          <input
            className="file-input"
            type="file"
            accept=".pdf,.docx,.txt"
            onChange={handleChange}
          />
          <button
            className="button button-primary"
            onClick={handleUpload}
          >
            Upload &amp; Analyze
          </button>
        </div>

        {loading && <div className="loading">Loading…</div>}
        {!loading && message && <div className="message">{message}</div>}

        {parsedText && (
          <div className="parsed-container">
            <h3>Parsed Text</h3>
            <pre className="parsed-text">{parsedText}</pre>
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="suggestions-card">
            <h3>Suggested Domains</h3>
            <ul className="suggestions-list">
              {suggestions.map(s => (
                <li key={s.domain}>
                  <label>
                    <input
                      type="checkbox"
                      checked={checkedDomains.includes(s.domain)}
                      onChange={() => toggleDomain(s.domain)}
                    />{' '}
                    {s.domain} (score: {s.score.toFixed(2)})
                  </label>
                </li>
              ))}
            </ul>

            <Filters
              location={location}
              setLocation={setLocation}
              postedWithin={postedWithin}
              setPostedWithin={setPostedWithin}
              jobTypes={jobTypes}
              setJobTypes={setJobTypes}
              experienceLevels={experienceLevels}
              setExperienceLevels={setExperienceLevels}
            />

            <button
              className="button button-primary"
              onClick={fetchJobs}
            >
              Find Jobs
            </button>
          </div>
        )}
      </div>

      {jobs.length > 0 && (
        <JobList jobs={jobs} />
      )}
    </div>
  );
}
