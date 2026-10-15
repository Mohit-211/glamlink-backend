// The crm module's tables.
const Customer = require('./customer.model');
const Vendor = require('./vendor.model');
const CRMPayment = require('./crmPayment.model');

// The associations this module owns: the side that holds the foreign key. Called once every module's
// models are loaded (src/models.js), with all of them by name.
const associate = ({ User }) => {
  User.hasMany(Customer, {
    foreignKey: "user_id",
    as: "user_customer",
  });

  Customer.belongsTo(User, {
    foreignKey: "user_id",
    as: "customer_user",
  });
};

module.exports = { models: { Customer, Vendor, CRMPayment }, associate };
