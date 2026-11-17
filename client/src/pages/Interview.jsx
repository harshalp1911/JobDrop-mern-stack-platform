import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../api/axios';
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Clock,
  Volume2,
  VolumeX,
  Loader2,
  Bot,
} from 'lucide-react';

export default function Interview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const recognitionRef = useRef(null);
  const voiceRef = useRef(null);
  const typingTimerRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const accumulatedRef = useRef('');
  const listeningRef = useRef(false);
  const respondingRef = useRef(false);
  // Refs mirror state that long-lived callbacks (speech recognition handlers,
  // TTS onDone callbacks) read, so they always see the current value instead
  // of the value captured when the callback was created.
  const micMutedRef = useRef(false);
  const ttsEnabledRef = useRef(true);
  const sendResponseRef = useRef(null);

  const [interview, setInterview] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [micMuted, setMicMuted] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  // Local time (ms) when the interview ends, derived from the server's
  // "seconds remaining" so a wrong device clock doesn't skew the countdown
  const deadlineRef = useRef(null);
  const syncDeadline = (seconds) => {
    if (typeof seconds !== 'number') return;
    deadlineRef.current = Date.now() + seconds * 1000;
    setTimeRemaining(seconds);
  };
  const [started, setStarted] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [ended, setEnded] = useState(false);
  const [endError, setEndError] = useState('');
  const endingRef = useRef(false);

  const [aiCaption, setAiCaption] = useState('');
  const [userCaption, setUserCaption] = useState('');
  const [interimCaption, setInterimCaption] = useState('');
  const [aiTypingCaption, setAiTypingCaption] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const captionClearRef = useRef(null);

  useEffect(() => { listeningRef.current = isListening; }, [isListening]);
  useEffect(() => { respondingRef.current = responding; }, [responding]);
  useEffect(() => { micMutedRef.current = micMuted; }, [micMuted]);
  useEffect(() => { ttsEnabledRef.current = ttsEnabled; }, [ttsEnabled]);

  // Load best voice
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) return;
      const preferred = [
        'Google UK English Male', 'Google UK English Female', 'Daniel',
        'Samantha', 'Google US English', 'Microsoft David', 'Alex',
      ];
      for (const name of preferred) {
        const found = voices.find((v) => v.name.includes(name));
        if (found) { voiceRef.current = found; return; }
      }
      const english = voices.find((v) => v.lang.startsWith('en'));
      if (english) voiceRef.current = english;
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  useEffect(() => { fetchInterview(); }, [id]);

  // Timer
  useEffect(() => {
    if (!started || ended || !interview) return;
    const interval = setInterval(() => {
      if (deadlineRef.current === null) return;
      const remaining = Math.max(0, (deadlineRef.current - Date.now()) / 1000);
      setTimeRemaining(remaining);
      if (remaining <= 0) handleEndInterview();
    }, 1000);
    return () => clearInterval(interval);
  }, [started, ended, interview]);

  // Release the microphone, visualizer and audio context
  const stopAudio = () => {
    cancelAnimationFrame(animFrameRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setAudioLevel(0);
  };

  // Cleanup when leaving the page
  useEffect(() => {
    return () => {
      // Clear the flag first: otherwise recognition.onend restarts the mic
      // after the page is gone and it keeps listening on other pages.
      listeningRef.current = false;
      if (recognitionRef.current) recognitionRef.current.onend = null;
      try { recognitionRef.current?.stop(); } catch (e) { /* ignore */ }
      window.speechSynthesis.cancel();
      clearTimeout(typingTimerRef.current);
      clearTimeout(silenceTimerRef.current);
      clearTimeout(captionClearRef.current);
      stopAudio();
    };
  }, []);

  const fetchInterview = async () => {
    try {
      const res = await API.get(`/interview/${id}`);
      const data = res.data.interview;
      setInterview(data);
      if (data.status === 'completed' || data.status === 'ended_early') {
        navigate(`/interview/${id}/feedback`);
        return;
      }
      if (data.status === 'in_progress') {
        // Browsers only allow mic + speech after a user click, so show a
        // "Rejoin" lobby instead of dropping the user into a silent session.
        setResuming(true);
        setMessages(data.conversation || []);
        syncDeadline(res.data.remainingSeconds);
      }
    } catch (err) {
      console.error('Failed to fetch interview:', err);
    } finally {
      setLoading(false);
    }
  };

  // Audio visualizer for mic level
  const startAudioVisualizer = async () => {
    if (streamRef.current) return; // already running
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setAudioLevel(Math.min(avg / 80, 1));
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) {
      console.error('Audio visualizer error:', e);
    }
  };

  // Always-on speech recognition
  const startListening = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) return;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) { /* ignore */ }
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      if (respondingRef.current) return;
      let finalText = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += t + ' ';
        else interim = t;
      }
      if (finalText) {
        accumulatedRef.current += finalText;
        setUserCaption(accumulatedRef.current);
        setInterimCaption('');
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          if (accumulatedRef.current.trim() && !respondingRef.current) {
            sendResponseRef.current?.(accumulatedRef.current.trim());
          }
        }, 2000);
      }
      if (interim) {
        setInterimCaption(interim);
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          if (accumulatedRef.current.trim() && !respondingRef.current) {
            sendResponseRef.current?.(accumulatedRef.current.trim());
          }
        }, 2500);
      }
    };

    recognition.onerror = (event) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.error('Speech error:', event.error);
      }
    };

    recognition.onend = () => {
      if (listeningRef.current) {
        try { recognitionRef.current?.start(); } catch (e) { /* ignore */ }
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, []);

  const stopListening = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch (e) { /* ignore */ }
    recognitionRef.current = null;
    setIsListening(false);
    clearTimeout(silenceTimerRef.current);
  }, []);

  // Typewriter caption for AI
  const typeCaption = (text) => {
    const words = text.split(' ');
    let index = 0;
    clearTimeout(typingTimerRef.current);
    clearTimeout(captionClearRef.current);
    setAiTypingCaption('');
    setAiCaption('');

    const tick = () => {
      if (index < words.length) {
        setAiTypingCaption((prev) => (prev ? prev + ' ' + words[index] : words[index]));
        index++;
        const delay = words[index - 1]?.endsWith(',') || words[index - 1]?.endsWith('.') ? 130 : 50;
        typingTimerRef.current = setTimeout(tick, delay);
      } else {
        setAiCaption(text);
        captionClearRef.current = setTimeout(() => setAiCaption(''), 5000);
        setAiTypingCaption('');
      }
    };
    tick();
  };

  // TTS
  const speak = (text, onDone) => {
    typeCaption(text);
    if (!ttsEnabledRef.current || !('speechSynthesis' in window)) {
      if (onDone) setTimeout(onDone, text.split(' ').length * 60);
      return;
    }
    window.speechSynthesis.cancel();
    const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
    let i = 0;
    const next = () => {
      if (i >= sentences.length) {
        setIsSpeaking(false);
        if (onDone) onDone();
        return;
      }
      const utt = new SpeechSynthesisUtterance(sentences[i].trim());
      utt.rate = 0.95;
      utt.pitch = 1.05;
      if (voiceRef.current) utt.voice = voiceRef.current;
      utt.onstart = () => setIsSpeaking(true);
      utt.onend = () => { i++; setTimeout(next, 200); };
      utt.onerror = () => { setIsSpeaking(false); if (onDone) onDone(); };
      window.speechSynthesis.speak(utt);
    };
    next();
  };

  // Start Interview
  const handleStartInterview = async () => {
    setLoading(true);
    try {
      const res = await API.post(`/interview/${id}/start`);
      const { startedAt, duration, remainingSeconds } = res.data.interview;
      setInterview((prev) => ({ ...prev, status: 'in_progress', startedAt, duration }));
      // Count down from the server's figure so the timer matches the limit it enforces
      syncDeadline(remainingSeconds);
      setStarted(true);
      setMessages([{ role: 'ai', content: res.data.message }]);
      startAudioVisualizer();
      // Speak AI greeting, then auto-start listening
      speak(res.data.message, () => {
        if (!micMutedRef.current) startListening();
      });
    } catch (err) {
      console.error('Failed to start:', err);
      // e.g. 409 if it was already started in another tab: reload its real state
      if (err.response?.status === 409) fetchInterview();
    } finally {
      setLoading(false);
    }
  };

  // Rejoin an interview that was already in progress (e.g. after a refresh)
  const handleRejoinInterview = () => {
    setResuming(false);
    setStarted(true);
    startAudioVisualizer();
    const lastAi = [...messages].reverse().find((m) => m.role === 'ai');
    const afterSpeaking = () => {
      if (!micMutedRef.current) startListening();
    };
    if (lastAi) {
      speak(lastAi.content, afterSpeaking);
    } else {
      afterSpeaking();
    }
  };

  // Auto-send after silence
  const sendResponse = async (text) => {
    if (!text?.trim() || respondingRef.current) return;
    stopListening();
    window.speechSynthesis.cancel();

    const userMsg = { role: 'user', content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    accumulatedRef.current = '';
    setUserCaption('');
    setInterimCaption('');
    setResponding(true);

    try {
      const res = await API.post(`/interview/${id}/respond`, {
        userMessage: text.trim(),
      });
      const aiMsg = { role: 'ai', content: res.data.message };
      setMessages((prev) => [...prev, aiMsg]);

      if (res.data.isComplete) {
        endingRef.current = true; // server already finished it; skip /end
        setEnded(true);
        speak(res.data.message, () => {
          setTimeout(() => navigate(`/interview/${id}/feedback`), 2000);
        });
      } else {
        syncDeadline(res.data.remainingSeconds);
        speak(res.data.message, () => {
          if (!micMutedRef.current) startListening();
        });
      }
    } catch (err) {
      console.error('Failed to send:', err);
      if (!micMutedRef.current) startListening();
    } finally {
      setResponding(false);
    }
  };

  sendResponseRef.current = sendResponse;

  const toggleMic = () => {
    if (micMuted) {
      setMicMuted(false);
      micMutedRef.current = false;
      if (!respondingRef.current && !isSpeaking) startListening();
    } else {
      setMicMuted(true);
      micMutedRef.current = true;
      stopListening();
    }
  };

  const toggleTts = () => {
    const next = !ttsEnabled;
    setTtsEnabled(next);
    ttsEnabledRef.current = next;
    // Muting mid-sentence stops the voice; the utterance's onerror then
    // runs its onDone, which hands the turn back to the candidate.
    if (!next) window.speechSynthesis.cancel();
  };

  const handleEndInterview = async () => {
    // A ref, not state, so the timer and the button can't both fire it
    if (endingRef.current) return;
    endingRef.current = true;
    setEndError('');
    setEnded(true);
    stopListening();
    window.speechSynthesis.cancel();
    clearTimeout(typingTimerRef.current);
    clearTimeout(silenceTimerRef.current);
    clearTimeout(captionClearRef.current);
    setAiTypingCaption('');
    stopAudio();
    try {
      await API.post(`/interview/${id}/end`);
      navigate(`/interview/${id}/feedback`);
    } catch (err) {
      console.error('Failed to end:', err);
      // Let the user retry instead of leaving them on a dead screen
      endingRef.current = false;
      setEndError(err.response?.data?.message || 'Could not end the interview. Check your connection and try again.');
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // --- Loading ---
  if (loading && !started) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-400"></div>
      </div>
    );
  }

  // --- Lobby ---
  if (!started) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center px-4">
        <div className="text-center max-w-lg">
          <div className="relative mx-auto mb-10 w-36 h-36">
            <div className="absolute inset-0 bg-indigo-500/20 rounded-full animate-pulse"></div>
            <div className="absolute inset-3 bg-indigo-500/10 rounded-full"></div>
            <div className="absolute inset-5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shadow-2xl shadow-indigo-500/30">
              <Bot className="h-16 w-16 text-white" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-white mb-4">
            {resuming ? 'Welcome Back' : 'Ready to Begin?'}
          </h1>
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="px-3 py-1 bg-white/10 text-white/80 rounded-full text-sm capitalize">{interview?.type}</span>
            <span className="px-3 py-1 bg-white/10 text-white/80 rounded-full text-sm capitalize">{interview?.level} level</span>
            <span className="px-3 py-1 bg-white/10 text-white/80 rounded-full text-sm">{interview?.duration} min</span>
          </div>
          <p className="text-white/40 text-sm mb-10">
            {resuming
              ? `Your interview is still running — ${formatTime(timeRemaining)} left. The interviewer will repeat the last question.`
              : 'Your mic will be always on — just speak naturally, like a real interview.'}
          </p>

          <button
            onClick={resuming ? handleRejoinInterview : handleStartInterview}
            disabled={loading}
            className="inline-flex items-center gap-3 px-10 py-4 bg-emerald-500 text-white rounded-full font-semibold text-lg hover:bg-emerald-400 transition-all hover:shadow-lg hover:shadow-emerald-500/25 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Phone className="h-5 w-5" />}
            {resuming ? 'Rejoin Interview' : 'Join Interview'}
          </button>
        </div>
      </div>
    );
  }

  // --- Active Interview ---
  const activeCaptionAI = aiTypingCaption || aiCaption;
  const activeCaptionUser = userCaption + (interimCaption ? (userCaption ? ' ' : '') + interimCaption : '');

  return (
    <div className="h-screen bg-[#1a1a2e] flex flex-col overflow-hidden select-none">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-black/20">
        <div className="flex items-center gap-3">
          <div className={`h-2.5 w-2.5 rounded-full ${ended ? 'bg-red-400' : 'bg-emerald-400 animate-pulse'}`}></div>
          <span className="text-white/60 text-sm font-medium">
            {ended ? 'Interview Ended' : 'Interview in Progress'}
          </span>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
          timeRemaining < 180 ? 'bg-red-500/20 text-red-300' : 'bg-white/10 text-white/70'
        }`}>
          <Clock className="h-4 w-4" />
          <span className="text-sm font-mono font-medium">{formatTime(timeRemaining)}</span>
        </div>
      </div>

      {/* Center: AI Interviewer */}
      <div className="flex-1 flex flex-col items-center justify-center relative">
        {/* AI Avatar */}
        <div className="relative mb-8">
          {isSpeaking && (
            <>
              <div className="absolute -inset-8 rounded-full border-2 border-indigo-400/30 animate-ping" style={{ animationDuration: '1.5s' }}></div>
              <div className="absolute -inset-5 rounded-full border border-indigo-400/20 animate-pulse"></div>
            </>
          )}
          {responding && !isSpeaking && (
            <div className="absolute -inset-5 rounded-full border-2 border-yellow-400/30 animate-pulse"></div>
          )}
          <div className={`w-32 h-32 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center transition-all duration-500 ${
            isSpeaking ? 'scale-110 shadow-2xl shadow-indigo-500/40' : responding ? 'scale-100 shadow-xl shadow-yellow-500/20' : 'scale-100 shadow-lg shadow-indigo-500/20'
          }`}>
            <Bot className="h-16 w-16 text-white" />
          </div>
          {/* Status label */}
          <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap">
            {isSpeaking && (
              <span className="text-xs text-indigo-300 flex items-center gap-1.5">
                <span className="flex gap-0.5">
                  <span className="w-1 h-3 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-1 h-4 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-1 h-3 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </span>
                Speaking
              </span>
            )}
            {responding && !isSpeaking && (
              <span className="text-xs text-yellow-300 animate-pulse">Thinking...</span>
            )}
            {!isSpeaking && !responding && isListening && (
              <span className="text-xs text-emerald-300">Listening to you...</span>
            )}
          </div>
        </div>

        {/* AI Interviewer Name */}
        <p className="text-white/80 font-medium text-lg mt-4 mb-1">AI Interviewer</p>
        <p className="text-white/30 text-sm capitalize">{interview?.type} Interview · {interview?.level} Level</p>

        {/* User mic visual (bottom-right small circle) */}
        <div className="absolute bottom-8 right-8">
          <div className="relative">
            {isListening && !micMuted && (
              <div
                className="absolute inset-0 rounded-full bg-emerald-400/20 transition-transform duration-150"
                style={{ transform: `scale(${1 + audioLevel * 0.8})` }}
              ></div>
            )}
            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl ${
              micMuted ? 'bg-white/10' : 'bg-gradient-to-br from-emerald-500 to-teal-600'
            }`}>
              You
            </div>
            {!micMuted && isListening && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-400 rounded-full flex items-center justify-center">
                <Mic className="h-3 w-3 text-white" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Captions Area */}
      <div className="min-h-[100px] px-8 py-4 flex flex-col items-center justify-end gap-2">
        {activeCaptionAI && (
          <div className="max-w-2xl w-full">
            <p className="text-white/90 text-center text-base leading-relaxed bg-black/30 rounded-xl px-5 py-3">
              <span className="text-indigo-300 font-medium text-xs mr-2">AI:</span>
              {activeCaptionAI}
              {aiTypingCaption && <span className="inline-block w-0.5 h-4 bg-indigo-400 ml-1 animate-pulse align-middle"></span>}
            </p>
          </div>
        )}
        {activeCaptionUser && (
          <div className="max-w-2xl w-full">
            <p className="text-white/90 text-center text-base leading-relaxed bg-black/30 rounded-xl px-5 py-3">
              <span className="text-emerald-300 font-medium text-xs mr-2">You:</span>
              {activeCaptionUser}
              <span className="inline-block w-0.5 h-4 bg-emerald-400 ml-1 animate-pulse align-middle"></span>
            </p>
          </div>
        )}
      </div>

      {/* Ending failed: offer a retry */}
      {ended && endError && (
        <div className="flex flex-col items-center gap-3 px-6 py-5 bg-black/30">
          <p className="text-red-300 text-sm text-center">{endError}</p>
          <button
            onClick={handleEndInterview}
            className="px-6 py-2.5 rounded-full bg-red-500 hover:bg-red-400 text-white text-sm font-medium"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Bottom Controls */}
      {!ended && (
        <div className="flex items-center justify-center gap-5 px-6 py-5 bg-black/30">
          {/* Mic toggle */}
          <button
            onClick={toggleMic}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
              micMuted
                ? 'bg-red-500/80 hover:bg-red-500 text-white'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
            title={micMuted ? 'Unmute' : 'Mute'}
          >
            {micMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>

          {/* End Call */}
          <button
            onClick={handleEndInterview}
            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-400 text-white flex items-center justify-center transition-all hover:shadow-lg hover:shadow-red-500/30"
            title="End Interview"
          >
            <PhoneOff className="h-6 w-6" />
          </button>

          {/* Volume toggle */}
          <button
            onClick={toggleTts}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
              !ttsEnabled
                ? 'bg-red-500/80 hover:bg-red-500 text-white'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
            title={ttsEnabled ? 'Mute AI' : 'Unmute AI'}
          >
            {ttsEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </button>
        </div>
      )}
    </div>
  );
}
