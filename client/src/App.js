// client/src/App.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import UploadResume from './components/UploadResume';

export default function App() {
  const API = process.env.REACT_APP_API_URL; // e.g. http://localhost:4000
  axios.defaults.withCredentials = true;

  const [user, setUser] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // On mount: fetch the current user (if any)
  useEffect(() => {
    axios
      .get(`${API}/api/profile`)
      .then(res => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setLoadingProfile(false));
  }, [API]);

  // Trigger Google OAuth
  const handleLogin = () => {
    window.location.href = `${API}/auth/google`;
  };

  // Clear server cookie, then reload
  const handleLogout = async () => {
    try {
      await axios.post(`${API}/auth/logout`);
    } catch (err) {
      console.warn('Logout failed', err);
    } finally {
      window.location.reload();
    }
  };

  if (loadingProfile) {
    return <div style={{ textAlign: 'center', marginTop: 50 }}>Loading…</div>;
  }

  return (
    <div>
      {user ? (
        <nav
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            padding:        '1rem 2rem',
            borderBottom:   '1px solid #e2e8f0',
            background:     '#f7fafc',
          }}
        >
          <span>
            Hello, <strong>{user.name.toUpperCase()}</strong>!
          </span>
          <button
            onClick={handleLogout}
            style={{
              padding:      '0.5rem 1rem',
              background:   '#4299e1',
              color:        '#fff',
              border:       'none',
              borderRadius: '4px',
              cursor:       'pointer',
            }}
          >
            Logout
          </button>
        </nav>
      ) : (
        <div style={{ textAlign: 'center', marginTop: 50 }}>
          <button
            onClick={handleLogin}
            style={{
              padding:      '0.75rem 1.5rem',
              fontSize:     '1rem',
              background:   '#4285F4',
              color:        '#fff',
              border:       'none',
              borderRadius: '4px',
              cursor:       'pointer',
            }}
          >
            Login with Google
          </button>
        </div>
      )}

      {user && (
        <main style={{ padding: '2rem', maxWidth: 900, margin: '0 auto' }}>
          <UploadResume />
        </main>
      )}
    </div>
  );
}
