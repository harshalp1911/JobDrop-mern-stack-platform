# JobDrop

**Full-Stack Job Aggregator & Résumé Analyzer**

JobDrop is a MERN-stack application that enables users to:

- 📝 **Upload & parse résumés** (PDF/DOCX/TXT) into raw text  
- 🤖 **Classify** their skills into job domains (SDE, Front-end, AI/ML, etc.) via Hugging Face zero-shot  
- 🔍 **Search jobs** across multiple sources (Indeed, LinkedIn, Glassdoor, ZipRecruiter) with filters  
- ⭐️ **Save favorite** job listings to their profile  
- 🔐 **Authenticate** via Google OAuth, with JWT sessions stored in HTTP-only cookies  

---

## 🚀 Features

1. **Google OAuth**  
   - One-click login with Google  
   - Secure JWT issued in HTTP-only, same-site cookies  

2. **Résumé Management**  
   - Upload PDF/DOCX/TXT files  
   - Server-side parsing (`pdf-parse`, `mammoth`)  
   - Persistent storage of parsed text in MongoDB  

3. **Domain Classification**  
   - Zero-shot classification using `facebook/bart-large-mnli`  
   - Returns suggested domains with confidence scores  

4. **Multi-Source Job Search**  
   - Aggregates listings from Indeed, LinkedIn, Glassdoor, ZipRecruiter via RapidAPI  
   - Filters for:
     - Location (All-India + state dropdown)  
     - Posting age (1 h, 24 h, 7 d, 10 d, 20 d, 30 d)  
     - Job type (Full-time, Internship)  
     - Experience (Fresher, Entry Level, Experienced)  

5. **Favorites**  
   - Save/unsave jobs to user profile  
   - CRUD endpoints under `/api/favorites`  

6. **Extensible**  
   - Easily add new domains, filters, or job sources  
   - Modular services for testing & scaling  

---

## 🛠 Tech Stack

- **Frontend:** React, Axios  
- **Backend:** Node.js, Express  
- **Auth:** Passport.js (Google OAuth 2.0), JWT  
- **Database:** MongoDB + Mongoose  
- **File Parsing:** `pdf-parse`, `mammoth`  
- **AI Inference:** Hugging Face Inference API  
- **Job Data:** RapidAPI “Jobs Search API”  
- **Deployment:** Render (both API & static frontend)  

---
## 📦 Installation

1. **Clone repository**  
   ```bash
   git clone https://github.com/your-username/JobDrop.git
   cd JobDrop
 
2. **Backend Setup**  
   ```bash
   cd server
    npm install
    cp .env.example .env
    # Edit .env with your keys:
    # PORT=4000
    # MONGO_URI=mongodb://localhost:27017/jobdrop
    # SERVER_URL=https://your-backend-url
    # FRONTEND_URL=https://your-frontend-url
    # GOOGLE_CLIENT_ID=…
    # GOOGLE_CLIENT_SECRET=…
    # JWT_SECRET=…
    # HF_API_TOKEN=…
    # RAPIDAPI_HOST=…
    # RAPIDAPI_KEY=…
    npm run dev
3. **Front-end setup**
    ```bash
    cd ../client
    npm install
    cp .env.example .env
    # Edit .env:
    # REACT_APP_API_URL=https://your-backend-url
    npm run start
---
## 🏗️ Architecture Overview
    ```bash
    [React Frontend] ←→ [Express API] ←→ [MongoDB]
        ↓                  ↓
     Axios            Passport.js
        ↓                  ↓
    UploadResume.js        /auth/google
    JobList.js             /api/jobs
    Filters.js            /api/resumes
                         /api/classify
                         /api/favorites

- UploadResume → POST `/api/resumes` + GET `/api/resumes/:id/text`
- Classification → POST `/api/classify`
- Job Search → GET `/api/jobs?domains=…&location=…&postedWithin=…`
- Favorites → POST/GET/DELETE `/api/favorites`
---
## 📈 Extending & Customization
- Add new domains: update `domainLabels` in `server/index.js` and `searchTermMap` in `jobAggregator.js.`
- New job sources: implement additional fetch logic in `services/jobAggregator.js.`
- UI themes: edit `client/src/index.css` or swap to Chakra/UI, Tailwind, etc.
- Email notifications: hook into `job-fetch` `cron jobs` and send via `SendGrid` or `SMTP`.
---
## 🎯 Why This Project Matters
* End-to-End: Demonstrates full-stack skills—OAuth, file I/O, AI integrations, API aggregation, database modeling.
* Real-World Utility: Helps developers/students find matching roles based on their actual résumé content.
* Scalable: Modular services facilitate adding features like pagination, cover-letter generation, or analytics dashboards.
---
 MIT License
===========

Copyright (c) 2025 Harshal Patil

