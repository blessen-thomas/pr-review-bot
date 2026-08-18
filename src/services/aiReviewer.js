const { GoogleGenerativeAI } = require('@google/generative-ai');

// This file is the single swap-in point for the AI provider. Everything
// upstream (webhook handling, queueing, GitHub posting) only ever calls
// `reviewDiff(diff)` and expects back an array of
// { file, line, severity, comment } — so switching providers later
// (e.g. back to Claude) means rewriting this file only.

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SYSTEM_PROMPT = `You are an automated code reviewer. You will be given a unified git diff.
Review only the changed lines. Look for bugs, security issues, unclear naming,
missing error handling, and obvious style problems. Do not comment on
unchanged code or nitpick formatting that a linter would catch.

Respond with ONLY a JSON array (no markdown fences, no prose) of objects:
[{ "file": "<path from the diff>", "line": <line number in the new file>, "severity": "info"|"warning"|"critical", "comment": "<short, specific, actionable comment>" }]

If there is nothing worth flagging, respond with an empty array: []`;

async function reviewDiff(diff) {
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
    systemInstruction: SYSTEM_PROMPT,
  });

  const result = await model.generateContent(diff);
  const text = result.response.text();

  return parseFindings(text);
}

function parseFindings(rawText) {
  // Models sometimes wrap JSON in ```json fences despite instructions —
  // strip those defensively before parsing.
  const cleaned = rawText.replace(/```json|```/g, '').trim();

  let findings;
  try {
    findings = JSON.parse(cleaned);
  } catch (err) {
    console.error('Failed to parse AI response as JSON:', rawText);
    return [];
  }

  if (!Array.isArray(findings)) return [];

  return findings.filter(
    (f) => f && typeof f.file === 'string' && typeof f.line === 'number' && typeof f.comment === 'string'
  );
}

module.exports = { reviewDiff, parseFindings };
