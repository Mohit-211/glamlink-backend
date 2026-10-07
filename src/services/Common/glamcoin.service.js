const httpStatus = require("http-status");
const { UserGlamCoinEvent, GlamCoinRule, Profile } = require("../../models");
const ApiError = require("../../utils/ApiError");
const { Sequelize } = require('sequelize');


const earnCoin = async ({ user_id, action, target_id, is_added, is_substracted }) => {
    try {
        let coins_applied = 0;

        if (!user_id || !action) {
            return {
                status: false,
                message: 'Invalid coin transaction data'
            };
        }
        if (is_added && is_substracted) {
            return {
                status: false,
                message: 'Coin action cannot be both add and subtract'
            };
        }
        if (!is_added && !is_substracted) {
            return {
                status: false,
                message: 'Specify add or subtract for coin transaction'
            };
        }

        const glamCoinRuleDoc = await GlamCoinRule.findOne({ where: { action: action } })
        if (glamCoinRuleDoc) {
            coins_applied = glamCoinRuleDoc.coins
        }

        const userGlamCoinDoc = await UserGlamCoinEvent.create({
            user_id,
            action,
            coins_applied,
            target_id,
            is_added,
            is_substracted,
        });

        if (!userGlamCoinDoc) {
            return {
                status: false,
                message: 'Failed to add glam coin event'
            };
        }

        const incrementValue = is_added ? coins_applied : -coins_applied;
        await Profile.increment(
            { user_coin_balances: incrementValue },
            { where: { user_id } }
        );

        await Profile.update(
            { user_coin_balances: Sequelize.fn('GREATEST', Sequelize.col('user_coin_balances'), 0) },
            { where: { user_id } }
        );

        return userGlamCoinDoc;
    } catch (error) {
        throw new ApiError(
            error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
            error.message
        );
    }
};



module.exports = {
    earnCoin,
};
