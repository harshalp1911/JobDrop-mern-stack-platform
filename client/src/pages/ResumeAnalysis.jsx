import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../api/axios';
import {
  Brain,
  FileText,
  Sparkles,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Loader2,
  Code,
  Briefcase,
  TrendingUp,
} from 'lucide-react';

export default function ResumeAnalysis() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [resume, setResume] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchResume();
  }, [id]);

  const fetchResume = async () => {
    try {
      const res = await API.get(`/resume/${id}`);
      setResume(res.data.resume);
    } catch (err) {
      setError('Failed to load resume');
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setError('');
    try {
      const res = await API.post(`/resume/${id}/analyze`);
      setResume((prev) => ({
        ...prev,
        analysis: res.data.analysis,
        isAnalyzed: true,
      }));
    } catch (err) {
      setError(err.response?.data?.message || 'Analysis failed. Check your OpenAI API key.');
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!resume) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <p className="text-slate-500">Resume not found</p>
        <button onClick={() => navigate('/dashboard')} className="mt-4 text-primary-600 hover:underline">
          Back to Dashboard
        </button>
      </div>
    );
  }

  const analysis = resume.analysis;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <button
        onClick={() => navigate('/dashboard')}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </button>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 bg-blue-50 rounded-xl flex items-center justify-center">
            <FileText className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{resume.fileName}</h1>
            <p className="text-sm text-slate-500">
              Uploaded {new Date(resume.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Not Analyzed Yet */}
      {!resume.isAnalyzed && (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
          <div className="flex justify-center mb-4">
            <div className="h-20 w-20 bg-primary-100 rounded-2xl flex items-center justify-center">
              <Brain className="h-10 w-10 text-primary-600" />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Ready to Analyze</h2>
          <p className="text-slate-500 mb-6 max-w-md mx-auto">
            Let AI scan your resume to identify your skills, strengths, and areas for improvement.
          </p>
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {analyzing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Analyzing your resume...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                Analyze with AI
              </>
            )}
          </button>
        </div>
      )}

      {/* Analysis Results */}
      {resume.isAnalyzed && analysis && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary-600" />
              Professional Summary
            </h2>
            <p className="text-slate-600 leading-relaxed">{analysis.summary}</p>
            <div className="mt-4 flex items-center gap-2">
              <span className="text-sm font-medium text-slate-500">Best fit role:</span>
              <span className="px-3 py-1 bg-primary-50 text-primary-700 text-sm font-medium rounded-full">
                {analysis.bestFitRole}
              </span>
            </div>
          </div>

          {/* Skills */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Code className="h-5 w-5 text-blue-600" />
              Skills Identified
            </h2>
            <div className="flex flex-wrap gap-2">
              {analysis.skills?.map((skill, i) => (
                <span
                  key={i}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 text-sm rounded-lg"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {/* Strengths & Improvements */}
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                Strengths
              </h2>
              <ul className="space-y-2">
                {analysis.strengths?.map((s, i) => (
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
              <ul className="space-y-2">
                {analysis.improvements?.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <div className="h-1.5 w-1.5 bg-amber-500 rounded-full mt-1.5 flex-shrink-0"></div>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* CTA: Start Interview */}
          <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-2xl p-8 text-center text-white">
            <h2 className="text-xl font-bold mb-2">Ready for a Mock Interview?</h2>
            <p className="text-primary-100 mb-6">
              Practice with an AI interviewer tailored to your resume and skills.
            </p>
            <button
              onClick={() => navigate(`/interview/setup/${id}`)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-primary-700 rounded-xl font-semibold hover:bg-primary-50 transition-colors"
            >
              <Sparkles className="h-5 w-5" />
              Start Mock Interview
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
