#!/usr/bin/env node
/**
 * Model-table snapshot for refactors: loads every Sequelize model (no database needed) and writes each
 * model's name, table, options, attributes, hooks and associations. Model names decide the JSON keys of
 * includes without an alias, so renaming files or classes must leave this table unchanged.
 *
 *   node scripts/model-table.js [outFile]
 *
 * Diff two outputs to prove a refactor kept the data layer identical.
 */
const path = require('path'), fs = require('fs');
const outFile = process.argv[2];
const root = path.join(__dirname, '..');
Object.assign(process.env, {
  APP_NAME: 'x', NODE_ENV: 'production', CENTRAL_MYSQL_HOST: '127.0.0.1', CENTRAL_MYSQL_USER: 'x', CENTRAL_MYSQL_DB: 'x',
  CENTRAL_MYSQL_PORT: '1', JWT_SECRET: 'abcd', PROFESSIONAL_ROLE_ID: '7',
});
// The connection check fails without a database; that is expected here.
process.on('unhandledRejection', () => {});

// Wherever the models are loaded from, they all register on the one connection.
const entry = ['src/core/db/models.js', 'src/models/index.js'].map((p) => path.join(root, p)).find((p) => fs.existsSync(p));
require(entry);
const sequelize = require(path.join(root, 'src/core/db/central.db'));

const lines = [];
for (const name of Object.keys(sequelize.models).sort()) {
  const m = sequelize.models[name];
  const o = m.options;
  lines.push(`MODEL ${name} table=${m.getTableName()} paranoid=${!!o.paranoid} timestamps=${!!o.timestamps} underscored=${!!o.underscored} createdAt=${o.createdAt} updatedAt=${o.updatedAt} deletedAt=${o.deletedAt}`);
  for (const [attr, def] of Object.entries(m.rawAttributes)) {
    lines.push(`  ATTR ${attr} ${def.type ? def.type.toString({ escape: (v) => JSON.stringify(v) }) : '?'} field=${def.field}${def.primaryKey ? ' pk' : ''}${def.allowNull === false ? ' notnull' : ''}${def.references ? ` ref=${typeof def.references.model === 'string' ? def.references.model : def.references.model?.tableName || '?'}.${def.references.key}` : ''}`);
  }
  for (const [hook, fns] of Object.entries(o.hooks || {})) lines.push(`  HOOK ${hook} x${[].concat(fns).length}`);
  if (o.defaultScope && Object.keys(o.defaultScope).length) lines.push(`  DEFAULTSCOPE ${JSON.stringify(o.defaultScope)}`);
  for (const scope of Object.keys(o.scopes || {}).sort()) lines.push(`  SCOPE ${scope}`);
  for (const [as, a] of Object.entries(m.associations).sort((x, y) => x[0].localeCompare(y[0]))) {
    lines.push(`  ASSOC ${a.associationType} as=${as} -> ${a.target.name} fk=${a.foreignKey}${a.otherKey ? ` otherKey=${a.otherKey}` : ''}${a.through ? ` through=${a.through.model.name}` : ''}${a.sourceKey ? ` sourceKey=${a.sourceKey}` : ''}${a.targetKey ? ` targetKey=${a.targetKey}` : ''}${a.scope ? ` scope=${JSON.stringify(a.scope)}` : ''}`);
  }
}
const table = [`# MODELS ${Object.keys(sequelize.models).length}`, ...lines].join('\n') + '\n';
if (outFile) {
  fs.writeFileSync(outFile, table);
  console.log('models', Object.keys(sequelize.models).length, 'lines', lines.length);
} else process.stdout.write(table);
setTimeout(() => process.exit(0), 300);
