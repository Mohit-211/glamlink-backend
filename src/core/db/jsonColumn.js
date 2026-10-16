const { DataTypes } = require('sequelize');

// A JSON value kept in a text column: read back parsed (null when empty or unreadable), written as JSON.
const jsonColumn = (field, { allowNull = true } = {}) => ({
    type: DataTypes.TEXT('long'),
    allowNull,
    get() {
        const raw = this.getDataValue(field);
        if (raw === null || raw === undefined) return null;
        if (typeof raw !== 'string') return raw;
        try {
            return JSON.parse(raw);
        } catch {
            return null;
        }
    },
    set(value) {
        this.setDataValue(field, value === null || value === undefined ? null : JSON.stringify(value));
    },
});

module.exports = { jsonColumn };
