// CSV for admins to download and open in a spreadsheet: every value quoted, and a value starting with = + - @ (or
// a tab or carriage return) prefixed with ' so a spreadsheet shows it rather than running it as a formula.
const cell = (value) => {
    if (value === null || value === undefined) return '""';
    let text = value instanceof Date ? value.toISOString() : String(value);
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
};

// `columns`: [{ key, label }]; `rows`: plain objects.
const toCsv = (columns, rows) =>
    [columns.map((c) => cell(c.label)).join(','), ...rows.map((row) => columns.map((c) => cell(row[c.key])).join(','))].join('\r\n') + '\r\n';

module.exports = { toCsv };
