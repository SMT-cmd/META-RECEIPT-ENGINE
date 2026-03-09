const functions = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();
const db = admin.firestore();

/**
 * Generates a 6-character alphanumeric code.
 */
function generateCode() {
  return crypto.randomBytes(4).toString("hex").substring(0, 6);
}

/**
 * POST /shorten
 * Accepts { "url": "..." }
 * Returns { "code": "...", "shortUrl": "..." }
 * Note: Anonymous creation allowed for the Creator. 
 * Ownership is claimed by the first user who signs up via the link.
 */
exports.shorten = functions.https.onRequest(async (req, res) => {
  // Add CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.set('Access-Control-Max-Age', '3600');
    return res.status(204).send('');
  }

  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const { url } = req.body;
  if (!url) {
    return res.status(400).send("URL is required");
  }

  try {
    const code = generateCode();
    const shortDoc = db.collection("short_urls").doc(code);

    await shortDoc.set({
      original_url: url,
      owner_email: null, // To be claimed by the end-user
      owner_uid: null,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      device_fingerprints: []
    });

    // Determine the base URL for the redirect
    // In production, this would be your custom domain or firebase app domain
    const projectId = process.env.GCLOUD_PROJECT || "metaforge-6afdf";
    // Construct a shorter, cleaner URL
    const shortUrl = `https://${projectId}.web.app/r/${code}`;

    return res.status(200).json({
      code: code,
      shortUrl: shortUrl
    });
  } catch (error) {
    console.error("Error shortening URL:", error);
    return res.status(500).send("Internal Server Error");
  }
});

/**
 * GET /{code}
 * Performs 301 redirect
 */
exports.redirect = functions.https.onRequest(async (req, res) => {
  const code = req.path.split("/").pop();
  if (!code || code.length !== 6) {
    return res.status(400).send("Invalid code");
  }

  try {
    const doc = await db.collection("short_urls").doc(code).get();
    if (!doc.exists) {
      return res.status(404).send("URL not found");
    }

    let originalUrl = doc.data().original_url;
    // Append the short code to the hash so engine.html can detect it's a claimable link
    // The client expects #brandSlug_BASE64_sc=ABC123
    const separator = originalUrl.includes("#") ? "_sc=" : "#sc=";
    originalUrl += `${separator}${code}`;
    
    res.set("Cache-Control", "public, max-age=3600");
    return res.redirect(301, originalUrl);
  } catch (error) {
    console.error("Error redirecting:", error);
    return res.status(500).send("Internal Server Error");
  }
});
