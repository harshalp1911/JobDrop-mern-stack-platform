# JobDrop: AI Mock Interview Platform

JobDrop helps you practice job interviews with an AI interviewer that knows your resume. Upload your resume as a PDF and the AI analyzes it. It then runs a spoken interview that adapts to your answers and finishes with a scored feedback report.

## Features

- **Resume analysis.** Upload a PDF resume and get a summary, skills, experience level, best-fit role, strengths and areas to improve.
- **Adaptive mock interviews.** The AI asks follow-up questions based on what you say and raises the difficulty as you go.
- **Voice in, voice out.** You answer by speaking (speech-to-text) and the interviewer reads its questions aloud (text-to-speech), with live captions.
- **Configurable sessions.** Choose from 5 experience levels (fresher to lead), 4 lengths (15, 20, 30 or 45 minutes) and 3 interview types (technical, behavioral or mixed).
- **Timed interviews.** The server enforces the time limit, and you can end early or rejoin after a page refresh.
- **Scored feedback.** You get overall, technical and communication scores, strengths, areas to improve and a rating for each question.
- **Sign-in.** Email and password (bcrypt + JWT) or Google sign-in.
- **Privacy by default.** Resume files are never stored, since only the extracted text is kept. Resumes and interviews are deleted automatically after 20 days.

## Tech Stack

| Layer | Tools |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, React Router, Axios, Lucide icons |
| Backend | Node.js, Express, Multer, pdf-parse, express-rate-limit |
| Database | MongoDB with Mongoose (TTL indexes for automatic deletion) |
| AI | [Groq](https://groq.com) API running Llama 3.3 70B (`llama-3.3-70b-versatile`) |
| Auth | JWT, bcrypt, Google OAuth 2.0 |
| Speech | Web Speech API (`SpeechRecognition` and `speechSynthesis`) |

## Prerequisites

- Node.js 18+
- MongoDB, either local or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster
- A free Groq API key from [console.groq.com](https://console.groq.com)
- Optional: a Google OAuth client ID if you want Google sign-in
- **Google Chrome or Microsoft Edge** for voice interviews. Other browsers have limited Web Speech API support.

## Setup

### 1. Install dependencies

```bash
cd server && npm install
cd ../client && npm install
```

### 2. Configure the server

Copy `server/.env.example` to `server/.env` and fill in the values:

```env
PORT=5001
MONGODB_URI=mongodb://localhost:27017/jobdrop
JWT_SECRET=a_long_random_string_of_at_least_32_characters
GROQ_API_KEY=your_groq_api_key
GOOGLE_CLIENT_ID=your_google_client_id   # optional
CLIENT_URL=http://localhost:5173
# TRUST_PROXY=1                          # set when deployed behind a proxy
```

The server checks these values when it starts. It won't start if `MONGODB_URI`, `JWT_SECRET` or `GROQ_API_KEY` is missing.

To confirm your Groq key works:

```bash
cd server && npm run check:groq
```

### 3. Configure the client (optional, only for Google sign-in)

Copy `client/.env.example` to `client/.env`:

```env
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

Use the same client ID as the server. If you leave it out, the Google button is hidden.

### 4. Run

```bash
# Terminal 1: API on http://localhost:5001
cd server && npm run dev

# Terminal 2: app on http://localhost:5173
cd client && npm run dev
```

Open http://localhost:5173. The Vite dev server forwards `/api` requests to the backend.

## How It Works

1. **Upload.** The PDF is processed in memory, its text is extracted, and the file is discarded. Scanned or image-only PDFs are rejected because they contain no text.
2. **Analyze.** Groq returns structured JSON using JSON mode. The server validates and cleans it before saving.
3. **Interview.** Each answer is sent to the server. The server locks the interview so two answers can't be processed at once, asks the AI for the next question using the full conversation so far, and returns the seconds remaining so the on-screen timer matches the server.
4. **Feedback.** It's generated once at the end of the interview and saved, so later visits don't call the AI again.

## Limits

| What | Limit |
|---|---|
| Resume file | PDF only, 5 MB max |
| Login, register, Google sign-in | 20 requests per 15 min per IP |
| Interview start and answers | 15 per minute per user |
| Uploads, analysis and feedback reports | 20 per hour per user |
| Data retention | Resumes and interviews are deleted 20 days after creation |

## API Endpoints

All routes except register, login and Google sign-in need an `Authorization: Bearer <token>` header. Errors are always returned as JSON: `{ "message": "..." }`.

### Auth
- `POST /api/auth/register`: create an account
- `POST /api/auth/login`: log in with email and password
- `POST /api/auth/google`: sign in with a Google ID token
- `GET /api/auth/me`: get the current user

### Resume
- `POST /api/resume/upload`: upload a PDF (multipart field `resume`)
- `POST /api/resume/:id/analyze`: analyze a resume with AI
- `GET /api/resume`: list your resumes
- `GET /api/resume/:id`: get one resume
- `DELETE /api/resume/:id`: delete a resume

### Interview
- `POST /api/interview/create`: create a session (`resumeId`, `level`, `duration`, `type`)
- `POST /api/interview/:id/start`: start it and get the AI's greeting
- `POST /api/interview/:id/respond`: send an answer and get the next question
- `POST /api/interview/:id/end`: end the interview (the server records `completed` or `ended_early`)
- `POST /api/interview/:id/feedback`: generate feedback, or return the saved copy
- `GET /api/interview/:id`: get interview details and the seconds remaining
- `GET /api/interview`: list your interviews

## Project Structure

```
Job-Drop/
├── server/
│   ├── config/        # env check, upload (multer) settings, data retention
│   ├── middleware/    # auth, rate limits, error handling, ID validation
│   ├── models/        # User, Resume, Interview (Mongoose)
│   ├── routes/        # auth, resume, interview
│   ├── services/      # ai.js: Groq prompts and response handling
│   ├── scripts/       # check-groq.js
│   └── index.js       # server entry point
└── client/
    └── src/
        ├── api/         # Axios instance with auth header
        ├── components/  # Navbar, GoogleSignInButton
        ├── context/     # AuthContext
        └── pages/       # Login, Register, Dashboard, ResumeAnalysis,
                         # InterviewSetup, Interview, Feedback
```
