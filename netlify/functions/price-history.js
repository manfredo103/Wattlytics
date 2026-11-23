import { Octokit } from "@octokit/rest";

const octokit = new Octokit({ auth: process.env.MY_GITHUB_TOKEN });
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes in-memory warm cache

const RESPONSE_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
  "Netlify-CDN-Cache-Control": "public, durable, max-age=3600, stale-while-revalidate=86400",
};

let cachedBody = null;
let cacheTimestamp = 0;

export async function handler(event) {
  const forceRefresh = event?.queryStringParameters?.refresh === "1";

  if (!forceRefresh && cachedBody && (Date.now() - cacheTimestamp) < CACHE_TTL_MS) {
    return {
      statusCode: 200,
      headers: RESPONSE_HEADERS,
      body: cachedBody,
    };
  }

  const owner = process.env.GITHUB_OWNER || "manfredo103";
  const repo = process.env.GITHUB_REPO || "Wattlytics";
  const branch = process.env.GITHUB_BRANCH;
  const path = "data/prices.json";

  try {
    const { data: rawFile } = await octokit.repos.getContent({
      owner,
      repo,
      path,
      ...(branch ? { ref: branch } : {}),
      mediaType: { format: "raw" },
    });

    const entries = typeof rawFile === "string"
      ? JSON.parse(rawFile)
      : Array.isArray(rawFile)
        ? rawFile
        : JSON.parse(Buffer.from(rawFile.content, "base64").toString("utf8"));

    const enriched = entries.map(entry => ({
      ...entry,
      percentDiff: parseFloat(
        (((entry.livePrice - entry.staticPrice) / entry.staticPrice) * 100).toFixed(2)
      ),
    }));

    cachedBody = JSON.stringify(enriched);
    cacheTimestamp = Date.now();

    return {
      statusCode: 200,
      headers: RESPONSE_HEADERS,
      body: cachedBody,
    };
  } catch (error) {
    console.error("Error in price-history.js:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: error.message }),
    };
  }
}
