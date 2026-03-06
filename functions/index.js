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
 */
exports.shorten = functions.https.onRequest(async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const { url } = req.body;
  if (!url) {
    return res.status(400).send("URL is required");
  }

  // Auth check (required by prompt)
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send("Unauthorized");
  }
  const idToken = authHeader.split("Bearer ")[1];
  
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const email = decodedToken.email;
    const uid = decodedToken.uid;

    const code = generateCode();
    const shortDoc = db.collection("short_urls").doc(code);

    await shortDoc.set({
      original_url: url,
      owner_email: email,
      owner_uid: uid,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      device_fingerprints: [] // To be updated by client
    });

    return res.status(200).json({
      code: code,
      shortUrl: `https://${process.env.FUNCTION_REGION}-${process.env.GCLOUD_PROJECT}.cloudfunctions.net/redirect/${code}`
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

    const originalUrl = doc.data().original_url;
    // The prompt says "last successfully fetched redirect target" should be cached by SW.
    // We'll set headers to allow caching if needed, but 301 is usually cached by browsers.
    res.set("Cache-Control", "public, max-age=3600");
    return res.redirect(301, originalUrl);
  } catch (error) {
    console.error("Error redirecting:", error);
    return res.status(500).send("Internal Server Error");
  }
});
