import { uploadToDrive } from "./googleDrive.js";
import { appendLead } from "./googleSheets.js";
import nodemailer from "nodemailer";
import fs from "fs";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import PDFDocument from "pdfkit";

dotenv.config();

function fallbackReport(currentDate, safeName, safeCompany) {
  return `
Business Audit Report

Date: ${currentDate}
Client Name: ${safeName}
Company: ${safeCompany}

Overview:
AI analysis is currently unavailable.

Strengths:
Manual review recommended.

Weaknesses:
Automated insights could not be generated.

Recommendations:
Please retry later.
`;
}

async function generateReport(company, name) {
  const safeName = name || "Client";
  const safeCompany = company || "Company";

  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: `
Generate a professional business audit report.

Date: ${currentDate}
Client Name: ${safeName}
Company: ${safeCompany}

Include:
- Overview
- Strengths
- Weaknesses
- Recommendations
              ` }],
            },
          ],
        }),
      }
    );

    const data = await response.json();

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!response.ok || !text) {
      throw new Error("Gemini failed or empty response");
    }

    return text;

  } catch (err) {
    console.error("Gemini error:", err.message);

    return `
Business Audit Report

Date: ${currentDate}
Client Name: ${safeName}
Company: ${safeCompany}

Overview:
AI analysis unavailable.

Strengths:
Manual review recommended.

Weaknesses:
API error or quota limit.

Recommendations:
Retry later.
`;
  }
}

/* ---------------- SERVER ---------------- */

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const app = express();
app.use(cors());
app.use(express.json());

console.log("🔥 Backend starting...");

app.post("/submit-lead", async (req, res) => {
  console.log("Route hit");

  const { company, email, name } = req.body;
  const safeName = name || "Client";
  const safeEmail = email || "test@example.com";

  if (!company) {
    return res.status(400).json({ error: "Company is required" });
  }

  try {
    const report = await generateReport(company, safeName);

    const doc = new PDFDocument();

    const safeFileCompany = (company || "company")
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase();

    const fileName = `${safeFileCompany}_${Date.now()}_report.pdf`;

    await new Promise((resolve, reject) => {
      const stream = fs.createWriteStream(fileName);

      stream.on("finish", resolve);
      stream.on("error", reject);

      doc.pipe(stream);

      doc.fontSize(20).text(`${company} Audit Report`, {
        align: "center",
      });

      doc.moveDown();

      const cleanReport = report
        .replace(/#/g, "")
        .replace(/\*\*/g, "")
        .replace(/\*/g, "");

      doc.fontSize(12).text(cleanReport);
      doc.end();
    });

    let driveFile = null;
    let driveError = null;

    try {
      driveFile = await uploadToDrive(fileName, fileName);
      console.log("Drive upload complete:", driveFile.webViewLink);
    } catch (e) {
      driveError = e?.message || String(e);
      console.error("Drive upload failed:", driveError);
    }

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: safeEmail,
      subject: `Your ${company} Audit Report`,
      text: "Attached is your audit report.",
      attachments: [{ filename: fileName, path: fileName }],
    });

    fs.unlinkSync(fileName);

    await appendLead({
      name: safeName,
      email: safeEmail,
      company,
      status: "Sent",
    });

    res.json({
      message: "Report generated and emailed successfully",
      report,
      pdf: fileName,
      driveLink: driveFile?.webViewLink || null,
      driveError,
    });
  } catch (err) {
    console.log("🔥 ERROR:", err);

    res.status(500).json({
      error: "Server error",
      message: err?.message,
    });
  }
});

app.listen(3001, () => {
  console.log("🚀 Server running on http://localhost:3001");
});