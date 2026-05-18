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

  const prompt = `
Generate a professional business audit report.

Client Name: ${safeName}
Company: ${safeCompany}

Make it personalized and address the client by name where appropriate.

Include:
- Overview
- Strengths
- Weaknesses
- Recommendations

Do NOT use placeholders like [Your Name].
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

  return (
    data?.candidates?.[0]?.content?.parts?.[0]?.text ||
    "FAILED_TO_PARSE_RESPONSE"
  );
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
  const safeEmail = email || "test@example.com";

  if (!company) {
    return res.status(400).json({ error: "Company is required" });
  }

  try {
    const report = await generateReport(company, name);
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

    console.log("PDF generated:", fileName);
    await sendEmail(safeEmail, company, fileName);
console.log("Email sent to:", safeEmail);

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