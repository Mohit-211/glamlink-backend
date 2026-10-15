const cron = require('node-cron');
const modules = require('./modules');

// Scheduled jobs that modules declare (`jobs`), started once by app.js.
const start = () => {
    for (const m of modules) for (const job of m.jobs ? m.jobs() : []) cron.schedule(job.schedule, job.run);
};

module.exports = { start };
