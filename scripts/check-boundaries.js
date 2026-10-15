#!/usr/bin/env node
/**
 * Module boundaries (part of `npm run lint`). The code is grouped by product: shared/, website/, mobile/, crm/,
 * on top of core/ and integrations/. This check fails when:
 *   - core imports anything above it, or an integration imports a module;
 *   - a product imports another product (website, mobile and crm only share through shared/);
 *   - shared imports a product;
 *   - a module reaches into another module's files instead of its index.js;
 *   - code uses models (via src/models.js) or defines associations with models of another product.
 * Known exceptions are listed in scripts/boundary-exceptions.js. A listed exception that no longer occurs also
 * fails the check, so the list only shrinks.
 *
 *   node scripts/check-boundaries.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const exceptions = require('./boundary-exceptions');

const root = path.join(__dirname, '..');
const files = execSync('git ls-files "src/*.js"', { cwd: root }).toString().trim().split(/\r?\n/)
    .filter((f) => fs.existsSync(path.join(root, f)));
const set = new Set(files);

const PRODUCTS = ['shared', 'website', 'mobile', 'crm'];
// The module a file belongs to: shared/<m>, website/<m>, mobile/<m>, crm; or a layer: core, integrations, root.
const moduleOf = (f) => {
    const p = f.replace(/^src\//, '').split('/');
    if (['shared', 'website', 'mobile'].includes(p[0]) && p.length > 2) return `${p[0]}/${p[1]}`;
    if (p[0] === 'crm') return 'crm';
    if (p[0] === 'core' || p[0] === 'integrations') return p[0];
    return 'root'; // routes.js, models.js, modules.js, jobs.js: they assemble the modules
};
const productOf = (m) => m.split('/')[0];
const isModule = (m) => PRODUCTS.includes(productOf(m));
const productMayUse = (from, to) => to === 'shared' || to === from;

const resolve = (from, spec) => {
    const base = path.posix.join(path.posix.dirname(from), spec);
    for (const c of [base, `${base}.js`, `${base}/index.js`]) if (set.has(c)) return c;
    return null;
};

// Which module owns each model: the requires in every <module>/models/index.js.
const ownerOf = {};
for (const f of files.filter((x) => x.endsWith('/models/index.js'))) {
    const src = fs.readFileSync(path.join(root, f), 'utf8');
    for (const m of src.matchAll(/const (\w+) = require\('\.\/[^']+'\)/g)) ownerOf[m[1]] = moduleOf(f);
}

const found = [];
for (const f of files) {
    const from = moduleOf(f);
    const src = fs.readFileSync(path.join(root, f), 'utf8');
    const isModelFile = /\/models\/[^/]+\.model\.js$/.test(f);

    for (const m of src.matchAll(/(?:const|let)\s+(\{[^}]*\}|\w+)\s*=\s*require\(\s*['"](\.[^'"]*)['"]\s*\)|require\(\s*['"](\.[^'"]*)['"]\s*\)/g)) {
        const spec = m[2] || m[3];
        const target = resolve(f, spec);
        if (!target) continue;
        const to = moduleOf(target);

        if (from === 'core' && to !== 'core') { found.push(`${f} imports ${target} (core imports nothing above it)`); continue; }
        if (from === 'integrations' && !['core', 'integrations'].includes(to)) { found.push(`${f} imports ${target} (integrations import only core)`); continue; }
        if (isModelFile && to !== 'core') { found.push(`${f} imports ${target} (model files import only core)`); continue; }
        if (!isModule(from)) continue;

        if (target === 'src/models.js' && m[1] && m[1].startsWith('{')) {
            const names = m[1].slice(1, -1).split(',').map((s) => s.trim().split(':')[0].trim()).filter(Boolean);
            const foreign = names.filter((n) => ownerOf[n] && !productMayUse(productOf(from), productOf(ownerOf[n])));
            if (foreign.length) found.push(`${f} uses models of another product: ${foreign.join(', ')}`);
            continue;
        }
        if (!isModule(to) || to === from) continue;
        if (!productMayUse(productOf(from), productOf(to))) { found.push(`${f} imports ${target} (${productOf(from)} may not use ${productOf(to)})`); continue; }
        if (!target.endsWith(`${to}/index.js`)) found.push(`${f} imports ${target} (use ${to}/index.js, not its files)`);
    }

    // associations: a module associates its tables with its own product's or shared tables
    if (f.endsWith('/models/index.js')) {
        const a = src.match(/const associate = \(\{([^}]*)\}\)/);
        const foreign = a ? a[1].split(',').map((s) => s.trim()).filter((n) => ownerOf[n] && !productMayUse(productOf(from), productOf(ownerOf[n]))) : [];
        if (foreign.length) found.push(`${f} associates with models of another product: ${foreign.join(', ')}`);
    }
}

const allowed = new Set(exceptions);
const unexpected = found.filter((v) => !allowed.has(v));
const gone = exceptions.filter((e) => !found.includes(e));
if (unexpected.length) console.error(`Boundary violations:\n${unexpected.map((v) => `  ${v}`).join('\n')}`);
if (gone.length) console.error(`Listed in scripts/boundary-exceptions.js but no longer found (remove them):\n${gone.map((v) => `  ${v}`).join('\n')}`);
if (unexpected.length || gone.length) process.exit(1);
console.log(`Module boundaries respected (${exceptions.length} known exceptions).`);
