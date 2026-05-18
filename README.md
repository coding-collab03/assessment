# Audit Report Generator

This repository contains a full-stack web application with a React + Vite frontend and a Node.js + Express backend. The backend generates personalized PDF audit reports and sends them by email.

---

## Features

- Generates AI-powered business audit reports
- Converts reports into downloadable PDFs
- Sends reports via email automatically
- Uploads PDFs to Google Drive
- Logs leads into Google Sheets

  
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
- Google Gemini API
- Google Drive API
- Google Sheets API

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
├── package-lock.json
├── package.json
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

- http://localhost:5174 (may vary between 5173–5174 depending on Vite)

---

## Backend Environment Variables

Create `backend/.env` with the following values:

```env
# Required for AI report generation (get from Google AI Studio)
GEMINI_API_KEY=


# GMAIL (Nodemailer)
EMAIL_USER=your_email_here
EMAIL_PASS=your_app_password_here


# Google Sheets
SPREADSHEET_ID=
SHEET_NAME=

# Google Drive
DRIVE_FOLDER_ID=

# OAuth (optional - only if using OAuth instead of service account)
OAUTH_CLIENT_ID=
OAUTH_CLIENT_SECRET=
OAUTH_REFRESH_TOKEN=
```

> If you use Gmail, generate an App Password and enable the required account access settings.

---

## Notes

- Run backend and frontend in separate terminals.
- The backend generates a PDF audit report and sends it by email using the configured SMTP credentials.
- Make sure Node.js is installed before running either service.
- Google Drive and Google Sheets require proper API setup and credentials in Google Cloud Console

## Limitations

- AI-generated reports depend on the quality of the submitted company information.
- The application currently uses Gemini API-generated insights rather than live web scraping or external company databases.
- Gmail SMTP requires valid credentials and App Password configuration.
