console.log("🔥 THIS IS THE ACTIVE SERVER FILE");

import nodemailer from "nodemailer";
import fs from "fs";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import PDFDocument from "pdfkit";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

console.log("🔥 Backend starting...");

function generateReport(company) {
  return `
# Company Audit Report: ${company}

## Overview
${company} operates in a competitive market with opportunities for growth.

## Strengths
- Market potential
- Scalability
- Business flexibility

## Weaknesses
- Limited automation
- Weak digital presence
- Manual processes

## Recommendations
1. Improve digital marketing
2. Automate workflows
3. Strengthen brand presence
`;
}

app.post("/submit-lead", async (req, res) => {
  console.log("🔥 ROUTE HIT");

  const { company } = req.body;

  if (!company) {
    return res.status(400).json({ error: "Company is required" });
  }

  try {
    const report = generateReport(company);
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

    console.log("📄 REPORT GENERATED:\n", report);

    const doc = new PDFDocument();

    const fileName = `${company.replace(/\s+/g, "_")}_report.pdf`;

    doc.pipe(fs.createWriteStream(fileName));

    doc.fontSize(20).text(`${company} Audit Report`, {
      align: "center",
    });

    doc.moveDown();

    doc.fontSize(12).text(report);

    doc.end();

    console.log("📄 PDF GENERATED:", fileName);
    await sendEmail(email, company, fileName);
console.log("📧 EMAIL SENT TO:", email);

    res.json({
  message: "Report generated and emailed successfully",
  report,
  pdf: fileName,
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