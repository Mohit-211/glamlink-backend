// The mobile/commerce module's tables.
const Product = require('./product.model');
const ProductAttachment = require('./productAttachment.model');
const ProductCategory = require('./productCategory.model');
const ProductCategoryHeading = require('./productCategoryHeading.model');
const ProductCategoryMapping = require('./productCategoryMapping.model');
const ProductReview = require('./productReview.model');
const ProductType = require('./productType.model');
const ProductTypeMapping = require('./productTypeMapping.model');
const Cart = require('./cart.model');
const Wishlist = require('./wishlist.model');
const Order = require('./order.model');
const OrderDetails = require('./orderDetails.model');
const OrderParcelDetails = require('./orderParcelDetails.model');
const Brand = require('./brand.model');
const BrandAssociation = require('./brandAssociation.model');
const NumeralTaxCategory = require('./numeralTaxCategory.model');
const ProfessionalPayout = require('./professionalPayout.model');

// The associations this module owns: the side that holds the foreign key. Called once every module's
// models are loaded (src/models.js), with all of them by name.
const associate = ({ Payment, User, UserAddress, Vendor }) => {

  // e-commerce joins
  Product.belongsToMany(ProductCategory, {
    through: "ProductCategoryMapping",
    foreignKey: "product_id",
    as: "product_categories",
  });

  ProductCategory.belongsToMany(Product, {
    through: "ProductCategoryMapping",
    foreignKey: "product_category_id",
    as: "products",
  });

  ProductCategoryHeading.hasMany(ProductCategory, {
    foreignKey: "category_id",
    as: "product_categories_heading",
  });

  ProductCategory.belongsTo(ProductCategoryHeading, {
    foreignKey: "category_id",
    as: "products_heading",
  });

  Product.belongsToMany(ProductType, {
    through: "ProductTypeMapping",
    foreignKey: "product_id",
    as: "product_type",
  });

  ProductType.belongsToMany(Product, {
    through: "ProductTypeMapping",
    foreignKey: "product_type_id",
    as: "type_products",
  });

  Product.hasMany(ProductAttachment, {
    foreignKey: "product_id",
    as: "product_attachments",
  });

  ProductAttachment.belongsTo(Product, {
    foreignKey: "product_id",
    as: "attachment_product",
  });

  Vendor.hasMany(Product, {
    foreignKey: "vendor_id",
    as: "product_vendor",
  });

  Product.belongsTo(Vendor, {
    foreignKey: "vendor_id",
    as: "vendor_product",
  });

  Brand.hasMany(Product, {
    foreignKey: "brand_id",
    as: "product_brand",
  });

  Product.belongsTo(Brand, {
    foreignKey: "brand_id",
    as: "brand_product",
  });

  User.hasMany(Product, {
    foreignKey: "user_id",
    as: "product_user",
  });

  Product.belongsTo(User, {
    foreignKey: "user_id",
    as: "user_product",
  });

  User.hasMany(ProductReview, {
    foreignKey: "user_id",
    as: "product_review",
  });

  ProductReview.belongsTo(User, {
    foreignKey: "user_id",
    as: "review_product",
  });

  Product.hasMany(ProductReview, {
    foreignKey: "product_id",
    as: "product_reviews",
  });

  ProductReview.belongsTo(Product, {
    foreignKey: "product_id",
    as: "reviews_product",
  });

  Product.hasMany(Wishlist, {
    foreignKey: "product_id",
    as: "product_wishlist",
  });

  Wishlist.belongsTo(Product, {
    foreignKey: "product_id",
    as: "wishlist_product",
  });

  Product.hasMany(Cart, {
    foreignKey: "product_id",
    as: "product_cart",
  });

  Cart.belongsTo(Product, {
    foreignKey: "product_id",
    as: "cart_product",
  });

  Product.hasMany(OrderDetails, {
    foreignKey: "product_id",
    as: "product_orderDetails",
  });

  OrderDetails.belongsTo(Product, {
    foreignKey: "product_id",
    as: "product_details",
  });

  Order.hasMany(OrderDetails, {
    foreignKey: "order_id",
    as: "details_order",
  });

  OrderDetails.belongsTo(Order, {
    foreignKey: "order_id",
    as: "order_details_order",
  });

  OrderDetails.hasOne(OrderParcelDetails, {
    foreignKey: "order_id",
    as: "order_details_parcel",
  });

  OrderParcelDetails.belongsTo(OrderDetails, {
    foreignKey: "order_id",
    as: "parcel_details_order",
  });

  Order.hasMany(Payment, {
    foreignKey: "order_id",
    as: "order_payment",
  });

  Payment.belongsTo(Order, {
    foreignKey: "order_id",
    as: "payment_order",
  });

  Order.belongsTo(UserAddress, {
    foreignKey: "address_id",
    targetKey: "id",
    as: "order_address",
  });

  UserAddress.hasMany(Order, {
    foreignKey: "address_id",
    targetKey: "id",
    as: "address_order",
  });

  User.hasMany(Order, {
    foreignKey: "user_id",
    as: "user_order",
  });

  Order.belongsTo(User, {
    foreignKey: "user_id",
    as: "orders_user",
  });

  User.hasMany(BrandAssociation, {
    foreignKey: "user_id",
    as: "professional_brand_associations",
  });

  User.hasMany(BrandAssociation, {
    foreignKey: "brand_id",
    as: "brand_professional_associations",
  });

  BrandAssociation.belongsTo(User, {
    foreignKey: "user_id",
    as: "brand_association_professional",
  });

  BrandAssociation.belongsTo(User, {
    foreignKey: "brand_id",
    as: "brand_association_brand",
  });
};

module.exports = { models: { Product, ProductAttachment, ProductCategory, ProductCategoryHeading, ProductCategoryMapping, ProductReview, ProductType, ProductTypeMapping, Cart, Wishlist, Order, OrderDetails, OrderParcelDetails, Brand, BrandAssociation, NumeralTaxCategory, ProfessionalPayout }, associate };
