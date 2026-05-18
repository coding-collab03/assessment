import validator from "validator";
import axios from "axios";
import * as cheerio from "cheerio";
import { uploadToDrive } from "./googleDrive.js";
import { appendLead } from "./googleSheets.js";
import nodemailer from "nodemailer";
import fs from "fs";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import PDFDocument from "pdfkit";

dotenv.config();

async function scrapeWebsite(url) {
  try {
    if (!url.startsWith("http")) {
      url = "https://" + url;
    }

    const { data } = await axios.get(url, {
      timeout: 10000,
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    const $ = cheerio.load(data);

    const description =
  $('meta[name="description"]').attr("content") ||
  $('meta[property="og:description"]').attr("content") ||
  "";

    const title = $("title").text();
    const headings = $("h1, h2").text();
    const paragraphs = $("p").text();

    const text = `
Title: ${title}
OG Title: ${ogTitle}
Meta Description: ${description}
Keywords: ${keywords}

Headings: ${headings}

Content: ${paragraphs}
`;

    return text.replace(/\s+/g, " ").slice(0, 4000);

  } catch (err) {
    console.log("Scraping failed:", err.message);
    return "";
  }
}

async function generateReport(company, name, websiteContent) {
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
              parts: [{
  text: `
You are an AI business consultant.

Generate a highly personalized professional audit report.

Date: ${currentDate}
Client Name: ${safeName}
Company: ${safeCompany}

Company Website Content:
${websiteContent || "No website content available."}

IMPORTANT ROLE CLARIFICATION:
- Client Name is the person submitting the form (DO NOT assume they are the founder or owner)
- Company is the business being analyzed

DO NOT:
- assume ownership roles (e.g. "led by", "founded by") unless explicitly stated
- use placeholders like [Your Name], [Your Title], or signature blocks
- include sender details in the final output

Analyze the business and generate:

1. Executive Summary
2. Business Overview
3. Strengths
4. Weaknesses
5. Opportunities
6. Recommendations
7. Personalized Outreach Message

For the Personalized Outreach Message:
- Write it like a professional email
- Do NOT include sender name, title, or signature section
- End naturally without placeholders

Be specific to the company.
Avoid generic statements.
Keep the tone professional.
`
}],
            },
          ],
        }),
      }
    );

    const data = await response.json();
console.log("GEMINI RAW RESPONSE:", JSON.stringify(data, null, 2));

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!response.ok || !text) {
  console.log("STATUS:", response.status);
  console.log("BODY:", data);
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

  const { company, email, name, website } = req.body;
  if (!email || !validator.isEmail(email)) {
  return res.status(400).json({
    error: "Valid email is required",
  });
}
  const safeName = name || "Client";
 
  const safeEmail = email;

  if (!company) {
    return res.status(400).json({ error: "Company is required" });
  }

  try {
    const websiteContent = website
  ? await scrapeWebsite(website)
  : "";

    const report = await generateReport(
  company,
  safeName,
  websiteContent
);

    const doc = new PDFDocument();

    const safeFileCompany = (company || "company")
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase();

    const fileName = `/tmp/${safeFileCompany}_${Date.now()}_report.pdf`;

    await new Promise((resolve, reject) => {
  let stream;

  try {
    stream = fs.createWriteStream(fileName);

    stream.on("finish", resolve);
    stream.on("error", reject);

    doc.pipe(stream);

    const cleanReport = report
      .replace(/#/g, "")
      .replace(/\*\*/g, "")
      .replace(/\*/g, "");

    doc.fillColor("#1E3A8A");

    doc.fontSize(24).text(`${company} Audit Report`, {
      align: "center",
    });

    doc.moveDown();

    doc.fillColor("gray");

    doc.fontSize(10).text(
      `Generated on ${new Date().toLocaleString()}`,
      { align: "center" }
    );

    doc.moveDown(2);

    doc.fillColor("black");

    doc.fontSize(12).text(cleanReport, {
      lineGap: 4,
    });

    doc.end();

  } catch (err) {
    reject(err);
  }
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
      html: `
<h2>Hello ${safeName},</h2>

<p>Thank you for your interest.</p>

<p>Please find attached your personalized business audit report for <strong>${company}</strong>.</p>

<p>We hope these insights provide value and actionable recommendations for your business.</p>

<p>Best regards,<br/>SimplifIQ AI Team</p>
`,
      attachments: [{ filename: fileName, path: fileName }],
    });

    try {
  fs.unlinkSync(fileName);
} catch (e) {
  console.log("File cleanup failed:", e.message);
}

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