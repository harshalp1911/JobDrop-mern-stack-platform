import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';
import {
  Upload,
  FileText,
  Trash2,
  Brain,
  MessageSquare,
  Clock,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [resumes, setResumes] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [resumeRes, interviewRes] = await Promise.all([
        API.get('/resume'),
        API.get('/interview'),
      ]);
      setResumes(resumeRes.data.resumes);
      setInterviews(interviewRes.data.interviews);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (file) => {
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Only PDF files are allowed');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('File is too large. Maximum size is 5MB');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('resume', file);
      const res = await API.post('/resume/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResumes((prev) => [res.data.resume, ...prev]);
      navigate(`/resume/${res.data.resume.id}`);
    } catch (err) {
      alert(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this resume?')) return;
    try {
      await API.delete(`/resume/${id}`);
      setResumes((prev) => prev.filter((r) => r._id !== id));
    } catch (err) {
      alert('Failed to delete');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleUpload(file);
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">
          Welcome back, {user?.name?.split(' ')[0]}
        </h1>
        <p className="text-slate-500 mt-1">Upload your resume and start preparing for interviews</p>
      </div>

      {/* Upload Section */}
      <div
        className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer ${
          dragOver
            ? 'border-primary-500 bg-primary-50'
            : 'border-slate-300 hover:border-primary-400 hover:bg-slate-50'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={(e) => handleUpload(e.target.files[0])}
          className="hidden"
        />
        <div className="flex flex-col items-center">
          {uploading ? (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
              <p className="text-lg font-medium text-slate-700">Uploading your resume...</p>
            </>
          ) : (
            <>
              <div className="h-16 w-16 bg-primary-100 rounded-2xl flex items-center justify-center mb-4">
                <Upload className="h-8 w-8 text-primary-600" />
              </div>
              <p className="text-lg font-medium text-slate-700">
                Drop your resume here or click to upload
              </p>
              <p className="text-sm text-slate-400 mt-1">PDF only, up to 5MB · Your data is automatically deleted after 20 days</p>
            </>
          )}
        </div>
      </div>

      {/* Resumes Section */}
      {resumes.length > 0 && (
        <div className="mt-10">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Your Resumes</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {resumes.map((resume) => (
              <div
                key={resume._id}
                className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-blue-50 rounded-lg flex items-center justify-center">
                      <FileText className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 text-sm truncate max-w-[160px]">
                        {resume.fileName}
                      </p>
                      <p className="text-xs text-slate-400">
                        {new Date(resume.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(resume._id); }}
                    className="text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4 flex gap-2">
                  {resume.isAnalyzed ? (
                    <>
                      <button
                        onClick={() => navigate(`/resume/${resume._id}`)}
                        className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
                      >
                        <Brain className="h-3.5 w-3.5" />
                        View Analysis
                      </button>
                      <button
                        onClick={() => navigate(`/interview/setup/${resume._id}`)}
                        className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Mock Interview
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => navigate(`/resume/${resume._id}`)}
                      className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
                    >
                      <Brain className="h-3.5 w-3.5" />
                      Analyze with AI
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past Interviews Section */}
      {interviews.length > 0 && (
        <div className="mt-10">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Past Interviews</h2>
          <div className="space-y-3">
            {interviews.map((interview) => (
              <div
                key={interview._id}
                onClick={() =>
                  interview.status === 'completed' || interview.status === 'ended_early'
                    ? navigate(`/interview/${interview._id}/feedback`)
                    : navigate(`/interview/${interview._id}`)
                }
                className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 bg-emerald-50 rounded-lg flex items-center justify-center">
                    <MessageSquare className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 text-sm">
                      {interview.type?.charAt(0).toUpperCase() + interview.type?.slice(1)} Interview
                      {' · '}
                      <span className="text-slate-500 capitalize">{interview.level}</span>
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Clock className="h-3 w-3 text-slate-400" />
                      <span className="text-xs text-slate-400">
                        {interview.duration} min · {new Date(interview.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      interview.status === 'completed'
                        ? 'bg-emerald-50 text-emerald-700'
                        : interview.status === 'in_progress'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {interview.status === 'ended_early' ? 'Ended' : interview.status?.replace('_', ' ')}
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
