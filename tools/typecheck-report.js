'use strict';

const path = require('path');

// Classify by diagnostic location, not import reachability: a directly checked
// root can also be imported by another root. Diagnostics without a file remain
// visible in their own group instead of being silently dropped.
const categoryFor = (root) => (diagnostic) => {
  if (!diagnostic.file) return 'configuration/global';
  const relative = path.relative(root, diagnostic.file.fileName).split(path.sep).join('/');
  if (relative === 'type-fixtures/domain.ts') return 'fixtures';
  if (['types', 'commands', 'reducer', 'dispatch', 'selectors']
    .some((name) => relative === `server/domain/${name}.js`)) return 'core boundaries';
  return 'transitive modules';
};

const summarize = (root) => (diagnostics) => diagnostics.reduce((groups, diagnostic) => {
  const category = categoryFor(root)(diagnostic);
  return { ...groups, [category]: [...groups[category], diagnostic] };
}, { 'configuration/global': [], fixtures: [], 'core boundaries': [], 'transitive modules': [] });

const statusFor = (diagnostics) => diagnostics.length ? 1 : 0;

module.exports = { categoryFor, summarize, statusFor };
