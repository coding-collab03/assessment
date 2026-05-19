import os from "os";
import path from "path";
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

/* =====================================================
   HELPERS
===================================================== */

function normalizeUrl(url) {
  if (!url) return null;

  if (!url.startsWith("http")) {
    return `https://${url}`;
  }

  return url;
}

function cleanText(text = "") {
  return text
    .replace(/[`"]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\n+/g, " ")
    .replace(/•+/g, "•")
    .trim();
}

function sanitizeFilename(name = "company") {
  return name
    .replace(/[^a-z0-9]/gi, "_")
    .toLowerCase();
}

function sectionTitle(doc, title) {
  doc
    .moveDown(1.2)
    .font("Helvetica-Bold")
    .fontSize(16)
    .fillColor("#1E3A8A")
    .text(title);

  doc
    .moveTo(50, doc.y + 5)
    .lineTo(545, doc.y + 5)
    .strokeColor("#D1D5DB")
    .stroke();

  doc.moveDown(0.8);
}

/* =====================================================
   SCRAPER / ENRICHMENT
===================================================== */

async function fetchPage(url) {
  try {
    console.log("FETCHING:", url);

    const response = await axios.get(url, {
      timeout: 20000,
      maxRedirects: 5,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://google.com",
      },
    });

    return response.data;
  } catch (err) {
    console.log("FETCH ERROR");
    console.log("URL:", url);
    console.log("STATUS:", err?.response?.status);
    console.log("MESSAGE:", err.message);

    return null;
  }
}

async function scrapeWebsite(baseUrl) {
  try {
    const normalizedUrl = normalizeUrl(baseUrl);

    console.log("SCRAPING WEBSITE:", normalizedUrl);

    const homepageHtml = await fetchPage(normalizedUrl);

    /* ---------- FALLBACK ---------- */

    if (!homepageHtml) {
      return {
        url: normalizedUrl,
        title: "Unavailable",
        description: "Website scraping blocked or unavailable",
        ogTitle: "",
        keywords: "",
        headings: [],
        paragraphs: [],
        importantPageContent: [],
      };
    }

    const $ = cheerio.load(homepageHtml);

    /* ---------- BASIC PAGE DATA ---------- */

    const title = cleanText($("title").text());

    const description =
      cleanText(
        $('meta[name="description"]').attr("content") ||
          $('meta[property="og:description"]').attr("content") ||
          ""
      ) || "No description available";

    const ogTitle = cleanText(
      $('meta[property="og:title"]').attr("content") || ""
    );

    const keywords = cleanText(
      $('meta[name="keywords"]').attr("content") || ""
    );

    /* ---------- HEADINGS ---------- */

    const headings = $("h1, h2, h3")
      .map((_, el) => cleanText($(el).text()))
      .get()
      .filter(Boolean)
      .slice(0, 20);

    /* ---------- PARAGRAPHS ---------- */

    const paragraphs = $("p")
      .map((_, el) => cleanText($(el).text()))
      .get()
      .filter(
  (p) =>
    p.length > 60 &&
    p.length < 350 &&
    !p.includes("{") &&
    !p.includes("}") &&
    !p.includes("[") &&
    !p.includes("]")
)
      .slice(0, 25);

    /* ---------- IMPORTANT INTERNAL LINKS ---------- */

    const internalLinks = [
  ...new Set(
    $("a")
      .map((_, el) => $(el).attr("href"))
      .get()
  ),
]
      .filter(Boolean)
      .map((href) => String(href).toLowerCase())
      .filter(
        (href) =>
          href.includes("about") ||
          href.includes("service") ||
          href.includes("solution") ||
          href.includes("feature") ||
          href.includes("product")
      )
      .slice(0, 5);

    const importantPageContent = [];

    /* ---------- SCRAPE IMPORTANT PAGES ---------- */

    for (const link of internalLinks) {
      try {
        const fullUrl = new URL(link, normalizedUrl).href;

        console.log("SCRAPING INTERNAL PAGE:", fullUrl);

        const html = await fetchPage(fullUrl);

        if (!html) continue;

        const page$ = cheerio.load(html);

        const content = page$("p")
          .map((_, el) => cleanText(page$(el).text()))
          .get()
          .filter(
  (p) =>
    p.length > 80 &&
    p.length < 350 &&
    !p.includes("{") &&
    !p.includes("}") &&
    !p.includes("[") &&
    !p.includes("]")
)
          .slice(0, 5);

        importantPageContent.push({
          page: fullUrl,
          content,
        });
      } catch (e) {
        console.log(
          "IMPORTANT PAGE SCRAPE FAILED:",
          e.message
        );
      }
    }

    /* ---------- FINAL ENRICHMENT ---------- */

    return {
      url: normalizedUrl,
      title,
      ogTitle,
      description,
      keywords,
      headings,
      paragraphs,
      importantPageContent,
    };
  } catch (err) {
    console.log("SCRAPING FAILED:");
    console.log(err);

    return {
      url: normalizeUrl(baseUrl),
      title: "Unavailable",
      description: "Website scraping encountered an error",
      ogTitle: "",
      keywords: "",
      headings: [],
      paragraphs: [],
      importantPageContent: [],
    };
  }
}

/* =====================================================
   GEMINI REPORT GENERATION
===================================================== */

async function generateReport(company, name, enrichment) {
  const safeCompany = company || "Company";
  const safeName = name || "Client";

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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `
You are a senior AI business consultant creating a premium client audit.

Generate a highly personalized, practical, professional business analysis.

DATE: ${currentDate}
CLIENT NAME: ${safeName}
COMPANY: ${safeCompany}

========================
SCRAPED WEBSITE DATA
========================

${JSON.stringify(enrichment, null, 2)}

========================
IMPORTANT REQUIREMENTS
========================

- Use the REAL website data provided
- Mention actual headings, messaging, services, positioning, or themes
- Infer likely business priorities from the website copy
- Analyze clarity of positioning and trust signals
- Comment on branding, messaging, and conversion opportunities
- Mention website strengths and weaknesses
- Include practical recommendations
- Do NOT invent fake features or unsupported claims
- If data is missing, mention limited visibility instead of hallucinating
- Write like a professional consultant
- Make the report sound expensive and human-written
- Avoid generic AI wording
- Avoid repetitive phrasing
- Do NOT use placeholders like [Name]
- End naturally with:
Best regards,
Business Insights Team

========================
REPORT STRUCTURE
========================

1. Executive Summary
2. Company Positioning Analysis
3. Website & Messaging Review
4. Brand & Trust Signal Analysis
5. Strengths
6. Weaknesses & Risks
7. Growth Opportunities
8. Actionable Recommendations
9. Personalized Outreach Email

========================
OUTREACH EMAIL RULES
========================

- Sound natural and personalized
- Mention at least 2 real observations from the website
- Keep it concise and executive-level
- No placeholders
- No fake names/signatures
- End naturally
`,
                },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API Error: ${response.status}`);
    }

    const data = await response.json();

    console.log(
      "GEMINI RAW RESPONSE:",
      JSON.stringify(data, null, 2)
    );

    const report =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!report) {
      throw new Error("Empty Gemini response");
    }

    return report;
  } catch (err) {
  console.error(
    "Gemini generation failed:",
    err.message
  );

  return `
Executive Summary

AI analysis could not be generated due to a temporary processing issue.

However, website data was successfully collected and analyzed.

Recommendations

- Retry report generation
- Validate Gemini API quota and credentials
- Verify website accessibility
`;
}
}


/* =====================================================
   PDF GENERATION
===================================================== */

async function createProfessionalPdf({
  company,
  report,
  enrichment,
}) {
  const safeCompany = sanitizeFilename(company);

  const fileName = path.join(
    os.tmpdir(),
    `${safeCompany}_${Date.now()}_audit_report.pdf`
  );

  const doc = new PDFDocument({
    margin: 50,
    size: "A4",
  });

  await new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(fileName);

    stream.on("finish", resolve);
    stream.on("error", reject);

    doc.pipe(stream);

    /* ---------- HEADER ---------- */

    doc
      .rect(0, 0, 700, 120)
      .fill("#0F172A");

    doc
      .fillColor("white")
      .font("Helvetica-Bold")
      .fontSize(28)
      .text(`${company} Audit Report`, 50, 40);

    doc
      .fontSize(12)
      .font("Helvetica")
      .text(
        `Generated on ${new Date().toLocaleString()}`,
        50,
        80
      );

    doc.moveDown(5);

    /* ---------- SNAPSHOT ---------- */

    sectionTitle(doc, "Company Snapshot");

    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor("black")
      .text(`Website: ${enrichment?.url || "N/A"}`)
      .moveDown(0.5)
      .text(`Page Title: ${enrichment?.title || "N/A"}`)
      .moveDown(0.5)
      .text(
        `Meta Description: ${
          enrichment?.description || "N/A"
        }`
      );

    /* ---------- SIGNALS ---------- */

    sectionTitle(doc, "Website Insights Summary");

const headings = [...new Set(enrichment?.headings || [])].slice(0, 10);
const paragraphs = [...new Set(enrichment?.paragraphs || [])].slice(0, 6);
const pages = [
  ...new Map(
    (enrichment?.importantPageContent || []).map((p) => [
      p.page,
      p,
    ])
  ).values(),
];

doc
  .font("Helvetica-Bold")
  .fontSize(12)
  .fillColor("#111827")
  .text("Overview");

doc
  .font("Helvetica")
  .fontSize(11)
  .fillColor("#374151")
  .text(`Website: ${enrichment?.url || "N/A"}`)
  .text(`Title: ${enrichment?.title || "N/A"}`)
  .text(`Description: ${enrichment?.description || "N/A"}`);

doc.moveDown(0.8);

doc
  .font("Helvetica-Bold")
  .fontSize(12)
  .text("Key Messaging Themes");

headings.forEach((h) => {
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#374151")
    .text(`• ${h}`, {
  width: 470,
  lineGap: 2,
});
});

doc.moveDown(0.8);

doc
  .font("Helvetica-Bold")
  .fontSize(12)
  .text("Content Signals");

paragraphs.forEach((p) => {
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#4B5563")
    .text(`• ${p.slice(0, 140)}...`);
    if (doc.y > 700) {
  doc.addPage();
}

});

if (pages.length) {
  doc.moveDown(0.8);

  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .text("Internal Page Insights");

  pages.slice(0, 2).forEach((page) => {
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(`• ${page.page}`);

    (page.content || []).slice(0, 2).forEach((c) => {
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#4B5563")
        .text(`   - ${c.slice(0, 120)}...`);
    });
  });
}

    /* ---------- REPORT ---------- */

    sectionTitle(doc, "AI Business Analysis");
    
    const cleanedReport = report
  .replace(/^#+\s?/gm, "")
  .replace(/\*\*/g, "")
  .replace(/\*/g, "")
  .replace(/```/g, "")
  .trim();
    const sections = cleanedReport
  .split(/\n(?=[A-Z][A-Za-z\s&]+(?:\:)?\n)/)
  .filter(Boolean);

sections.forEach((section) => {
  if (doc.y > 680) doc.addPage();

  const lines = section.trim().split("\n");
  const title = (lines.shift() || "").trim();
  const body = lines.join("\n").trim();

  doc
    .moveDown(0.8)
    .font("Helvetica-Bold")
    .fontSize(14)
    .fillColor("#111827")
    .text(title);

  doc
    .moveDown(0.3)
    .font("Helvetica")
    .fontSize(11)
    .fillColor("#374151")
    .text(body, {
      width: 470,
      lineGap: 4,
      align: "left",
    });
});

    /* ---------- FOOTER ---------- */

    doc.moveDown(2);

    doc
      .font("Helvetica-Oblique")
      .fontSize(9)
      .fillColor("gray")
      .text(
        "This report was generated using AI-powered website analysis and publicly available information.",
        {
          align: "center",
        }
      );

      
    doc.end();
  });

  return fileName;
}

/* =====================================================
   EMAIL CONFIG
===================================================== */

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/* =====================================================
   EXPRESS SETUP
===================================================== */

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

console.log("Backend starting...");

/* =====================================================
   ROUTES
===================================================== */

app.post("/submit-lead", async (req, res) => {
  console.log("Route hit");

  const { company, email, name, website } = req.body;

  /* ---------- VALIDATION ---------- */

  if (!email || !validator.isEmail(email)) {
    return res.status(400).json({
      error: "A valid email address is required.",
    });
  }

  if (!company || company.trim().length < 2) {
    return res.status(400).json({
      error: "A valid company name is required.",
    });
  }

  if (
    website &&
    !validator.isURL(normalizeUrl(website))
  ) {
    return res.status(400).json({
      error: "Invalid website URL.",
    });
  }

  const safeName = name?.trim() || "Client";

  try {
    /* ---------- SCRAPE ---------- */

    let enrichment = null;

    if (website) {
      enrichment = await scrapeWebsite(website);
    }

    console.log(
      "ENRICHMENT RESULT:",
      JSON.stringify(enrichment, null, 2)
    );

    /* ---------- AI REPORT ---------- */

    const report = await generateReport(
      company,
      safeName,
      enrichment
    );

    /* ---------- PDF ---------- */

    const pdfPath =
      await createProfessionalPdf({
        company,
        report,
        enrichment,
      });

    /* ---------- PARALLEL TASKS ---------- */

    const uploadPromise = uploadToDrive(
      pdfPath,
      path.basename(pdfPath)
    ).catch((err) => {
      console.error(
        "Drive upload failed:",
        err.message
      );
      return null;
    });

    const emailPromise = transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: `${company} - Personalized Audit Report`,
      html: `
<div style="font-family: Arial, sans-serif; line-height: 1.6;">
  <h2>Hello ${safeName},</h2>

  <p>
    We reviewed <strong>${company}</strong> and generated a personalized audit report based on publicly available website and positioning signals.
  </p>

  <p>
    The attached report includes insights around branding, positioning, messaging clarity, and growth opportunities.
  </p>

  <p>
    Thank you for reviewing the analysis.
  </p>

  <p>
    Best regards,<br/>
    Business Insights Team
  </p>
</div>
`,
      attachments: [
        {
          filename: `${sanitizeFilename(
            company
          )}_audit_report.pdf`,
          path: pdfPath,
        },
      ],
    });

    const sheetsPromise = appendLead({
      name: safeName,
      email,
      company,
      website: website || "N/A",
      enriched: !!enrichment,
      status: "Completed",
      timestamp: new Date().toISOString(),
    }).catch((err) => {
      console.error(
        "Sheets logging failed:",
        err.message
      );
      return null;
    });

    const [driveFile] = await Promise.all([
      uploadPromise,
      emailPromise,
      sheetsPromise,
    ]);

    /* ---------- CLEANUP ---------- */

    try {
      fs.unlinkSync(pdfPath);
    } catch (err) {
      console.error(
        "PDF cleanup failed:",
        err.message
      );
    }

    /* ---------- RESPONSE ---------- */

    return res.json({
      success: true,
      message:
        "Lead processed successfully. Report generated and emailed.",
      enriched: !!enrichment,
      driveLink: driveFile?.webViewLink || null,
    });
  } catch (err) {
    console.error("SERVER ERROR:", err);

    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: err.message,
    });
  }
});

/* =====================================================
   HEALTH CHECK
===================================================== */

app.get("/health", (_, res) => {
  res.json({
    success: true,
    status: "Server running",
    timestamp: new Date().toISOString(),
  });
});

/* =====================================================
   START SERVER
===================================================== */

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(
    `Server running on http://localhost:${PORT}`
  );
});