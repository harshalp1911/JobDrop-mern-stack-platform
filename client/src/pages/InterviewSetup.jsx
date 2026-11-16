import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../api/axios';
import {
  ArrowLeft,
  Clock,
  BarChart3,
  MessageSquare,
  Sparkles,
  Loader2,
} from 'lucide-react';

const levels = [
  { value: 'fresher', label: 'Fresher', desc: '0-1 years experience' },
  { value: 'junior', label: 'Junior', desc: '1-3 years experience' },
  { value: 'mid', label: 'Mid-Level', desc: '3-5 years experience' },
  { value: 'senior', label: 'Senior', desc: '5-8 years experience' },
  { value: 'lead', label: 'Lead', desc: '8+ years experience' },
];

const durations = [
  { value: 15, label: '15 min', desc: 'Quick practice' },
  { value: 20, label: '20 min', desc: 'Standard practice' },
  { value: 30, label: '30 min', desc: 'In-depth session' },
  { value: 45, label: '45 min', desc: 'Full interview' },
];

const types = [
  { value: 'technical', label: 'Technical', desc: 'Focus on technical skills', icon: BarChart3 },
  { value: 'behavioral', label: 'Behavioral', desc: 'Soft skills & scenarios', icon: MessageSquare },
  { value: 'mixed', label: 'Mixed', desc: 'Both technical & behavioral', icon: Sparkles },
];

export default function InterviewSetup() {
  const { resumeId } = useParams();
  const navigate = useNavigate();
  const [resume, setResume] = useState(null);
  const [level, setLevel] = useState('fresher');
  const [duration, setDuration] = useState(20);
  const [type, setType] = useState('mixed');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    API.get(`/resume/${resumeId}`)
      .then((res) => setResume(res.data.resume))
      .catch(() => setError('Resume not found'))
      .finally(() => setLoading(false));
  }, [resumeId]);

  const handleStart = async () => {
    setCreating(true);
    setError('');
    try {
      const res = await API.post('/interview/create', {
        resumeId,
        level,
        duration,
        type,
      });
      navigate(`/interview/${res.data.interview.id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create interview');
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <button
        onClick={() => navigate('/dashboard')}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </button>

      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Set Up Your Interview</h1>
        <p className="text-slate-500 mt-2">
          Customize your mock interview experience
          {resume?.analysis?.bestFitRole && (
            <span> for <strong>{resume.analysis.bestFitRole}</strong></span>
          )}
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="space-y-8">
        {/* Experience Level */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary-600" />
            Experience Level
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {levels.map((l) => (
              <button
                key={l.value}
                onClick={() => setLevel(l.value)}
                className={`p-3 rounded-xl border-2 text-center transition-all ${
                  level === l.value
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <p className={`text-sm font-semibold ${level === l.value ? 'text-primary-700' : 'text-slate-900'}`}>
                  {l.label}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{l.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Duration */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary-600" />
            Interview Duration
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {durations.map((d) => (
              <button
                key={d.value}
                onClick={() => setDuration(d.value)}
                className={`p-4 rounded-xl border-2 text-center transition-all ${
                  duration === d.value
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <p className={`text-lg font-bold ${duration === d.value ? 'text-primary-700' : 'text-slate-900'}`}>
                  {d.label}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{d.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Interview Type */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary-600" />
            Interview Type
          </h2>
          <div className="grid sm:grid-cols-3 gap-3">
            {types.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  className={`p-4 rounded-xl border-2 text-center transition-all ${
                    type === t.value
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Icon className={`h-6 w-6 mx-auto mb-2 ${type === t.value ? 'text-primary-600' : 'text-slate-400'}`} />
                  <p className={`text-sm font-semibold ${type === t.value ? 'text-primary-700' : 'text-slate-900'}`}>
                    {t.label}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{t.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Start Button */}
        <button
          onClick={handleStart}
          disabled={creating}
          className="w-full py-4 bg-primary-600 text-white rounded-xl font-semibold text-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {creating ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Preparing your interview...
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5" />
              Start Interview
            </>
          )}
        </button>
      </div>
    </div>
  );
}
