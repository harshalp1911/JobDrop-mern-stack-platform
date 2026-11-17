const Groq = require('groq-sdk');
const { HttpError } = require('../middleware/errorHandler');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const MODEL = 'llama-3.3-70b-versatile';

// Helper to extract JSON from AI responses that may contain markdown code blocks
function parseJSON(text) {
  let cleaned = (text || '').trim();
  // Remove markdown code blocks like ```json ... ```
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }
  // Fall back to the outermost {...} if the model added text around it
  if (!cleaned.startsWith('{')) {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) cleaned = cleaned.slice(start, end + 1);
  }
  return JSON.parse(cleaned);
}

// Turn Groq SDK failures (rate limit, outage, bad key) into a clear 502/503
// for the user; the original error is logged by the caller's error handler.
function toAIError(error) {
  if (error instanceof Groq.APIError) {
    console.error('Groq API error:', error.status, error.message);
    if (error.status === 429) {
      return new HttpError(503, 'The AI is busy right now. Please try again in a minute');
    }
    return new HttpError(502, 'The AI service is unavailable. Please try again');
  }
  return error;
}

// Ask for a JSON object (Groq JSON mode) and retry once if it can't be parsed
async function completeJSON(prompt, temperature) {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: MODEL,
        temperature,
        response_format: { type: 'json_object' },
      });
      return parseJSON(completion.choices[0]?.message?.content);
    } catch (error) {
      // API failures won't be fixed by an immediate retry; bad JSON might
      if (error instanceof Groq.APIError) throw toAIError(error);
      lastError = error;
      console.warn(`AI JSON attempt ${attempt} failed:`, error.message);
    }
  }
  throw new HttpError(502, 'The AI returned an unreadable response. Please try again');
}

// Plain-text completion that never returns an empty string
async function completeText(prompt, temperature) {
  let completion;
  try {
    completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: MODEL,
      temperature,
    });
  } catch (error) {
    throw toAIError(error);
  }
  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) throw new HttpError(502, 'The AI returned an empty response. Please try again');
  return text;
}

const toStringArray = (value) =>
  Array.isArray(value) ? value.filter((v) => typeof v === 'string' && v.trim()).map((v) => v.trim()) : [];

const toText = (value) => (typeof value === 'string' ? value.trim() : '');

const toScore = (value) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
};

const EXPERIENCE_LEVELS = ['fresher', 'junior', 'mid', 'senior'];
const RATINGS = ['strong', 'good', 'average', 'weak'];

// Coerce the model's resume analysis into the shape the app expects
function normalizeAnalysis(raw) {
  const experience = toText(raw?.experience).toLowerCase();
  return {
    summary: toText(raw?.summary),
    skills: toStringArray(raw?.skills),
    experience: EXPERIENCE_LEVELS.includes(experience) ? experience : 'junior',
    bestFitRole: toText(raw?.bestFitRole) || 'Software Developer',
    strengths: toStringArray(raw?.strengths),
    improvements: toStringArray(raw?.improvements),
  };
}

// Coerce the model's feedback into the shape the app expects
function normalizeFeedback(raw) {
  const breakdown = Array.isArray(raw?.questionBreakdown) ? raw.questionBreakdown : [];
  return {
    overallScore: toScore(raw?.overallScore),
    technicalScore: toScore(raw?.technicalScore),
    communicationScore: toScore(raw?.communicationScore),
    summary: toText(raw?.summary),
    strengths: toStringArray(raw?.strengths),
    improvements: toStringArray(raw?.improvements),
    questionBreakdown: breakdown
      .filter((q) => q && typeof q === 'object')
      .map((q) => {
        const rating = toText(q.rating).toLowerCase();
        return {
          question: toText(q.question),
          userAnswer: toText(q.userAnswer),
          rating: RATINGS.includes(rating) ? rating : 'average',
          feedback: toText(q.feedback),
        };
      })
      .filter((q) => q.question),
  };
}

// Analyze resume text and return structured analysis
async function analyzeResume(resumeText) {
  const prompt = `You are an expert resume reviewer and career advisor. Analyze the given resume text and return a JSON response with the following structure:
{
  "summary": "A 2-3 sentence professional summary of the candidate",
  "skills": ["skill1", "skill2", ...],
  "experience": "fresher/junior/mid/senior based on resume",
  "bestFitRole": "The role this resume best suits (e.g., Software Developer, Frontend Engineer, etc.)",
  "strengths": ["strength1", "strength2", ...],
  "improvements": ["improvement1", "improvement2", ...]
}
Return ONLY valid JSON, no markdown or extra text.

Analyze this resume:

${resumeText}`;

  return normalizeAnalysis(await completeJSON(prompt, 0.3));
}

// Generate the first interview question
async function startInterview(resumeAnalysis, level, interviewType, candidateName) {
  const prompt = `You are a friendly but professional technical interviewer. You are conducting a ${interviewType} interview for a ${level}-level candidate.

Candidate Profile:
- Name: ${candidateName}
- Skills: ${resumeAnalysis.skills?.join(', ')}
- Best Fit Role: ${resumeAnalysis.bestFitRole}
- Summary: ${resumeAnalysis.summary}

Start the interview naturally. Greet the candidate by name, make them comfortable, and ask them to introduce themselves. Keep it conversational — like a real human interviewer would. Do NOT sound robotic or list questions. Just start with a warm greeting and the first question.

Keep your response to 2-3 sentences max.`;

  return completeText(prompt, 0.7);
}

// Generate next interview question based on conversation history
async function getNextQuestion(conversation, resumeAnalysis, level, interviewType, timeRemainingMins) {
  const conversationText = conversation
    .map((msg) => `${msg.role === 'ai' ? 'Interviewer' : 'Candidate'}: ${msg.content}`)
    .join('\n\n');

  const prompt = `You are a friendly but professional technical interviewer conducting a ${interviewType} interview for a ${level}-level candidate.

Candidate Profile:
- Skills: ${resumeAnalysis.skills?.join(', ')}
- Best Fit Role: ${resumeAnalysis.bestFitRole}
- Experience: ${resumeAnalysis.experience}

IMPORTANT RULES:
1. Listen carefully to the candidate's answer and ask relevant follow-up questions based on what they said.
2. If they mention a technology (e.g., Docker, React, AWS), ask deeper questions about it.
3. Gradually increase difficulty based on their responses.
4. Keep it conversational — acknowledge their answer briefly before asking the next question.
5. Mix technical and behavioral questions naturally.
6. Time remaining: ${timeRemainingMins} minutes. If less than 3 minutes, start wrapping up the interview.
7. Keep your response to 2-4 sentences max. One brief acknowledgment + one question.
8. Do NOT repeat questions already asked.
9. Sound like a real human interviewer, not an AI.

Previous conversation:
${conversationText}

Generate your next response as the interviewer:`;

  return completeText(prompt, 0.7);
}

// Generate interview feedback
async function generateFeedback(conversation, resumeAnalysis, level) {
  const conversationText = conversation
    .map((msg) => `${msg.role === 'ai' ? 'Interviewer' : 'Candidate'}: ${msg.content}`)
    .join('\n\n');

  const prompt = `You are an expert interview evaluator. Analyze the following interview conversation and provide feedback. The candidate is ${level}-level applying for ${resumeAnalysis.bestFitRole}.

Return ONLY valid JSON with this structure:
{
  "overallScore": <number 0-100>,
  "technicalScore": <number 0-100>,
  "communicationScore": <number 0-100>,
  "summary": "2-3 sentence overall assessment",
  "strengths": ["strength1", "strength2", "strength3"],
  "improvements": ["area1", "area2", "area3"],
  "questionBreakdown": [
    {
      "question": "the question asked",
      "userAnswer": "brief summary of user's answer",
      "rating": "strong/good/average/weak",
      "feedback": "specific feedback for this answer"
    }
  ]
}
Return ONLY valid JSON, no markdown.

Interview conversation:
${conversationText}`;

  return normalizeFeedback(await completeJSON(prompt, 0.3));
}

module.exports = {
  analyzeResume,
  startInterview,
  getNextQuestion,
  generateFeedback,
};
