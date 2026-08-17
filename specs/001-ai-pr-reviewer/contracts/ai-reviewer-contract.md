# Interface Contract: AI Reviewer Thin Adapter

## Function: `reviewDiff(diff: string): Promise<AIFinding[]>`

Interface provided by `src/services/aiReviewer.js`.

### Input
- `diff` (String): Raw unified git diff string.

### Output
- `Promise<Array<AIFinding>>`: Array of objects:
  ```json
  [
    {
      "file": "src/routes/webhook.js",
      "line": 26,
      "severity": "warning",
      "comment": "Ensure rawBody is populated before timingSafeEqual check."
    }
  ]
  ```

### Guarantees
- Returns `[]` if no findings are detected or if LLM response cannot be parsed.
- Defensively strips markdown code fences (` ```json `) prior to JSON parsing.
