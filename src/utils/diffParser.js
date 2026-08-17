/**
 * Parses a unified git diff and extracts valid new-file line numbers for each file.
 * Returns a Map where key is the relative file path and value is a Set of line numbers (1-based)
 * in the new file that are present within diff hunks.
 *
 * @param {string} diffText - The raw unified diff string
 * @returns {Map<string, Set<number>>}
 */
function parseValidDiffLines(diffText) {
  const validLines = new Map();
  if (!diffText || typeof diffText !== 'string') return validLines;

  const lines = diffText.split('\n');
  let currentFile = null;
  let currentNewLine = 0;
  let inHunk = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Target file header: "+++ b/path/to/file" or "+++ path/to/file"
    if (line.startsWith('+++ ')) {
      const headerPath = line.slice(4).trim();
      if (headerPath === '/dev/null') {
        currentFile = null;
      } else if (headerPath.startsWith('b/')) {
        currentFile = headerPath.slice(2);
      } else {
        currentFile = headerPath;
      }
      if (currentFile && !validLines.has(currentFile)) {
        validLines.set(currentFile, new Set());
      }
      inHunk = false;
      continue;
    }

    // Hunk header: "@@ -10,5 +20,8 @@" or "@@ -1 +1 @@"
    if (line.startsWith('@@ ')) {
      inHunk = true;
      const match = line.match(/^@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/);
      if (match && currentFile) {
        currentNewLine = parseInt(match[1], 10);
      } else {
        inHunk = false;
      }
      continue;
    }

    if (!inHunk || !currentFile) continue;

    // Line prefix within hunk
    if (line.startsWith('+')) {
      validLines.get(currentFile).add(currentNewLine);
      currentNewLine++;
    } else if (line.startsWith(' ')) {
      validLines.get(currentFile).add(currentNewLine);
      currentNewLine++;
    } else if (line.startsWith('-')) {
      // Deletion line does not advance new file line counter
      continue;
    } else if (line.startsWith('\\')) {
      // e.g. "\ No newline at end of file"
      continue;
    }
  }

  return validLines;
}

/**
 * Partitions findings into valid inline findings and invalid/out-of-hunk findings.
 *
 * @param {Array<{file: string, line: number, severity: string, comment: string}>} findings
 * @param {Map<string, Set<number>>} validLinesMap
 * @returns {{ validInlineFindings: Array, invalidInlineFindings: Array }}
 */
function filterFindings(findings, validLinesMap) {
  const validInlineFindings = [];
  const invalidInlineFindings = [];

  if (!Array.isArray(findings)) {
    return { validInlineFindings, invalidInlineFindings };
  }

  for (const finding of findings) {
    if (!finding || typeof finding.file !== 'string' || typeof finding.line !== 'number') {
      invalidInlineFindings.push(finding);
      continue;
    }

    const fileLines = validLinesMap.get(finding.file);
    if (fileLines && fileLines.has(finding.line)) {
      validInlineFindings.push(finding);
    } else {
      invalidInlineFindings.push(finding);
    }
  }

  return { validInlineFindings, invalidInlineFindings };
}

module.exports = { parseValidDiffLines, filterFindings };
