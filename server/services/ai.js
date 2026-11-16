const Groq = require('groq-sdk');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Helper to extract JSON from AI responses that may contain markdown code blocks
function parseJSON(text) {
  let cleaned = text.trim();
  // Remove markdown code blocks like ```json ... ```
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }
  return JSON.parse(cleaned);
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

  const completion = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'llama-3.3-70b-versatile',
    temperature: 0.3,
  });
  
  const content = completion.choices[0].message.content;
  return parseJSON(content);
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

  const completion = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'llama-3.3-70b-versatile',
    temperature: 0.7,
  });
  
  return completion.choices[0].message.content;
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

  const completion = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'llama-3.3-70b-versatile',
    temperature: 0.7,
  });
  
  return completion.choices[0].message.content;
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

  const completion = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'llama-3.3-70b-versatile',
    temperature: 0.3,
  });
  
  const content = completion.choices[0].message.content;
  return parseJSON(content);
}

module.exports = {
  analyzeResume,
  startInterview,
  getNextQuestion,
  generateFeedback,
};
