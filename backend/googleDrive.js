import { google } from "googleapis";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

let drive;

// Prefer OAuth2 (user account) if refresh token is provided — works for personal accounts.
if (
  process.env.OAUTH_REFRESH_TOKEN &&
  process.env.OAUTH_CLIENT_ID &&
  process.env.OAUTH_CLIENT_SECRET
) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.OAUTH_CLIENT_ID,
    process.env.OAUTH_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ refresh_token: process.env.OAUTH_REFRESH_TOKEN });
  drive = google.drive({ version: "v3", auth: oauth2Client });
} else {
  // Fallback to service account key file (existing behavior)
  const auth = new google.auth.GoogleAuth({
    keyFile: "credentials.json",
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });
  drive = google.drive({ version: "v3", auth });
}

export async function uploadToDrive(filePath, fileName) {
  const fileMetadata = {
    name: fileName,
  };

  if (process.env.DRIVE_FOLDER_ID) {
    fileMetadata.parents = [process.env.DRIVE_FOLDER_ID];
  }

  const media = {
    mimeType: "application/pdf",
    body: fs.createReadStream(filePath),
  };

  console.log("Google Drive upload auth type:", drive._options?.auth?.constructor?.name || "unknown");
  if (drive._options?.auth?.credentials) {
    console.log("Google Drive auth credentials keys:", Object.keys(drive._options.auth.credentials));
  }

  const response = await drive.files.create({
    requestBody: fileMetadata,
    media,
    fields: "id, webViewLink",
  });

  return response.data;
}
