import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../api/axios';
import {
  ArrowLeft,
  Trophy,
  Code,
  MessageCircle,
  CheckCircle,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Loader2,
  BarChart3,
  Home,
} from 'lucide-react';

function ScoreRing({ score, label, color }) {
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-24 w-24">
        <svg className="h-24 w-24 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" strokeWidth="8" />
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold text-slate-900">{score}</span>
        </div>
      </div>
      <span className="text-sm font-medium text-slate-600 mt-2">{label}</span>
    </div>
  );
}

function RatingBadge({ rating }) {
  const colors = {
    strong: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    good: 'bg-blue-50 text-blue-700 border-blue-200',
    average: 'bg-amber-50 text-amber-700 border-amber-200',
    weak: 'bg-red-50 text-red-700 border-red-200',
  };

  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${colors[rating] || colors.average}`}>
      {rating?.charAt(0).toUpperCase() + rating?.slice(1)}
    </span>
  );
}

export default function Feedback() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [interview, setInterview] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expandedQ, setExpandedQ] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const res = await API.get(`/interview/${id}`);
      const data = res.data.interview;
      setInterview(data);

      // generatedAt (not the score) marks saved feedback; a score of 0 is valid
      if (data.feedback?.generatedAt) {
        setFeedback(data.feedback);
      }
    } catch (err) {
      setError('Failed to load interview');
    } finally {
      setLoading(false);
    }
  };

  const generateFeedback = async () => {
    setGenerating(true);
    setError('');
    try {
      const res = await API.post(`/interview/${id}/feedback`);
      setFeedback(res.data.feedback);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate feedback');
    } finally {
      setGenerating(false);
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
    <div className="max-w-4xl mx-auto px-4 py-8">
      <button
        onClick={() => navigate('/dashboard')}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </button>

      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Interview Feedback</h1>
        <p className="text-slate-500 mt-2">
          {interview?.type?.charAt(0).toUpperCase() + interview?.type?.slice(1)} Interview ·{' '}
          <span className="capitalize">{interview?.level}</span> Level ·{' '}
          {interview?.duration} min
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Generate Feedback Button */}
      {!feedback && (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
          <div className="flex justify-center mb-4">
            <div className="h-20 w-20 bg-primary-100 rounded-2xl flex items-center justify-center">
              <BarChart3 className="h-10 w-10 text-primary-600" />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Generate Your Feedback</h2>
          <p className="text-slate-500 mb-6 max-w-md mx-auto">
            Let AI analyze your interview performance and provide detailed feedback.
          </p>
          <button
            onClick={generateFeedback}
            disabled={generating}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {generating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Analyzing your performance...
              </>
            ) : (
              <>
                <BarChart3 className="h-5 w-5" />
                Generate Feedback
              </>
            )}
          </button>
        </div>
      )}

      {/* Feedback Results */}
      {feedback && (
        <div className="space-y-6">
          {/* Scores */}
          <div className="bg-white rounded-2xl border border-slate-200 p-8">
            <div className="flex justify-center gap-12 flex-wrap">
              <ScoreRing score={feedback.overallScore} label="Overall" color="#6366f1" />
              <ScoreRing score={feedback.technicalScore} label="Technical" color="#3b82f6" />
              <ScoreRing score={feedback.communicationScore} label="Communication" color="#10b981" />
            </div>
          </div>

          {/* Summary */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              Overall Assessment
            </h2>
            <p className="text-slate-600 leading-relaxed">{feedback.summary}</p>
          </div>

          {/* Strengths & Improvements */}
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                What You Did Well
              </h2>
              <ul className="space-y-2.5">
                {feedback.strengths?.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <div className="h-1.5 w-1.5 bg-emerald-500 rounded-full mt-1.5 flex-shrink-0"></div>
                    {s}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-amber-600" />
                Areas to Improve
              </h2>
              <ul className="space-y-2.5">
                {feedback.improvements?.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <div className="h-1.5 w-1.5 bg-amber-500 rounded-full mt-1.5 flex-shrink-0"></div>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Question Breakdown */}
          {feedback.questionBreakdown?.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-primary-600" />
                Question-by-Question Breakdown
              </h2>
              <div className="space-y-3">
                {feedback.questionBreakdown.map((q, i) => (
                  <div
                    key={i}
                    className="border border-slate-200 rounded-xl overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedQ(expandedQ === i ? null : i)}
                      className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="text-xs font-bold text-slate-400 flex-shrink-0">
                          Q{i + 1}
                        </span>
                        <span className="text-sm font-medium text-slate-900 truncate">
                          {q.question}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <RatingBadge rating={q.rating} />
                        {expandedQ === i ? (
                          <ChevronUp className="h-4 w-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        )}
                      </div>
                    </button>
                    {expandedQ === i && (
                      <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3">
                        <div>
                          <p className="text-xs font-medium text-slate-500 mb-1">Your Answer</p>
                          <p className="text-sm text-slate-600">{q.userAnswer}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-500 mb-1">Feedback</p>
                          <p className="text-sm text-slate-600">{q.feedback}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Back to Dashboard */}
          <div className="text-center pt-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors"
            >
              <Home className="h-5 w-5" />
              Back to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
