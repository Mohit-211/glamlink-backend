#!/usr/bin/env node
/**
 * Route-table snapshot for refactors: loads app.js with external services stubbed (no database needed)
 * and writes every route (method, full path, handler count), every app file loaded, and any module
 * that was read while still loading (a circular-import hazard). Routes are recorded as routers register
 * them, so the output is the same on Express 4 and 5.
 *
 *   node scripts/route-table.js [outFile] [appDir]
 *
 * Diff two outputs to prove a refactor kept the API surface identical.
 */
const path = require('path'), fs = require('fs'), Module = require('module');
const outFile = process.argv[2]; const appDir = path.resolve(process.argv[3] || path.join(__dirname, '..'));
// Without an output file the table goes to stdout, and the app's own log lines go to stderr.
const writeTable = process.stdout.write.bind(process.stdout);
if (!outFile) process.stdout.write = process.stderr.write.bind(process.stderr);
Object.assign(process.env, {
  APP_NAME: 'x', NODE_ENV: 'production', CENTRAL_MYSQL_HOST: '127.0.0.1', CENTRAL_MYSQL_USER: 'x', CENTRAL_MYSQL_DB: 'x',
  CENTRAL_MYSQL_PORT: '1', JWT_SECRET: 'abcd', PROFESSIONAL_ROLE_ID: '7', ACCESSDOMAINS: 'http://localhost', STRIPE_SECRET_KEY: 'sk_test_x',
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

// Record, per router, its routes and mounted sub-routers in registration order.
const express = require(require.resolve('express', { paths: [appDir] }));
let routerProto = Object.getPrototypeOf(express.Router());
while (!Object.hasOwn(routerProto, 'use')) routerProto = Object.getPrototypeOf(routerProto); // Express 5: router -> instance -> Router.prototype
const entries = new WeakMap();
const log = (router) => entries.get(router) || entries.set(router, []).get(router);
const { use, route } = routerProto;
routerProto.route = function (p) {
  const r = route.apply(this, arguments);
  log(this).push({ path: p, route: r });
  return r;
};
routerProto.use = function (first) {
  const paths = typeof first === 'string' || Array.isArray(first) ? [].concat(first) : ['/'];
  const fns = [...arguments].slice(typeof first === 'function' ? 0 : 1).flat(Infinity);
  for (const fn of fns) if (fn && Array.isArray(fn.stack)) for (const p of paths) log(this).push({ path: p, router: fn });
  return use.apply(this, arguments);
};

const app = require(path.join(appDir, 'app.js'));
const join = (a, b) => (a + '/' + b).replace(/\/+/g, '/').replace(/(.)\/$/, '$1');
const routes = [];
const walk = (router, prefix) => (entries.get(router) || []).forEach((e) => {
  if (e.route) routes.push(Object.keys(e.route.methods).join(',').toUpperCase() + ' ' + join(prefix, e.path) + ' [' + e.route.stack.length + ' handlers]');
  else walk(e.router, join(prefix, e.path));
});
walk(app._router || app.router, '');
const loaded = Object.keys(require.cache).filter(f => f.startsWith(appDir) && !f.includes('node_modules')).map(f => path.relative(appDir, f)).sort();
const table = ['# ROUTES ' + routes.length, ...routes, '# LOADED ' + loaded.length, ...loaded, '# PARTIAL ' + partial.size, ...[...partial].sort()].join('\n');
if (outFile) {
  fs.writeFileSync(outFile, table);
  console.log('routes', routes.length, 'loaded', loaded.length, 'partial', partial.size);
} else writeTable(table + '\n');
setTimeout(() => process.exit(0), 300);
