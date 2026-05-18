import { uploadToDrive } from "./googleDrive.js";
import { appendLead } from "./googleSheets.js";
import nodemailer from "nodemailer";
import fs from "fs";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import PDFDocument from "pdfkit";

dotenv.config();

async function generateReport(company, name) {
  const safeName = name || "Client";
  const safeCompany = company || "Company";
  const currentDate = new Date().toLocaleDateString("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

  const prompt = `
Generate a professional business audit report.

Date: ${currentDate}
Client Name: ${safeName}
Company: ${safeCompany}

Make it personalized and address the client by name where appropriate.

Include:
- Overview
- Strengths
- Weaknesses
- Recommendations

Do NOT use placeholders like [Your Name].
Do NOT include fictional placeholders, bracketed text, or imaginary company names.
`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error(
      "Gemini API error",
      response.status,
      response.statusText,
      JSON.stringify(data)
    );
    return data?.error?.message || "FAILED_TO_PARSE_RESPONSE";
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    console.error("Gemini response missing text", JSON.stringify(data));
    return "FAILED_TO_PARSE_RESPONSE";
  }

  return text;
}

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

    async function sendEmail(to, company, filePath) {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to,
        subject: `Your ${company} Audit Report`,
        text: `Attached is your personalized company audit report.`,
        attachments: [
          {
            filename: `${company}_report.pdf`,
            path: filePath,
          },
        ],
      });
    }

    console.log("Report generated successfully");

    const doc = new PDFDocument();
    const safeFileCompany = (company || "company").replace(/\s+/g, "_");
    const fileName = `${safeFileCompany}_report.pdf`;

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

    console.log("PDF generated:", fileName);

    // Upload to Drive (attempt, but don't fail the whole request if it errors)
    let driveFile = null;
    let driveError = null;
    try {
      driveFile = await uploadToDrive(fileName, fileName);
      console.log("Drive upload complete:", driveFile.webViewLink);
    } catch (e) {
      driveError = e?.message || String(e);
      console.error("Drive upload failed:", driveError);
    }

    await sendEmail(safeEmail, company, fileName);
    await appendLead({
      name: safeName,
      email: safeEmail,
      company,
      status: "Sent",
    });

    console.log("Email sent to:", safeEmail);

    console.log("📊 Testing Sheets...");
    await appendLead({
      name: "Test User",
      email: "test@test.com",
      company: "Test Company",
      status: "Test Row",
    });
    console.log("📊 Sheets test done");

    res.json({
      message: "Report generated and emailed successfully",
      report,
      pdf: fileName,
      driveLink: driveFile?.webViewLink || null,
      driveError,
    });
  } catch (err) {
    console.log("🔥 ERROR:");
    console.dir(err, { depth: null });

    res.status(500).json({
      error: "Server error",
      message: err?.message,
    });
  }
});

app.listen(3001, () => {
  console.log("🚀 Server running on http://localhost:3001");
});