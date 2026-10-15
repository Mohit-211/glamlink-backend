// The mobile/bookings module's tables.
const Service = require('./service.model');
const ServiceAttachment = require('./serviceAttachment.model');
const ServiceList = require('./serviceList.model');
const ServiceLocation = require('./serviceLocation.model');
const Booking = require('./booking.model');
const BookingSlot = require('./bookingSlot.model');
const Appointment = require('./appointment.model');
const Availability = require('./availability.model');
const Case = require('./case.model');
const CaseAttachment = require('./caseAttachment.model');
const Slot = require('./slot.model');
const Category = require('./category.model');

// The associations this module owns: the side that holds the foreign key. Called once every module's
// models are loaded (src/models.js), with all of them by name.
const associate = ({ City, Country, Customer, State, User }) => {

  // Cases
  User.hasMany(Case, { foreignKey: "user_id", as: "user_cases" });

  Case.belongsTo(User, { foreignKey: "user_id", as: "filled_by" });

  User.hasMany(Case, { foreignKey: "professional_id", as: "professional_cases" });

  Case.belongsTo(User, { foreignKey: "professional_id", as: "filled_to" });

  Case.hasMany(CaseAttachment, {
    foreignKey: "case_id",
    as: "case_attachments",
  });

  CaseAttachment.belongsTo(Case, {
    foreignKey: "case_id",
    as: "attachment_case",
  });

  Case.hasMany(Appointment, { foreignKey: "case_id", as: "case_appointments" });

  Appointment.belongsTo(Case, {
    foreignKey: "case_id",
    as: "appointment_case",
  });


  // Scheduling
  User.hasMany(Slot, { foreignKey: "professional_id", as: "professional_slots" });

  Slot.belongsTo(User, { foreignKey: "professional_id", as: "slot_professional" });



  // Booking
  User.hasMany(Booking, { foreignKey: "user_id", as: "user_appointments" });

  Booking.belongsTo(User, { foreignKey: "user_id", as: "appointment_user" });

  Customer.hasMany(Booking, {
    foreignKey: "user_id",
    as: "customer_appointments",
  });

  Booking.belongsTo(Customer, {
    foreignKey: "user_id",
    as: "appointment_customer",
  });

  User.hasMany(Booking, {
    foreignKey: "professional_id",
    as: "professional_appointments",
  });

  Booking.belongsTo(User, {
    foreignKey: "professional_id",
    as: "appointment_professional",
  });

  BookingSlot.hasMany(Booking, {
    foreignKey: "slot_id",
    as: "slot_appointments",
  });

  Booking.belongsTo(BookingSlot, {
    foreignKey: "slot_id",
    as: "appointment_slot",
  });


  //Service
  Category.hasMany(ServiceList, {
    foreignKey: "category_id",
    as: "category_service_lists",
  });

  ServiceList.belongsTo(Category, {
    foreignKey: "category_id",
    as: "service-list-category",
  });

  Category.hasMany(Service, { foreignKey: "category_id", as: "all_services" });

  Service.belongsTo(Category, { foreignKey: "category_id", as: "category" });

  User.hasMany(Service, { foreignKey: "user_id", as: "all_service" });

  Service.belongsTo(User, { foreignKey: "user_id", as: "created_by" });

  Service.hasMany(ServiceAttachment, {
    foreignKey: "service_id",
    as: "attachements",
  });

  ServiceAttachment.belongsTo(Service, {
    foreignKey: "service_id",
    as: "attachment_service",
  });

  Service.hasMany(Booking, {
    foreignKey: "service_id",
    as: "service_appointments",
  });

  Booking.belongsTo(Service, {
    foreignKey: "service_id",
    as: "appointment_service",
  });

  User.hasMany(Availability, {
    foreignKey: "professional_id",
    as: "availablity_Availability",
  });

  Availability.belongsTo(User, {
    foreignKey: "professional_id",
    as: "user_availablity",
  });

  ServiceLocation.belongsTo(Country, {
    foreignKey: "country_id",
    as: "service_country",
  });

  Country.hasMany(ServiceLocation, {
    foreignKey: "country_id",
    as: "country_service",
  });

  ServiceLocation.belongsTo(State, {
    foreignKey: "state_id",
    as: "service_state",
  });

  State.hasMany(ServiceLocation, {
    foreignKey: "state_id",
    as: "state_service",
  });

  ServiceLocation.belongsTo(City, {
    foreignKey: "city_id",
    as: "service_city",
  });

  City.hasMany(ServiceLocation, { foreignKey: "city_id", as: "city_service" });

  User.hasMany(Service, {
    foreignKey: "user_id",
    as: "user_service",
  });

  Service.belongsTo(User, {
    foreignKey: "user_id",
    as: "service_user",
  });
};

module.exports = { models: { Service, ServiceAttachment, ServiceList, ServiceLocation, Booking, BookingSlot, Appointment, Availability, Case, CaseAttachment, Slot, Category }, associate };
