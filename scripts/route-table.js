#!/usr/bin/env node
/**
 * Route-table snapshot for refactors: loads app.js with external services stubbed (no database needed)
 * and writes every route (method, mount path, handler count), every app file loaded, and any module
 * that was read while still loading (a circular-import hazard).
 *
 *   node scripts/route-table.js <outFile> [appDir]
 *
 * Diff two outputs to prove a refactor kept the API surface identical.
 */
const path = require('path'), fs = require('fs'), Module = require('module');
const outFile = process.argv[2]; const appDir = path.resolve(process.argv[3] || path.join(__dirname, '..'));
if (!outFile) { console.error('usage: node scripts/route-table.js <outFile> [appDir]'); process.exit(2); }
Object.assign(process.env, {
  APP_NAME: 'x', NODE_ENV: 'production', CENTRAL_MYSQL_HOST: '127.0.0.1', CENTRAL_MYSQL_USER: 'x', CENTRAL_MYSQL_DB: 'x',
  CENTRAL_MYSQL_PORT: '1', JWT_SECRET: 'abcd', ACCESSDOMAINS: 'http://localhost', STRIPE_SECRET_KEY: 'sk_test_x',
  STRIPE_PUBLISHABLE_KEY: 'pk_test_x', OPENAI_API_KEY: 'x', SMTP_HOST: '127.0.0.1', SMTP_PORT: '1',
});
const fbStub = new Proxy(function () {}, { get: (t, k) => k === '__esModule' ? false : fbStub, apply: () => fbStub });
const partial = new Set();
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'firebase-admin' || request.startsWith('firebase-admin/')) return fbStub;
  if (request === '@google-cloud/storage') return { Storage: function () { return { getBuckets: async () => [[]], bucket: () => ({}) }; } };
  if (request === 'node-cron') return { schedule: () => ({}) };
  try {
    const f = Module._resolveFilename(request, parent, isMain);
    const c = require.cache[f];
    if (c && !c.loaded && parent && f.startsWith(appDir) && !f.includes('node_modules'))
      partial.add(path.relative(appDir, parent.filename) + ' -> ' + path.relative(appDir, f));
  } catch (e) {}
  return origLoad.apply(this, arguments);
};
process.on('unhandledRejection', () => {});
const app = require(path.join(appDir, 'app.js'));
const routes = [];
const walk = (stack, prefix) => stack.forEach(l => {
  const p = l.regexp ? l.regexp.source : '';
  if (l.route) routes.push(Object.keys(l.route.methods).join(',').toUpperCase() + ' ' + prefix + ' ' + l.route.path + ' [' + l.route.stack.length + ' handlers]');
  else if (l.handle && l.handle.stack) walk(l.handle.stack, prefix + ' ' + p);
});
walk(app._router.stack, '');
const loaded = Object.keys(require.cache).filter(f => f.startsWith(appDir) && !f.includes('node_modules')).map(f => path.relative(appDir, f)).sort();
fs.writeFileSync(outFile, ['# ROUTES ' + routes.length, ...routes, '# LOADED ' + loaded.length, ...loaded, '# PARTIAL ' + partial.size, ...[...partial].sort()].join('\n'));
console.log('routes', routes.length, 'loaded', loaded.length, 'partial', partial.size);
setTimeout(() => process.exit(0), 300);
