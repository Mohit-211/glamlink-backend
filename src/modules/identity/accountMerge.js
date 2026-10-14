// One person = one account. Merges live accounts that share an email: the professional account is kept
// (individual, then brand, then user; CRM staff only merge with staff), and everything the other accounts
// own moves to it. Each group runs in one transaction. With `dryRun` every group is rolled back and the
// report says what would have happened.
//
// Plain SQL on purpose: this runs from a migration, which must keep working however the models change.

// Every column that points at a user, except the ones handled separately below.
const REFERENCES = [
    'access_orders.user_id', 'album_attachment_comments.user_id', 'album_attachment_likes.user_id',
    'album_attachments.user_id', 'album_comments.user_id', 'album_likes.user_id', 'albums.user_id',
    'appointments.professional_id', 'appointments.user_id', 'availability.professional_id', 'banner_media.user_id',
    'booking_slots.professional_id', 'bookings.professional_id', 'bookings.user_id', 'brand_associations.brand_id',
    'brand_associations.user_id', 'brands.user_id', 'business_cards.user_id', 'carts.user_id', 'cases.professional_id',
    'cases.user_id', 'crm_payments.professional_id', 'customers.professional_id', 'customers.user_id',
    'face_analysis.user_id', 'face_analysis_qna.user_id', 'feeds.user_id', 'fees_change_request.user_id',
    'follows.followee_id', 'follows.follower_id', 'intervals.professional_id',
    'journal_topic_professional_mappings.user_id', 'notifications.receiver_id', 'notifications.sender_id',
    'order_details.professional_id', 'order_details.user_id', 'orders.user_id', 'payments.user_id',
    'post_comments.user_id', 'post_favorites.user_id', 'post_likes.user_id', 'post_reports.user_id', 'posts.user_id',
    'product_review.user_id', 'product_types.user_id', 'products.user_id', 'professional_form_answers.user_id',
    'professional_payouts.professional_id', 'promotion_payments.professional_id', 'reel_comments.user_id',
    'reel_likes.user_id', 'reels.user_id', 'review_comments.user_id', 'review_likes.user_id', 'reviews.professional_id',
    'reviews.user_id', 'rules.professional_id', 'service_location.professional_id', 'services.user_id',
    'slots.professional_id', 'stories.user_id', 'user_address.user_id', 'user_attachments.user_id',
    'user_block.blocked_by', 'user_block.blocked_to', 'user_fees.user_id', 'user_glamcoin_events.user_id',
    'user_login_timings.user_id', 'user_promotions.user_id', 'user_report.reported_by', 'user_report.reported_to',
    'user_subscription.user_id', 'users.referred_by', 'vendors.user_id', 'walls.user_id', 'wishlists.user_id',
].map((ref) => ref.split('.'));

// Rows that also record the owner's role keep it in step with the account they move to.
const ROLE_TABLES = new Set(['album_attachments', 'banner_media', 'service_location', 'user_address', 'user_attachments']);

// After moving, the kept account may hold the same like/follow twice, or follow/block/report itself.
const DUPLICATES = [
    ['follows', ['follower_id', 'followee_id']], ['post_likes', ['user_id', 'post_id']],
    ['reel_likes', ['user_id', 'reel_id']], ['album_likes', ['user_id', 'album_id']],
    ['album_attachment_likes', ['user_id', 'album_attachment_id']], ['review_likes', ['user_id', 'review_id']],
    ['post_favorites', ['user_id', 'post_id']], ['wishlists', ['user_id', 'product_id']],
    ['journal_topic_professional_mappings', ['user_id', 'topic_id']],
];
const SELF = [['follows', 'follower_id', 'followee_id'], ['user_block', 'blocked_by', 'blocked_to'], ['user_report', 'reported_by', 'reported_to']];
// Like counters stored on the liked item.
const LIKE_COUNTERS = { post_likes: ['posts', 'post_id'], reel_likes: ['reels', 'reel_id'], album_likes: ['albums', 'album_id'] };

const RANK = { 'professional/individual': 0, 'professional/brand': 1, user: 2, staff: 3 };
const rank = (u) => RANK[u.account_type === 'professional' ? `professional/${u.professional_type}` : u.account_type] ?? 9;

// Live accounts sharing an email, the kept one first.
const findGroups = async (sequelize) => {
    const [rows] = await sequelize.query(`
        SELECT u.id, u.email, u.role_id, u.account_type, u.professional_type, u.status, u.provider, u.provider_id,
               u.email_verified_at, u.stripe_customer_id, u.referred_by, u.latitude, u.longitude, u.fcm_token,
               (SELECT MAX(t.created_at) FROM user_tokens t WHERE t.user_id = u.id) AS last_login,
               (SELECT COUNT(*) FROM profiles p WHERE p.user_id = u.id) AS has_profile
        FROM users u
        WHERE u.deleted_at IS NULL AND u.email IN (
            SELECT email FROM users WHERE deleted_at IS NULL AND email IS NOT NULL GROUP BY email HAVING COUNT(*) > 1)
        ORDER BY u.email, u.id`);
    const groups = new Map();
    for (const r of rows) groups.set(r.email, [...(groups.get(r.email) || []), r]);
    return [...groups.values()].map((accounts) => accounts.sort((a, b) =>
        rank(a) - rank(b) || b.has_profile - a.has_profile || (b.last_login || 0) - (a.last_login || 0) || a.id - b.id));
};

const columnsOf = async (sequelize, table, transaction) => {
    const [rows] = await sequelize.query(
        'SELECT column_name AS c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ?',
        { replacements: [table], transaction },
    );
    return new Set(rows.map((r) => r.c));
};

// Returns what changed, by table: { moved: { 'orders.user_id': 15 }, removed: { follows: 1 }, notes: [...] }.
const mergeGroup = async (sequelize, [kept, ...merged], transaction) => {
    const q = async (sql, replacements = []) => {
        const [result] = await sequelize.query(sql, { replacements, transaction });
        return result.affectedRows ?? 0;
    };
    const report = { moved: {}, removed: {}, notes: [] };
    const touchedUsers = new Set([kept.id]);
    const touchedItems = {};

    for (const loser of merged) {
        if (loser.account_type === 'staff' || kept.account_type === 'staff') {
            if (loser.account_type !== kept.account_type) {
                report.notes.push(`account ${loser.id} (${loser.account_type}) left alone: CRM staff only merge with staff`);
                continue;
            }
        }
        // Who this account followed or was followed by: their counters may change.
        const [related] = await sequelize.query(
            'SELECT follower_id AS a, followee_id AS b FROM follows WHERE follower_id = ? OR followee_id = ?',
            { replacements: [loser.id, loser.id], transaction },
        );
        for (const { a, b } of related) touchedUsers.add(a).add(b);

        // The kept account's profile photo stays its photo: the app shows the newest one, so a merged
        // account's photo moves only when the kept account has none.
        const [[{ keptPhotos }]] = await sequelize.query(
            "SELECT COUNT(*) AS keptPhotos FROM user_attachments WHERE user_id = ? AND title = 'Profile Image'",
            { replacements: [kept.id], transaction },
        );
        for (const [table, column] of REFERENCES) {
            // A later migration may have dropped the table (the counselling template's fee and scheduler tables).
            if (!(await columnsOf(sequelize, table, transaction)).has(column)) continue;
            const roleSet = ROLE_TABLES.has(table) ? ', role_id = ?' : '';
            const keepPhoto = table === 'user_attachments' && keptPhotos ? " AND title <> 'Profile Image'" : '';
            const n = await q(`UPDATE \`${table}\` SET \`${column}\` = ?${roleSet} WHERE \`${column}\` = ?${keepPhoto}`,
                roleSet ? [kept.id, kept.role_id, loser.id] : [kept.id, loser.id]);
            if (n) report.moved[`${table}.${column}`] = (report.moved[`${table}.${column}`] || 0) + n;
        }

        // Sign-ins: the old tokens and OTPs go; the profile stays with the kept account, plus the coins.
        report.removed.user_tokens = (report.removed.user_tokens || 0) + await q('DELETE FROM user_tokens WHERE user_id = ?', [loser.id]);
        report.removed.otps = (report.removed.otps || 0) + await q('DELETE FROM otps WHERE user_id = ?', [loser.id]);
        const [[coins]] = await sequelize.query(
            'SELECT COALESCE(SUM(user_coin_balances), 0) AS c FROM profiles WHERE user_id = ? AND deleted_at IS NULL',
            { replacements: [loser.id], transaction },
        );
        if (kept.has_profile) {
            if (Number(coins.c)) {
                await q('UPDATE profiles SET user_coin_balances = user_coin_balances + ? WHERE user_id = ? AND deleted_at IS NULL', [coins.c, kept.id]);
                report.notes.push(`${coins.c} coins from account ${loser.id} added to account ${kept.id}`);
            }
            await q('UPDATE profiles SET is_active = 0, deleted_at = NOW() WHERE user_id = ? AND deleted_at IS NULL', [loser.id]);
        } else {
            await q('UPDATE profiles SET user_id = ? WHERE user_id = ?', [kept.id, loser.id]);
            kept.has_profile = 1;
        }

        // Account fields the kept account lacks.
        if (!kept.email_verified_at && loser.email_verified_at) {
            await q('UPDATE users SET email_verified_at = ?, status = ? WHERE id = ?', [loser.email_verified_at, 'ACCEPTED', kept.id]);
            kept.email_verified_at = loser.email_verified_at;
        }
        for (const field of ['stripe_customer_id', 'referred_by', 'latitude', 'longitude', 'fcm_token']) {
            if (!kept[field] && loser[field]) {
                await q(`UPDATE users SET \`${field}\` = ? WHERE id = ?`, [loser[field], kept.id]);
                kept[field] = loser[field];
            } else if (field === 'stripe_customer_id' && loser[field] && loser[field] !== kept[field]) {
                report.notes.push(`account ${loser.id} had its own Stripe customer ${loser[field]} (its past orders keep it)`);
            }
        }

        await q('UPDATE users SET is_active = 0, deleted_at = NOW(), merged_into_user_id = ? WHERE id = ?', [kept.id, loser.id]);
    }

    // Clean up what the move made redundant.
    for (const [table, a, b] of SELF) {
        const n = await q(`DELETE FROM \`${table}\` WHERE \`${a}\` = ? AND \`${b}\` = ?`, [kept.id, kept.id]);
        if (n) report.removed[`${table} (self)`] = n;
    }
    // A person cannot review themselves: reviews one account wrote about the other are retired, and the
    // rating is recomputed from the reviews that remain (sum of levels, number rated, number with text).
    const selfReviews = await q(
        'UPDATE reviews SET is_active = 0, deleted_at = NOW() WHERE user_id = ? AND professional_id = ? AND deleted_at IS NULL',
        [kept.id, kept.id],
    );
    const [[{ selfBookings }]] = await sequelize.query(
        'SELECT COUNT(*) AS selfBookings FROM bookings WHERE user_id = ? AND professional_id = ?',
        { replacements: [kept.id, kept.id], transaction },
    );
    if (selfBookings) report.notes.push(`${selfBookings} booking(s) the accounts made with each other kept as history`);
    if (selfReviews) {
        report.removed['reviews (of own account)'] = selfReviews;
        await q(`UPDATE profiles p JOIN (
                SELECT COALESCE(SUM(level), 0) AS total, COUNT(*) AS rated, SUM(text IS NOT NULL AND text <> '') AS reviewed
                FROM reviews WHERE professional_id = ? AND is_active = 1 AND deleted_at IS NULL) r
            SET p.overall_ratings = r.total, p.no_of_user_rated = r.rated, p.no_of_user_reviewed = COALESCE(r.reviewed, 0)
            WHERE p.user_id = ? AND p.deleted_at IS NULL`, [kept.id, kept.id]);
        report.notes.push(`${selfReviews} review(s) the accounts wrote about each other retired; rating recomputed`);
    }
    for (const [table, [owner, target]] of DUPLICATES) {
        const hasDeleted = (await columnsOf(sequelize, table, transaction)).has('deleted_at');
        const live = hasDeleted ? 'AND x.deleted_at IS NULL AND y.deleted_at IS NULL' : '';
        // In follows both columns are people: someone who followed both accounts now follows the kept one twice.
        const sides = table === 'follows' ? [owner, target] : [owner];
        const [dups] = await sequelize.query(
            `SELECT DISTINCT y.id, y.\`${owner}\` AS owner, y.\`${target}\` AS target FROM \`${table}\` x JOIN \`${table}\` y
             ON y.\`${owner}\` = x.\`${owner}\` AND y.\`${target}\` = x.\`${target}\` AND y.id > x.id
             WHERE (${sides.map((c) => `x.\`${c}\` = :kept`).join(' OR ')}) ${live}`,
            { replacements: { kept: kept.id }, transaction },
        );
        if (!dups.length) continue;
        await q(`DELETE FROM \`${table}\` WHERE id IN (?)`, [dups.map((d) => d.id)]);
        report.removed[`${table} (duplicates)`] = dups.length;
        for (const d of dups) touchedItems[table] = new Set([...(touchedItems[table] || []), d.target]);
        if (table === 'follows') for (const d of dups) touchedUsers.add(d.owner).add(d.target);
    }

    // Counters: follows for everyone involved, likes for the items whose duplicate like went, referrals.
    for (const id of touchedUsers) {
        await q(`UPDATE profiles SET
            follower_count = (SELECT COUNT(*) FROM follows WHERE followee_id = ? AND is_active = 1 AND deleted_at IS NULL),
            followee_count = (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND is_active = 1 AND deleted_at IS NULL)
            WHERE user_id = ? AND deleted_at IS NULL`, [id, id, id]);
    }
    for (const [likeTable, ids] of Object.entries(touchedItems)) {
        const counter = LIKE_COUNTERS[likeTable];
        if (!counter) continue;
        const [itemTable, fk] = counter;
        const live = (await columnsOf(sequelize, likeTable, transaction)).has('deleted_at') ? 'AND deleted_at IS NULL' : '';
        for (const id of ids) {
            await q(`UPDATE \`${itemTable}\` SET likes_count = (SELECT COUNT(*) FROM \`${likeTable}\` WHERE \`${fk}\` = ? AND is_active = 1 ${live}) WHERE id = ?`, [id, id]);
        }
    }
    await q('UPDATE users SET referral_count = (SELECT COUNT(*) FROM (SELECT id FROM users WHERE referred_by = ?) r) WHERE id = ?', [kept.id, kept.id]);
    return report;
};

// Google/Apple sign-ins recorded on accounts become identities of the account that now owns them.
const linkIdentities = async (sequelize, transaction) => {
    const [result] = await sequelize.query(`
        INSERT IGNORE INTO user_identities (user_id, provider, provider_user_id, email)
        SELECT COALESCE(u.merged_into_user_id, u.id), u.provider, u.provider_id, u.email
        FROM users u
        WHERE u.provider IN ('google', 'apple') AND u.provider_id IS NOT NULL AND u.provider_id <> ''
          AND (u.deleted_at IS NULL OR u.merged_into_user_id IS NOT NULL)
        ORDER BY u.merged_into_user_id IS NULL DESC, u.id`, { transaction });
    return result.affectedRows ?? 0;
};

// For real, each group commits on its own (a failure stops the run with earlier groups done; running again
// continues with what is left). A dry run does everything in one transaction and rolls it all back.
const mergeDuplicateAccounts = async (sequelize, { dryRun = false } = {}) => {
    const groups = await findGroups(sequelize);
    const results = [];
    const dryRunTransaction = dryRun ? await sequelize.transaction() : null;
    const step = async (label, work) => {
        const transaction = dryRunTransaction || (await sequelize.transaction());
        try {
            const result = await work(transaction);
            if (!dryRun) await transaction.commit();
            return result;
        } catch (error) {
            await transaction.rollback();
            throw new Error(`${label} failed: ${error.message}`);
        }
    };
    for (const accounts of groups) {
        const report = await step(`Merging ${accounts[0].email}`, (t) => mergeGroup(sequelize, accounts.map((a) => ({ ...a })), t));
        results.push({ accounts, report });
    }
    const identities = await step('Linking sign-in identities', (t) => linkIdentities(sequelize, t));
    if (dryRunTransaction) await dryRunTransaction.rollback();
    return { groups: results, identities };
};

module.exports = { mergeDuplicateAccounts, findGroups };
