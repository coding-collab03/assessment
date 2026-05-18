# Audit Report Generator

This repository contains a full-stack web application with a React + Vite frontend and a Node.js + Express backend. The backend generates personalized PDF audit reports and sends them by email.

---

## Tech Stack

**Frontend**
- React
- Vite

**Backend**
- Node.js
- Express
- CORS
- dotenv

**Other tools**
- Nodemailer
- PDFKit
- Google Gemini / Generative AI API
- Axios

---

## Project Structure

```
root/
├── backend/
│   ├── package.json
│   └── server.js
├── frontend/
│   ├── package.json
│   └── src/
├── package.json
├── package-lock.json
└── README.md
```

---

## Setup Instructions

### Backend

1. Open a terminal and navigate to `backend`
2. Install dependencies:

```bash
cd backend
npm install
```

3. Create a `.env` file in `backend/` with the required environment variables.
4. Start the backend server:

```bash
node server.js
```

The backend listens on:

- http://localhost:3001

### Frontend

1. Open a separate terminal and navigate to `frontend`
2. Install dependencies:

```bash
cd frontend
npm install
```

3. Start the frontend development server:

```bash
npm run dev
```

The frontend runs on:

- http://localhost:5173

---

## Backend Environment Variables

Create `backend/.env` with the following values:

```env
GEMINI_API_KEY=your_google_gemini_api_key
EMAIL_USER=your_email@example.com
EMAIL_PASS=your_email_password_or_app_password
```

> If you use Gmail, generate an App Password and enable the required account access settings.

---

## Notes

- Run backend and frontend in separate terminals.
- The backend generates a PDF audit report and sends it by email using the configured SMTP credentials.
- Make sure Node.js is installed before running either service.

