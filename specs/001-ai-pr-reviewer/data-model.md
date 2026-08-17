# Data Model: AI PR Reviewer Bot

## Entities

### 1. Webhook Payload
Represents the incoming HTTP request body from GitHub for `pull_request` events (`opened`, `synchronize`, `reopened`).

```json
{
  "action": "opened",
  "installation": { "id": 123456 },
  "repository": {
    "name": "pr-review-bot",
    "owner": { "login": "blessen-thomas" }
  },
  "pull_request": {
    "number": 1,
    "head": { "sha": "abc123def456" }
  }
}
```

### 2. Review Queue Job Data
Structured payload enqueued into BullMQ queue `pr-reviews`.

| Field | Type | Description | Validation |
|-------|------|-------------|------------|
| `installationId` | Number/String | GitHub App installation ID | Required |
| `owner` | String | Repository owner username/org | Required |
| `repo` | String | Repository name | Required |
| `pullNumber` | Number | Pull Request number | Required, > 0 |
| `headSha` | String | Head commit SHA | Required |

### 3. AI Finding
Structured finding parsed from the LLM response.

| Field | Type | Options | Description |
|-------|------|---------|-------------|
| `file` | String | | Relative file path in diff |
| `line` | Number | | Target line number in new file |
| `severity` | String | `"info" \| "warning" \| "critical"` | Severity rating |
| `comment` | String | | Actionable review suggestion |

### 4. Review Comment Post Payload
Payload passed to Octokit `postReview` function.

```json
{
  "owner": "blessen-thomas",
  "repo": "pr-review-bot",
  "pullNumber": 1,
  "headSha": "abc123def456",
  "body": "Automated review — 2 finding(s).",
  "comments": [
    {
      "path": "src/index.js",
      "line": 15,
      "body": "**[warning]** Missing error handler for unhandled rejections."
    }
  ]
}
```
