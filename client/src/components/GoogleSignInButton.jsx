import { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// Renders the Google sign-in button plus an "or" divider.
// Renders nothing when no Google client ID is configured.
export default function GoogleSignInButton({ text = 'signin_with' }) {
  const { googleLogin } = useAuth();
  const [error, setError] = useState('');

  if (!GOOGLE_CLIENT_ID) return null;

  const handleSuccess = async (response) => {
    setError('');
    try {
      await googleLogin(response.credential);
    } catch (err) {
      setError(err.response?.data?.message || 'Google sign-in failed');
    }
  };

  return (
    <div className="mb-6">
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}
      <div className="flex justify-center">
        <GoogleLogin
          onSuccess={handleSuccess}
          onError={() => setError('Google sign-in failed')}
          text={text}
          shape="rectangular"
          width="320"
        />
      </div>
      <div className="flex items-center gap-3 mt-6">
        <div className="flex-1 h-px bg-slate-200"></div>
        <span className="text-xs text-slate-400 uppercase">or</span>
        <div className="flex-1 h-px bg-slate-200"></div>
      </div>
    </div>
  );
}
