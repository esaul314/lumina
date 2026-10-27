'use strict';

const path = require('path');
const ts = require('typescript');
const { summarize, statusFor } = require('./typecheck-report.js');

const root = path.resolve(__dirname, '..');
const configPath = path.join(root, 'tsconfig.domain.json');
const config = ts.readConfigFile(configPath, ts.sys.readFile);
const parsed = config.error
  ? { errors: [config.error], fileNames: [], options: {} }
  : ts.parseJsonConfigFileContent(config.config, ts.sys, root, undefined, configPath);
const program = ts.createProgram(parsed.fileNames, parsed.options);
const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)];
const groups = summarize(root)(diagnostics);
const details = process.argv.includes('--details');
const host = { getCanonicalFileName: (file) => file, getCurrentDirectory: () => root, getNewLine: () => '\n' };

console.log(`TypeScript ${ts.version}; no emit; strict domain diagnostic baseline`);
Object.entries(groups).forEach(([name, items]) => {
  console.log(`${name}: ${items.length}`);
  if (details && items.length) console.log(ts.formatDiagnostics(items, host));
});
if (diagnostics.length && !details) console.log('Run npm run typecheck:domain -- --details for all diagnostics.');
process.exitCode = statusFor(diagnostics);
