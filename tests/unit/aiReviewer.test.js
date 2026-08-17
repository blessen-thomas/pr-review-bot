const test = require('node:test');
const assert = require('node:assert');
const { parseFindings } = require('../../src/services/aiReviewer');

test('parseFindings - parses raw JSON array', () => {
  const input = '[{"file":"src/index.js","line":10,"severity":"info","comment":"Nice work"}]';
  const findings = parseFindings(input);
  assert.strictEqual(findings.length, 1);
  assert.strictEqual(findings[0].file, 'src/index.js');
  assert.strictEqual(findings[0].line, 10);
});

test('parseFindings - strips markdown code blocks defensively', () => {
  const input = '```json\n[{"file":"src/index.js","line":15,"severity":"warning","comment":"Potential bug"}]\n```';
  const findings = parseFindings(input);
  assert.strictEqual(findings.length, 1);
  assert.strictEqual(findings[0].file, 'src/index.js');
  assert.strictEqual(findings[0].severity, 'warning');
});

test('parseFindings - handles invalid JSON gracefully', () => {
  const input = 'Not valid JSON at all';
  const findings = parseFindings(input);
  assert.deepStrictEqual(findings, []);
});
