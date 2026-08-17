// Minimal in-memory guard against runaway webhook loops burning through
// API quota. Good enough for a single-instance portfolio deployment —
// swap for a Redis/DB-backed counter if this ever runs on multiple
// instances or needs to survive restarts.

const counts = new Map(); // key: "owner/repo:YYYY-MM-DD" -> count

function todayKey(owner, repo) {
  const date = new Date().toISOString().slice(0, 10);
  return `${owner}/${repo}:${date}`;
}

function canReview(owner, repo) {
  const limit = Number(process.env.MAX_REVIEWS_PER_REPO_PER_DAY || 20);
  const key = todayKey(owner, repo);
  const current = counts.get(key) || 0;
  return current < limit;
}

function recordReview(owner, repo) {
  const key = todayKey(owner, repo);
  counts.set(key, (counts.get(key) || 0) + 1);
}

module.exports = { canReview, recordReview };
