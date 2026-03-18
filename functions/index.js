const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

/**
 * GET /r/:code
 * Redirect resolver for Firebase Hosting
 */
exports.redirect = functions.https.onRequest(async (req, res) => {
    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*');
    
    // Extract code from path /r/CODE or query param
    const pathParts = req.path.split('/');
    const code = pathParts.pop() || req.query.c;

    if (!code || code.length < 5) {
        return res.status(400).send(`
            <html>
                <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                    <h1>Invalid Link</h1>
                    <p>The short code provided is invalid.</p>
                    <a href="/">Go to Homepage</a>
                </body>
            </html>
        `);
    }

    try {
        const doc = await db.collection("short_urls").doc(code.toUpperCase()).get();
        
        if (!doc.exists) {
            // Check lowercase as well just in case
            const docLower = await db.collection("short_urls").doc(code.toLowerCase()).get();
            if (!docLower.exists) {
                return res.status(404).send("Short URL not found.");
            }
            return resolveRedirect(docLower, res, code);
        }

        return resolveRedirect(doc, res, code);
        
    } catch (error) {
        console.error("Redirect error:", error);
        return res.status(500).send("Internal Server Error");
    }
});

async function resolveRedirect(doc, res, code) {
    const data = doc.data();
    if (data.status === 'shutdown') {
        return res.status(403).send("This engine has been deactivated.");
    }

    // Update usage count asynchronously
    doc.ref.update({ usage: admin.firestore.FieldValue.increment(1) });

    let destination;
    if (data.original_url) {
        destination = data.original_url;
    } else if (data.config) {
        // Legacy/Hash-only support: construct URL to engine
        destination = `https://${process.env.GCLOUD_PROJECT}.web.app/engine/index.html#_sc=${code}`;
    }

    if (!destination) {
        return res.status(404).send("Destination not found.");
    }

    // Perform redirect
    res.set("Cache-Control", "public, max-age=300");
    return res.redirect(302, destination);
}
