// The Phase 3 identity model. One person = one account, typed by account_type instead of role_id:
// user | professional (individual or brand) | staff (CRM staff, role 9, until the CRM gets its own table).
// role_id stays, kept in step, until no code reads it. New tables: sign-in identities (Google, later),
// sessions with rotating refresh tokens, and single-use email tokens (verify email, reset password).
// Tokens are stored only as SHA-256 hashes.

const columnsOf = async (sequelize, table) => {
    const [rows] = await sequelize.query(
        'SELECT column_name AS c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ?',
        { replacements: [table] },
    );
    return new Set(rows.map((r) => r.c));
};

const USER_COLUMNS = [
    ['account_type', "ENUM('user','professional','staff') NULL AFTER role_id"],
    ['professional_type', "ENUM('individual','brand') NULL AFTER account_type"],
    ['email_verified_at', 'DATETIME NULL AFTER professional_type'],
    ['downgraded_at', 'DATETIME NULL AFTER email_verified_at'],
    ['merged_into_user_id', 'BIGINT UNSIGNED NULL AFTER downgraded_at'],
];

module.exports = {
    up: async ({ sequelize }) => {
        const existing = await columnsOf(sequelize, 'users');
        for (const [column, definition] of USER_COLUMNS) {
            if (!existing.has(column)) await sequelize.query(`ALTER TABLE users ADD COLUMN \`${column}\` ${definition}`);
        }

        // Types from the old roles: 6 user, 7 professional, 8 brand, 9 CRM staff.
        await sequelize.query(`
            UPDATE users SET
                account_type = CASE role_id WHEN 6 THEN 'user' WHEN 7 THEN 'professional' WHEN 8 THEN 'professional' WHEN 9 THEN 'staff' END,
                professional_type = CASE role_id WHEN 7 THEN 'individual' WHEN 8 THEN 'brand' END
            WHERE account_type IS NULL`);
        // Verified accounts: status ACCEPTED (the old OTP check). The exact time was not recorded.
        await sequelize.query(`
            UPDATE users SET email_verified_at = COALESCE(updated_at, created_at)
            WHERE status = 'ACCEPTED' AND email_verified_at IS NULL`);
        // Emails compare case-insensitively already; store them in one form.
        // BINARY: the column collation ignores case, so a plain comparison would match nothing.
        await sequelize.query('UPDATE users SET email = LOWER(TRIM(email)) WHERE BINARY email <> BINARY LOWER(TRIM(email))');

        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS user_identities (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT UNSIGNED NOT NULL,
                provider ENUM('google','apple') NOT NULL,
                provider_user_id VARCHAR(255) NOT NULL,
                email VARCHAR(255) NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_user_identities_provider (provider, provider_user_id),
                KEY idx_user_identities_user (user_id),
                CONSTRAINT fk_user_identities_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

        // One row per signed-in device. The refresh token rotates on every use; the previous hash is kept
        // so a reused (stolen) token can be recognised and the session revoked.
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS auth_sessions (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT UNSIGNED NOT NULL,
                refresh_token_hash CHAR(64) NOT NULL,
                previous_token_hash CHAR(64) NULL,
                rotated_at DATETIME NULL,
                client VARCHAR(20) NULL,
                user_agent VARCHAR(500) NULL,
                ip_address VARCHAR(45) NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                last_used_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME NOT NULL,
                revoked_at DATETIME NULL,
                revoke_reason VARCHAR(50) NULL,
                UNIQUE KEY uq_auth_sessions_refresh (refresh_token_hash),
                KEY idx_auth_sessions_previous (previous_token_hash),
                KEY idx_auth_sessions_user (user_id),
                CONSTRAINT fk_auth_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS email_tokens (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT UNSIGNED NOT NULL,
                purpose ENUM('verify_email','reset_password') NOT NULL,
                token_hash CHAR(64) NOT NULL,
                expires_at DATETIME NOT NULL,
                used_at DATETIME NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uq_email_tokens_hash (token_hash),
                KEY idx_email_tokens_user (user_id, purpose),
                CONSTRAINT fk_email_tokens_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    },

    down: async ({ sequelize }) => {
        await sequelize.query('DROP TABLE IF EXISTS email_tokens');
        await sequelize.query('DROP TABLE IF EXISTS auth_sessions');
        await sequelize.query('DROP TABLE IF EXISTS user_identities');
        const existing = await columnsOf(sequelize, 'users');
        for (const [column] of [...USER_COLUMNS].reverse()) {
            if (existing.has(column)) await sequelize.query(`ALTER TABLE users DROP COLUMN \`${column}\``);
        }
        // Lowercased emails stay lowercase: the original casing was not kept and is not needed.
    },
};
