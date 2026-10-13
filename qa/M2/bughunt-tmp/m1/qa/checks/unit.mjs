// unit: node's built-in test runner over qa/tests/**/*.test.mjs (same as `npm test`).
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { worst } from '../lib/util.mjs';

export const title = 'Unit tests (node --test qa/tests/)';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export default async function run() {
  const { code, out } = await new Promise((resolve) => {
    const p = spawn(process.execPath, ['--test', '--test-reporter=spec', 'qa/tests/**/*.test.mjs'], { cwd: ROOT, env: { ...process.env, NO_COLOR: '1' } });
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (out += d));
    const t = setTimeout(() => p.kill('SIGKILL'), 120000);
    p.on('close', (code) => { clearTimeout(t); resolve({ code, out }); });
  });
  const num = (k) => Number((out.match(new RegExp(`ℹ ${k} (\\d+)`)) || [])[1] ?? NaN);
  const data = { exitCode: code, tests: num('tests'), pass: num('pass'), fail: num('fail'), output: out.slice(-20000) };
  const status = code === 0 ? 'PASS' : 'FAIL';
  const md = `# unit\n\n\`node --test qa/tests/**/*.test.mjs\` → exit ${code}; tests ${data.tests}, pass ${data.pass}, fail ${data.fail}.\n\n\`\`\`\n${out.slice(-6000).trim()}\n\`\`\`\n`;
  return { status: worst(status), pages: {}, data, md };
}
