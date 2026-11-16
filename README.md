# JobDrop - AI Mock Interview Platform

A MERN stack application that helps users prepare for job interviews with AI-powered resume analysis and dynamic mock interviews.

## Features

- **Google OAuth + Custom Authentication** - Sign in with Google or create an account
- **Resume Upload & AI Analysis** - Upload your resume (PDF/DOCX) and get AI-powered analysis
- **Smart Mock Interviews** - AI conducts dynamic interviews based on your resume
- **Adaptive Questions** - AI asks follow-up questions based on your responses
- **Speech Recognition** - Answer questions using your voice
- **Text-to-Speech** - AI speaks its questions naturally
- **Timer & Controls** - Set interview duration (15/20/30/45 min) with early exit option
- **Detailed Feedback** - Get comprehensive post-interview analysis with scores

## Tech Stack

- **Frontend**: React, Vite, TailwindCSS, React Router, Lucide Icons
- **Backend**: Node.js, Express.js, MongoDB, Mongoose
- **AI**: OpenAI GPT-4
- **Auth**: JWT, Google OAuth, bcrypt
- **Speech**: Web Speech API (recognition + synthesis)

## Prerequisites

- Node.js 18+
- MongoDB running locally or a MongoDB Atlas URI
- OpenAI API key
- Google OAuth Client ID (for Google login)

## Setup

### 1. Clone and install dependencies

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Configure environment variables

Edit `server/.env`:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/jobdrop
JWT_SECRET=your_secret_key_here
GOOGLE_CLIENT_ID=your_google_client_id
OPENAI_API_KEY=your_openai_api_key
CLIENT_URL=http://localhost:5173
```

### 3. Start the application

```bash
# Terminal 1 - Start backend
cd server
npm run dev

# Terminal 2 - Start frontend
cd client
npm run dev
```

### 4. Open the app

Visit `http://localhost:5173` in your browser.

## Project Structure

```
Job-Drop/
├── server/
│   ├── config/          # Multer config for file uploads
│   ├── middleware/       # Auth middleware
│   ├── models/          # MongoDB schemas (User, Resume, Interview)
│   ├── routes/          # API routes (auth, resume, interview)
│   ├── services/        # AI service (OpenAI integration)
│   ├── uploads/         # Uploaded resume files
│   └── index.js         # Server entry point
├── client/
│   ├── public/
│   └── src/
│       ├── api/         # Axios instance
│       ├── components/  # Reusable components
│       ├── context/     # Auth context
│       └── pages/       # All page components
└── README.md
```

## API Endpoints

### Auth
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/google` - Login with Google
- `GET /api/auth/me` - Get current user

### Resume
- `POST /api/resume/upload` - Upload resume
- `POST /api/resume/:id/analyze` - Analyze resume with AI
- `GET /api/resume` - Get all resumes
- `GET /api/resume/:id` - Get single resume
- `DELETE /api/resume/:id` - Delete resume

### Interview
- `POST /api/interview/create` - Create interview session
- `POST /api/interview/:id/start` - Start interview
- `POST /api/interview/:id/respond` - Send response, get next question
- `POST /api/interview/:id/end` - End interview early
- `POST /api/interview/:id/feedback` - Generate feedback
- `GET /api/interview/:id` - Get interview details
- `GET /api/interview` - Get all interviews
