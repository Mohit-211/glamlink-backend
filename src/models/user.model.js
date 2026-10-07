/** @format */

const { Sequelize, DataTypes, Model } = require("sequelize");
const sequelize = require("../config/central.db");
const { userStatusTypes } = require("../config/types");
const crypto = require("crypto");

class User extends Model {}
User.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    user_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    role_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
      references: {
        model: "roles",
        key: "id",
      },
    },
    professional_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    report_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    stripe_customer_id: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    stripe_account_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    square_customer_id: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    onboarding_status: {
      type: DataTypes.ENUM,
      values: ["pending", "completed", "incomplete"],
      defaultValue: "pending",
      allowNull: false,
    },
    socket_id: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    fcm_token: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    referral_code: {
      type: DataTypes.STRING,
      allowNull: true,
      // unique: true,
    },
    referred_by: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
    referral_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    referral_rewards: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.0,
    },
    status: {
      type: DataTypes.ENUM,
      values: [
        userStatusTypes.ACCEPTED,
        userStatusTypes.PENDING,
        userStatusTypes.REJECTED,
        userStatusTypes.REVIEWED,
        userStatusTypes.REVIEWING,
      ],
      defaultValue: userStatusTypes.PENDING,
    },

    // SSO
    provider: {
      type: DataTypes.ENUM,
      values: ["google", "facebook", "apple"],
      allowNull: true,
    },
    provider_id: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    remember_token: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    latitude: {
      type: Sequelize.FLOAT,
      allowNull: true,
    },
    longitude: {
      type: Sequelize.FLOAT,
      allowNull: true,
    },
    is_proof_verify: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    notification_status: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    allow_trial: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    is_subscribed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    form_status: {
      type: DataTypes.ENUM,
      values: ["pending", "approved", "rejected"],
      defaultValue: "pending",
      allowNull: true,
    },
    is_form_filled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    is_free_trial: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    trial_start_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    trial_end_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    is_premium: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    premium_start_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    premium_end_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    is_promoted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    is_founder: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    request_for_promotion: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    // business_card_link: {
    // 	type: DataTypes.STRING,
    // 	allowNull: true,
    // },
    // business_card_qr: {
    // 	type: DataTypes.STRING,
    // 	allowNull: true,
    // },
    subscription_status: {
      type: DataTypes.ENUM("PENDING", "ACTIVE", "INACTIVE", "CANCELLED"),
      allowNull: false,
      defaultValue: "INACTIVE",
    },

    stripe_subscription_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    subscription_plan: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    subscription_started_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    subscription_renewal_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    subscription_cancelled_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
    },
    updated_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      onUpdate: Sequelize.literal("CURRENT_TIMESTAMP"),
    },
    deleted_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "users",
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    deletedAt: "deleted_at",
    defaultScope: {
      where: {
        email: {
          [Sequelize.Op.ne]: "deleted-gmail.com",
        },
      },
    },
  },
);

function generateRandomString(length) {
  return crypto.randomBytes(length).toString("base64").slice(0, length);
}

User.afterCreate(async (user) => {
  const socketId = `${user.role_id}-${user.id}-socketId`;
  user.socket_id = socketId;

  let referralCode = `glam${user.user_name}`.toLowerCase();

  try {
    user.referral_code = referralCode;
    await user.save();
  } catch (err) {
    user.referral_code = `${referralCode}${user.id}`;
    await user.save();
  }
});

function generateRandomLowercaseString(length) {
  const possibleChars = "abcdefghijklmnopqrstuvwxyz";
  let result = "";
  while (result.length < length) {
    const randomChar = possibleChars.charAt(
      Math.floor(Math.random() * possibleChars.length),
    );
    result += randomChar;
  }
  return result;
}

function transformEmail() {
  const additionalChars = generateRandomLowercaseString(10);
  const additionalCharsAgain = generateRandomLowercaseString(5);
  return additionalChars + "_" + additionalCharsAgain;
}

User.isEmailTaken = async function (email, role_id) {
  let u = await this.findOne({
    where: { email: email, role_id: role_id, is_active: true },
  });
  return !!u;
};

User.isUserNameTaken = async function (user_name, role_id) {
  let u_n = await this.findOne({
    where: { user_name: user_name, role_id: role_id, is_active: true },
  });
  return !!u_n;
};

User.beforeUpdate(async (user) => {
  user.updated_at = new Date()
    .toISOString()
    .replace(/T/, " ")
    .replace(/\..+/g, "");
});

User.beforeDestroy(async (user) => {
  user.deleted_at = new Date()
    .toISOString()
    .replace(/T/, " ")
    .replace(/\..+/g, "");
  user.is_active = false;
});

// Scopes
User.addScope("excludeBlocked", (userId) => {
  return {
    where: {
      id: {
        [Sequelize.Op.notIn]: sequelize.literal(`(
                    SELECT blocked_to FROM user_block WHERE blocked_by = ${userId} AND is_active = 1
                )`),
      },
    },
  };
});

module.exports = User;
