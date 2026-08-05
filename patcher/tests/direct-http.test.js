import https from "https";
import { URL } from "url";

const url = "https://tokenrhythm.studio/v1/chat/completions";
const parsedUrl = new URL(url);
const apiKey = process.env.PROMPT_ENHANCE_API_KEY || process.env.VITE_PROMPT_ENHANCE_API_KEY;

if (!apiKey) {
  console.log("[Test] SKIP: set PROMPT_ENHANCE_API_KEY or VITE_PROMPT_ENHANCE_API_KEY to run live HTTP check.");
  process.exit(0);
}

const body = JSON.stringify({
  model: "deepseek-v4-flash",
  messages: [{ role: "user", content: "Hi" }],
  max_tokens: 5,
});

console.log("[Test] Testing Direct Node.js HTTPS request to TokenRhythm API...");

const reqOptions = {
  hostname: parsedUrl.hostname,
  port: 443,
  path: parsedUrl.pathname,
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`,
    "Content-Length": Buffer.byteLength(body),
  },
  timeout: 10000,
};

const req = https.request(reqOptions, (res) => {
  console.log(`[Test] HTTP Response Status Code: ${res.statusCode}`);
  let data = "";
  res.on("data", (chunk) => { data += chunk; });
  res.on("end", () => {
    console.log(`[Test] Raw Response: ${data.substring(0, 200)}...`);
    if (res.statusCode === 200 || res.statusCode === 400 || res.statusCode === 401) {
      console.log(" SUCCESS: Node.js HTTPS native client connects without CORS limits!");
      process.exit(0);
    } else {
      console.error(` FAILED: Unexpected status code ${res.statusCode}`);
      process.exit(1);
    }
  });
});

req.on("error", (err) => {
  console.error(` FAILED: Request error: ${err.message}`);
  process.exit(1);
});

req.on("timeout", () => {
  console.error(" FAILED: Request timed out");
  req.destroy();
  process.exit(1);
});

req.write(body);
req.end();
