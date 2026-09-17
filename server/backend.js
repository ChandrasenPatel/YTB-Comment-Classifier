require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const HF_API_KEY = process.env.HF_API_KEY;

console.log("YOUTUBE_API_KEY:", !!YOUTUBE_API_KEY);
console.log("HF_API_KEY:", !!HF_API_KEY);

// -----------------------------
// Extract YouTube video ID
// -----------------------------
function extractVideoId(url) {
    try {
        const urlObj = new URL(url);
        let videoId = null;

        if (urlObj.hostname === "youtu.be") {
            videoId = urlObj.pathname.slice(1);
        } else if (urlObj.searchParams.get("v")) {
            videoId = urlObj.searchParams.get("v");
        } else if (urlObj.pathname.includes("/shorts/")) {
            videoId = urlObj.pathname.split("/shorts/")[1];
        } else if (urlObj.pathname.includes("/embed/")) {
            videoId = urlObj.pathname.split("/embed/")[1];
        } else if (urlObj.pathname.includes("/live/")) {
            videoId = urlObj.pathname.split("/live/")[1];
        }

        if (videoId) {
            videoId = videoId.split("?")[0].split("&")[0];
        }

        return videoId;
    } catch {
        return null;
    }
}

// -----------------------------
// Demo classifier
// -----------------------------
function demoClassify(text) {
    text = text.toLowerCase();

    const spamPatterns = [
        "http", "www", ".com", ".in", ".net",
        "subscribe", "subscribers", "check my channel",
        "earn money", "free", "offer", "click", "link",
        "whatsapp", "telegram", "dm me"
    ];

    const abusiveWords = [
        "idiot", "stupid", "dumb", "hate", "trash", "useless",
        "bakwas", "bekar", "chutiya", "madarchod"
    ];

    const positiveWords = [
        "good", "great", "amazing", "awesome", "nice",
        "love", "best", "beautiful", "legend", "respect",
        "mast", "badiya"
    ];

    const negativeWords = [
        "bad", "worst", "boring", "waste",
        "not good", "poor", "dislike", "low quality",
        "bekar", "faltu"
    ];

    const positiveEmojis = ["❤️", "😍", "🔥", "😊", "😄", "👍", "🙌", "🎉"];
    const negativeEmojis = ["😒", "😞", "😔", "😢", "👎", "😕"];
    const abusiveEmojis = ["🤬", "😡", "😠", "💢"];

    const containsAny = (arr) => arr.some((word) => text.includes(word));

    if (containsAny(spamPatterns) || /\d{10}/.test(text)) return "spam";
    if (containsAny(abusiveWords) || containsAny(abusiveEmojis)) return "abusive";
    if (containsAny(positiveWords) || containsAny(positiveEmojis)) return "positive";
    if (containsAny(negativeWords) || containsAny(negativeEmojis)) return "negative";

    return "neutral";
}

// -----------------------------
// Real classifier helpers
// -----------------------------
function normalizeLabel(label) {
    if (!label) return "neutral";

    const lower = label.toLowerCase();

    if (lower.includes("positive")) return "positive";
    if (lower.includes("negative")) return "negative";
    if (lower.includes("neutral")) return "neutral";
    if (lower.includes("spam")) return "spam";
    if (lower.includes("abusive")) return "abusive";

    return "neutral";
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function zeroShotClassify(text, labels, retries = 1) {
    try {
        const response = await fetch(
            "https://router.huggingface.co/hf-inference/models/facebook/bart-large-mnli",
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${HF_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    inputs: text,
                    parameters: {
                        candidate_labels: labels
                    }
                })
            }
        );

        const rawText = await response.text();

        if (!response.ok) {
            throw new Error(`HF API failed: ${rawText}`);
        }

        return JSON.parse(rawText);
    } catch (error) {
        if (retries > 0) {
            await sleep(800);
            return zeroShotClassify(text, labels, retries - 1);
        }
        throw error;
    }
}

async function realClassify(text) {
    const labels = [
        "positive comment",
        "negative comment",
        "neutral comment",
        "spam comment",
        "abusive comment"
    ];

    const result = await zeroShotClassify(text, labels);

    if (!Array.isArray(result) || result.length === 0) {
        return "neutral";
    }

    return normalizeLabel(result[0].label);
}

// -----------------------------
// Fetch YouTube comments
// -----------------------------
async function getAllComments(videoId, limit = 20) {
    let allComments = [];
    let nextPageToken = null;

    try {
        do {
            const url = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&key=${YOUTUBE_API_KEY}&maxResults=100&pageToken=${nextPageToken || ""}&textFormat=plainText`;

            const response = await fetch(url);

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`YouTube API request failed: ${errText}`);
            }

            const data = await response.json();

            const comments = (data.items || []).map(
                (item) => item.snippet.topLevelComment.snippet.textDisplay
            );

            allComments = [...allComments, ...comments];

            if (allComments.length >= limit) {
                return allComments.slice(0, limit);
            }

            nextPageToken = data.nextPageToken;
        } while (nextPageToken);

        return allComments.slice(0, limit);
    } catch (error) {
        console.log("YouTube comments error:", error.message);
        return [];
    }
}

// -----------------------------
// Summary helper
// -----------------------------
function createSectionSummary() {
    return {
        positive: 0,
        negative: 0,
        neutral: 0,
        spam: 0,
        abusive: 0
    };
}

// -----------------------------
// Demo endpoint
// -----------------------------
app.post("/classify-demo", async (req, res) => {
    const { url } = req.body;
    const videoId = extractVideoId(url);

    if (!videoId) {
        return res.status(400).json({ error: "Invalid YouTube URL" });
    }

    try {
        const comments = await getAllComments(videoId, 50);

        if (!comments.length) {
            return res.json({
                totalComments: 0,
                demoSection: createSectionSummary(),
                demoComments: []
            });
        }

        const demoSection = createSectionSummary();
        const demoComments = [];

        for (const comment of comments) {
            const label = demoClassify(comment);

            demoComments.push({
                text: comment,
                label
            });

            if (demoSection[label] !== undefined) {
                demoSection[label]++;
            }
        }

        return res.json({
            totalComments: comments.length,
            demoSection,
            demoComments
        });
    } catch (error) {
        console.log("Demo route error:", error.message);
        return res.status(500).json({ error: "Demo classification failed" });
    }
});

// -----------------------------
// Real endpoint
// -----------------------------
app.post("/classify-real", async (req, res) => {
    const { url } = req.body;
    const videoId = extractVideoId(url);

    if (!videoId) {
        return res.status(400).json({ error: "Invalid YouTube URL" });
    }

    try {
        const comments = await getAllComments(videoId, 50);

        if (!comments.length) {
            return res.json({
                totalComments: 0,
                realSection: createSectionSummary(),
                realComments: []
            });
        }

        const realSection = createSectionSummary();
        const realComments = [];

        for (const comment of comments) {
            try {
                const label = await realClassify(comment);

                realComments.push({
                    text: comment,
                    label
                });

                if (realSection[label] !== undefined) {
                    realSection[label]++;
                }

                await sleep(500);
            } catch (err) {
                console.log("HF classify error:", err.message);

                realComments.push({
                    text: comment,
                    label: "neutral"
                });

                realSection.neutral++;
            }
        }

        return res.json({
            totalComments: comments.length,
            realSection,
            realComments
        });
    } catch (error) {
        console.log("Real route error:", error.message);
        return res.status(500).json({ error: "Real classification failed" });
    }
});
app.get("/", (req, res) => {
    res.send("Server is running");
});


app.listen(process.env.PORT || 5000, () => {
    console.log(`Server running on port ${process.env.PORT || 5000}`);
});