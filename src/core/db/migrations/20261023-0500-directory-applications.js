// The directory application form (/directory-form-apply; Phase 6). Mohit, Oct 23: the form stays, as the way
// people without an account or an Access card get onto the directory, and its format may change later. So an
// application keeps the form's fields as sent, apart from cards and their rules, for admins to review: pending,
// approved or rejected. How approved applications show on /directory comes with the directory search.
module.exports = {
    up: async ({ sequelize }) => {
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS directory_applications (
                id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                professional_title VARCHAR(100) NULL,
                email VARCHAR(200) NOT NULL,
                phone VARCHAR(30) NULL,
                bio TEXT NULL,
                custom_handle VARCHAR(60) NULL,
                website VARCHAR(500) NULL,
                booking_link VARCHAR(500) NULL,
                preferred_booking_method VARCHAR(60) NULL,
                primary_specialty VARCHAR(100) NULL,
                specialties LONGTEXT NULL CHECK (specialties IS NULL OR json_valid(specialties)),
                social_media LONGTEXT NULL CHECK (social_media IS NULL OR json_valid(social_media)),
                locations LONGTEXT NULL CHECK (locations IS NULL OR json_valid(locations)),
                business_hours LONGTEXT NULL CHECK (business_hours IS NULL OR json_valid(business_hours)),
                profile_image VARCHAR(255) NULL,
                gallery LONGTEXT NULL CHECK (gallery IS NULL OR json_valid(gallery)),
                offer_promotion TINYINT(1) NOT NULL DEFAULT 0,
                promotion_details VARCHAR(500) NULL,
                elite_setup TINYINT(1) NOT NULL DEFAULT 0,
                excites_about_glamlink LONGTEXT NULL CHECK (excites_about_glamlink IS NULL OR json_valid(excites_about_glamlink)),
                biggest_pain_points LONGTEXT NULL CHECK (biggest_pain_points IS NULL OR json_valid(biggest_pain_points)),
                wants_access_card TINYINT(1) NOT NULL DEFAULT 0,
                place_id VARCHAR(255) NULL,
                status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
                review_note VARCHAR(500) NULL,
                reviewed_by INT NULL,
                reviewed_at DATETIME NULL,
                ip_address VARCHAR(45) NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                KEY directory_applications_status (status, created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
    },
    down: async ({ sequelize }) => {
        await sequelize.query('DROP TABLE IF EXISTS directory_applications');
    },
};
