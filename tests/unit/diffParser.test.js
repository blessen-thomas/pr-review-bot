const test = require('node:test');
const assert = require('node:assert');
const { parseValidDiffLines, filterFindings } = require('../../src/utils/diffParser');

const SAMPLE_DIFF = `
diff --git a/src/index.js b/src/index.js
index 1234567..89abcdef 100644
--- a/src/index.js
+++ b/src/index.js
@@ -10,3 +10,4 @@
 const express = require('express');
-const oldVar = 1;
+const newVar = 2;
+const addedVar = 3;
 const app = express();
diff --git a/src/utils/helper.js b/src/utils/helper.js
index 0000000..1111111 100644
--- /dev/null
+++ b/src/utils/helper.js
@@ -0,0 +1,2 @@
+function help() {}
+module.exports = help;
`.trim();

test('parseValidDiffLines - parses valid line numbers from diff hunks', () => {
  const validMap = parseValidDiffLines(SAMPLE_DIFF);

  assert.strictEqual(validMap.has('src/index.js'), true);
  assert.strictEqual(validMap.has('src/utils/helper.js'), true);

  const indexLines = validMap.get('src/index.js');
  // Lines 10 (context), 11 (+), 12 (+), 13 (context) are in the hunk
  assert.strictEqual(indexLines.has(10), true);
  assert.strictEqual(indexLines.has(11), true);
  assert.strictEqual(indexLines.has(12), true);
  assert.strictEqual(indexLines.has(13), true);
  assert.strictEqual(indexLines.has(14), false);
  assert.strictEqual(indexLines.has(99), false);

  const helperLines = validMap.get('src/utils/helper.js');
  assert.strictEqual(helperLines.has(1), true);
  assert.strictEqual(helperLines.has(2), true);
  assert.strictEqual(helperLines.has(3), false);
});

test('filterFindings - separates valid inline findings from out-of-hunk findings', () => {
  const validMap = parseValidDiffLines(SAMPLE_DIFF);
  const findings = [
    { file: 'src/index.js', line: 11, severity: 'warning', comment: 'Valid inline line' },
    { file: 'src/index.js', line: 99, severity: 'critical', comment: 'Invalid line out of hunk' },
    { file: 'src/utils/helper.js', line: 1, severity: 'info', comment: 'Valid new file line' },
    { file: 'unknown.js', line: 5, severity: 'info', comment: 'Unknown file finding' },
  ];

  const { validInlineFindings, invalidInlineFindings } = filterFindings(findings, validMap);

  assert.strictEqual(validInlineFindings.length, 2);
  assert.strictEqual(validInlineFindings[0].line, 11);
  assert.strictEqual(validInlineFindings[1].line, 1);

  assert.strictEqual(invalidInlineFindings.length, 2);
  assert.strictEqual(invalidInlineFindings[0].line, 99);
  assert.strictEqual(invalidInlineFindings[1].file, 'unknown.js');
});
