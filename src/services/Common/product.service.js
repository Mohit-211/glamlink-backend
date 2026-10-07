/** @format */

const httpStatus = require("http-status");
const { Sequelize, Op } = require("sequelize");
const moment = require("moment-timezone");
const path = require("path");
const fs = require("fs");
const {
	Product,
	ProductCategoryMapping,
	ProductAttachment,
	ProductCategory,
	User,
	UserAttachment,
	Profile,
	UserAddress,
	ServiceLocation,
	Country,
	State,
	City,
	ProductTypeMapping,
	ProductType,
	Vendor,
	Brand,
} = require("../../models");
const ApiError = require("../../utils/ApiError");
const config = require("../../config/config");
const sequelize = require("../../config/central.db");
const {
	sendNewProductAlertToAdmin,
	sendProductApprovalEmail,
	sendProductStatusNotificationToAdmin,
	sendProductDeletionEmailToBeautician,
	sendProductDeletionEmailToAdmin,
} = require("./email.service");

const createProduct = async (body, files) => {
	try {
		const {
			user,
			name,
			description,
			price,
			stock,
			product_category_ids,
			product_type_ids,
			vendor_id,
			brand_id,
			// barcode_id,
		} = body;

		if (user.role_id === Number(config.USR_ROLE_ID))
			throw new ApiError(
				httpStatus.BAD_REQUEST,
				"User can not access this api."
			);

		let unique_product_id;
		let isUnique = false;

		while (!isUnique) {
			unique_product_id = Math.floor(
				100000 + Math.random() * 900000
			).toString(); // Generates a 6-digit random number
			const existingProduct = await Product.findOne({
				where: { unique_product_id },
			});
			if (!existingProduct) isUnique = true;
		}

		//  Check if barcode_id is already used

		let productObj = {
			user_id: user.id,
			name: name,
			description: description,
			price: price,
			stock: stock,
			vendor_id: vendor_id,
			brand_id: brand_id,
			// barcode_id: barcode_id,
			unique_product_id: unique_product_id,
		};

		let productDoc = await Product.create(productObj);
		if (!productDoc)
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to create New Product"
			);

		if (
			product_category_ids &&
			Array.isArray(product_category_ids) &&
			product_category_ids.length > 0
		) {
			for (const categoryId of product_category_ids) {
				const productCategoryMapping = {
					product_id: productDoc.id,
					product_category_id: categoryId,
				};
				await ProductCategoryMapping.create(productCategoryMapping);
			}
		}

		if (
			product_type_ids &&
			Array.isArray(product_type_ids) &&
			product_type_ids.length > 0
		) {
			for (const typeId of product_type_ids) {
				const productTypeMapping = {
					product_id: productDoc.id,
					product_type_id: typeId,
				};
				await ProductTypeMapping.create(productTypeMapping);
			}
		}

		if (
			files &&
			Object.keys(files).length !== 0 &&
			files.images &&
			files.images.length !== 0
		) {
			for (let i = 0; i < files.images.length; i++) {
				let currImage = files.images[i];
				const productAttachmentObj = {
					product_id: productDoc.id,
					file_type: "Image",
					file_name: currImage.filename,
					file_uri: "/images",
					file_size: currImage.size,
				};
				await ProductAttachment.create(productAttachmentObj);
			}
		}

		productDoc = await Product.findOne({
			where: { id: productDoc.id, is_active: true },
			attributes: [
				"id",
				"name",
				"description",
				"created_at",
				[
					Sequelize.literal(
						"DATE_FORMAT(Product.created_at, '%Y-%m-%d %H:%i %p')"
					),
					"formatted_created_at",
				],
				"updated_at",
			],
			include: [
				{
					model: ProductAttachment,
					as: "product_attachments",
					attributes: ["id", "file_type", "file_name", "file_uri"],
				},
				{
					model: ProductCategory,
					as: "product_categories",
					attributes: ["id", "title", "slug"],
					through: { attributes: [] },
				},
				{
					model: ProductType,
					as: "product_type",
					attributes: ["id", "name"],
					through: { attributes: [] },
				},
			],
		});

		if (!productDoc)
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to Get All Product"
			);

		// ✅ Notify admin after product creation
		await sendNewProductAlertToAdmin(user, productDoc);

		return productDoc;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getPendingProductCount = async () => {
	try {
		const count = await Product.count({
			where: {
				status: "pending",
			},
		});

		return count;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getAllProducts = async (body) => {
	try {
		const { user } = body;

		if (
			user.is_form_filled &&
			(user.form_status === "pending" || user.form_status === null)
		) {
			throw new ApiError(
				httpStatus.FORBIDDEN,
				"Your form is under review. Please wait for admin approval."
			);
		}

		if (user.is_form_filled && user.form_status === "rejected") {
			throw new ApiError(httpStatus.FORBIDDEN, "Your form is rejected.");
		}

		// // Check if user has access through any means
		const hasFreeTrialData = user.trial_start_date && user.trial_end_date;
		const hasPremiumData = user.premium_start_date && user.premium_end_date;

		if (
			!user.is_free_trial &&
			!user.is_premium &&
			!hasFreeTrialData &&
			!hasPremiumData
		) {
			throw new ApiError(
				httpStatus.FORBIDDEN,
				"You need to start a free trial or purchase a premium plan to access this feature."
			);
		}

		

		const productDoc = await Product.findAll({
			where: { is_active: true, user_id: user.id },
			include: [
				{
					model: ProductAttachment,
					as: "product_attachments",
					attributes: ["id", "file_type", "file_name", "file_uri"],
				},
				{
					model: Vendor,
					as: "vendor_product",
					attributes: ["id", "name", "contact", "email", "address", "gst"],
				},
				{
					model: Brand,
					as: "brand_product",
					attributes: ["id", "name"],
				},
				{
					model: ProductCategory,
					as: "product_categories",
					attributes: ["id", "title", "slug"],
					through: { attributes: [] },
				},
				{
					model: ProductType,
					as: "product_type",
					attributes: ["id", "name"],
					through: { attributes: [] },
				},
			],

			order: [["created_at", `DESC`]],
		});

		console.log(productDoc, "productDoc");

		if (!productDoc)
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to Get All Products"
			);

		return productDoc;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getAllProductsByBeuticianId = async (id) => {
	try {
		
		const productDoc = await Product.findAll({
			where: { is_active: true, user_id: id },
			include: [
				{
					model: ProductAttachment,
					as: "product_attachments",
					attributes: ["id", "file_type", "file_name", "file_uri"],
				},
				{
					model: Vendor,
					as: "vendor_product",
					attributes: ["id", "name", "contact", "email", "address", "gst"],
				},
				{
					model: Brand,
					as: "brand_product",
					attributes: ["id", "name"],
				},
				{
					model: ProductCategory,
					as: "product_categories",
					attributes: ["id", "title", "slug"],
					through: { attributes: [] },
				},
				{
					model: ProductType,
					as: "product_type",
					attributes: ["id", "name"],
					through: { attributes: [] },
				},
			],

			order: [["created_at", `DESC`]],
		});

		console.log(productDoc, "productDoc");

		if (!productDoc)
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to Get All Products"
			);

		return productDoc;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const findProductById = async (body, params) => {
	try {
		const { user } = body;
		const { id } = params;

		if (!id) {
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Invalid Product id"
			);
		}

		const productDoc = await Product.findOne({
			attributes: [
				"id",
				"name",
				"description",
				"price",
				"stock",
				"brand_id",
				"vendor_id",
				"review_count",
				"rating",
				"average_rating",
				[
					Sequelize.literal(
						`(SELECT COALESCE(SUM(carts.total_items), 0) FROM carts WHERE carts.product_id = Product.id AND carts.user_id = ${user.id} AND carts.is_active = 1)`
					),
					"quantity_in_cart",
				],
				[
					Sequelize.literal(
						`(SELECT CASE WHEN EXISTS (SELECT 1 FROM product_review WHERE product_review.product_id = Product.id AND product_review.user_id = ${user.id}) THEN TRUE ELSE FALSE END)`
					),
					"is_review_provided",
				],
				[
					Sequelize.literal(
						"DATE_FORMAT(Product.created_at, '%Y-%m-%d %H:%i %p')"
					),
					"formatted_created_at",
				],
				[
					Sequelize.literal(
						`(SELECT CASE WHEN EXISTS (SELECT * FROM carts WHERE carts.product_id = Product.id AND carts.user_id = ${user.id} AND carts.is_active = 1) THEN TRUE ELSE FALSE END)`
					),
					"is_cart",
				],
				"updated_at",
			],
			where: { id: id, is_active: true },
			include: [
				{
					model: ProductAttachment,
					as: "product_attachments",
					attributes: ["id", "file_type", "file_name", "file_uri"],
				},
				{
					model: Vendor,
					as: "vendor_product",
					attributes: ["id", "name", "contact", "email", "address", "gst"],
				},
				{
					model: Brand,
					as: "brand_product",
					attributes: ["id", "name"],
				},
				{
					model: ProductCategory,
					as: "product_categories",
					attributes: ["id", "title", "slug"],
					through: { attributes: [] },
				},
				{
					model: ProductType,
					as: "product_type",
					attributes: ["id", "name"],
					through: { attributes: [] },
				},
				{
					model: User,
					as: "user_product",
					attributes: ["id", "email", "user_name"],
					include: [
						{
							model: UserAttachment,
							as: "user_attachments",
							attributes: [
								"id",
								"title",
								"file_type",
								"file_name",
								"file_uri",
								"role_id",
							],
							order: [["id", "desc"]],
							limit: 1,
							where: { title: "Profile Image" },
						},
						{
							model: Profile,
							as: "user_profile",
							attributes: [
								"id",
								"name",
								"dialing_code",
								"qualification",
								"language",
								"mobile",
								"is_active",
								"created_at",
								"about",
								"overall_ratings",
								"no_of_user_rated",
								"no_of_user_reviewed",
								"city_id",
								"state_id",
								"followee_count",
								"follower_count",
								"no_of_post_posted",
								"no_of_service_provided",
							],
						},
					],
				},
			],
		});

		if (!productDoc) {
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to Get Product"
			);
		}

		// Get the category IDs associated with the current product
		const categoryIds = productDoc.product_categories.map(
			(category) => category.id
		);

		// Fetch related products that belong to the same categories but exclude the current product
		const relatedProducts = await Product.findAll({
			where: {
				is_active: true,
				id: { [Op.ne]: id }, // Exclude the current product
			},
			attributes: [
				"id",
				"name",
				"description",
				[
					Sequelize.literal(
						"DATE_FORMAT(Product.created_at, '%Y-%m-%d %H:%i %p')"
					),
					"formatted_created_at",
				],
				"updated_at",
			],
			include: [
				{
					model: ProductAttachment,
					as: "product_attachments",
					attributes: ["id", "file_type", "file_name", "file_uri"],
				},
				{
					model: ProductCategory,
					as: "product_categories",
					attributes: ["id", "title", "slug"],
					through: { attributes: [] },
				},
			],
			limit: 4,
		});

		// Add related products to the current product document
		productDoc.dataValues.related_products = relatedProducts;

		return productDoc;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const updateProduct = async (body, files, id) => {
	try {
		const {
			name,
			description,
			product_category_ids,
			product_type_ids,
			price,
			stock,
			brand_id,
			vendor_id,
			address_id,
			removeImageIds,
		} = body;

		// Find the product by its primary key
		let productDoc = await Product.findByPk(id);
		if (!productDoc)
			throw new ApiError(httpStatus.BAD_REQUEST, "Invalid Product Id");

		// Update the fields if they have changed
		if (name && name !== productDoc.name) productDoc.name = name;
		if (description && description !== productDoc.description)
			productDoc.description = description;
		if (price && price !== productDoc.price) productDoc.price = price;
		if (stock && stock !== productDoc.stock) productDoc.stock = stock;
		if (brand_id && brand_id !== productDoc.brand_id)
			productDoc.brand_id = brand_id;
		if (vendor_id && vendor_id !== productDoc.vendor_id)
			productDoc.vendor_id = vendor_id;
		if (address_id && address_id !== productDoc.address_id)
			productDoc.address_id = address_id;

		// Save the updated product
		await productDoc.save();

		// Update product categories
		if (product_category_ids) {
			const currentCategories = await productDoc.getProduct_categories();
			const currentCategoryIds = currentCategories.map((cat) => cat.id);
			const newCategoryIds = Array.isArray(product_category_ids)
				? product_category_ids.map((id) => parseInt(id, 10))
				: [];

			const categoriesToAdd = newCategoryIds.filter(
				(newId) => !currentCategoryIds.includes(newId)
			);
			const categoriesToRemove = currentCategoryIds.filter(
				(currentId) => !newCategoryIds.includes(currentId)
			);

			if (categoriesToAdd.length > 0) {
				await productDoc.addProduct_categories(categoriesToAdd);
			}
			if (categoriesToRemove.length > 0) {
				await productDoc.removeProduct_categories(categoriesToRemove);
			}
		}

		// Update product types (similar to categories)
		if (product_type_ids) {
			const currentTypes = await productDoc.getProduct_type();
			const currentTypeIds = currentTypes.map((type) => type.id);
			const newTypeIds = Array.isArray(product_type_ids)
				? product_type_ids.map((id) => parseInt(id, 10))
				: [];

			const typesToAdd = newTypeIds.filter(
				(newId) => !currentTypeIds.includes(newId)
			);
			const typesToRemove = currentTypeIds.filter(
				(currentId) => !newTypeIds.includes(currentId)
			);

			if (typesToAdd.length > 0) {
				await productDoc.addProduct_type(typesToAdd);
			}
			if (typesToRemove.length > 0) {
				await productDoc.removeProduct_type(typesToRemove);
			}
		}

		// Handle image removal based on removeImageIds
		if (removeImageIds && removeImageIds.length !== 0) {
			const removeImagesArr = removeImageIds.split(",").map(Number);
			const imagesToRemove = await ProductAttachment.findAll({
				where: {
					id: { [Op.in]: removeImagesArr },
					product_id: productDoc.id,
					is_active: true,
				},
			});

			for (const image of imagesToRemove) {
				const filePath = path.join(
					__dirname,
					"../../../public/uploads/images",
					image.file_name
				);
				await image.destroy({ force: true });
				if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
			}
		}

		// Handle adding new attachments if provided
		if (
			files &&
			Object.keys(files).length !== 0 &&
			files.images &&
			files.images.length !== 0
		) {
			for (let i = 0; i < files.images.length; i++) {
				const currImage = files.images[i];
				const productAttachmentObj = {
					product_id: productDoc.id,
					file_type: "Image",
					file_name: currImage.filename,
					file_uri: "/images",
					file_size: currImage.size,
				};
				await ProductAttachment.create(productAttachmentObj);
			}
		}

		return productDoc;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const deleteProduct = async (body) => {
	try {
		if (!Array.isArray(body.product_id) || body.product_id.length === 0) {
			throw new ApiError(httpStatus.BAD_REQUEST, "Invalid Product Id");
		}

		// Ensure all IDs are trimmed and filtered
		const productIds = body.product_id
			.map((id) => String(id).trim())
			.filter(Boolean);

		if (productIds.length === 0) {
			throw new ApiError(
				httpStatus.BAD_REQUEST,
				"No valid product IDs provided"
			);
		}

		// Find all products with the given IDs
		const products = await Product.findAll({
			where: { id: productIds },
		});

		if (products.length === 0) {
			throw new ApiError(httpStatus.NOT_FOUND, "No products found");
		}

		// Find and delete associated product attachments
		const productAttachments = await ProductAttachment.findAll({
			where: { product_id: productIds },
		});

		if (productAttachments.length > 0) {
			await Promise.all(
				productAttachments.map((attachment) => attachment.destroy())
			);
		}

		// Delete the associated categories and types
		await ProductCategoryMapping.destroy({ where: { product_id: productIds } });
		await ProductTypeMapping.destroy({ where: { product_id: productIds } });

		// Collect deletion data for email
		const beauticianProductMap = {};
		const deletedProductInfo = [];

		for (const product of products) {
			const beautician = await User.findByPk(product.user_id, {
				include: ["user_profile"],
			});

			if (!beautician) continue;

			const beauticianEmail = beautician.email;
			const beauticianName = beautician.user_profile?.name || "Beautician";

			// Admin summary
			deletedProductInfo.push({
				productName: product.name,
				beauticianId: beautician.id,
				beauticianName,
			});

			// Group per beautician
			if (!beauticianProductMap[beauticianEmail]) {
				beauticianProductMap[beauticianEmail] = {
					name: beauticianName,
					products: [],
				};
			}
			beauticianProductMap[beauticianEmail].products.push(product.name);
		}

		// Delete the products
		await Promise.all(products.map((product) => product.destroy()));

		// Send emails to beauticians
		for (const [email, data] of Object.entries(beauticianProductMap)) {
			await sendProductDeletionEmailToBeautician(
				email,
				data.name,
				data.products
			);
		}

		// Send email to admin
		await sendProductDeletionEmailToAdmin(deletedProductInfo);
	} catch (error) {
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getAllProductsForUser = async (body, headers) => {
	try {
		const { user, min_rating, price_range, product_category_ids } = body;
		const { role_id } = headers;

		if (role_id === "6") {
			const userAddressExists = await UserAddress.findOne({
				where: {
					role_id: "6",
					user_id: user.id,
					is_active: true,
				},
			});

			if (!userAddressExists) {
				return {
					status: 200,
					message: "Please enter your location to view products.",
				};
			}
		}

		const productWhereClause = {
			is_active: true,
			status: "approved",
		};

		if (min_rating) {
			productWhereClause.average_rating = { [Sequelize.Op.gte]: min_rating };
		}

		let priceRange = body.price_range;

		if (priceRange) {
			switch (priceRange) {
				case "under_25":
					productWhereClause.price = { [Sequelize.Op.lte]: 25 };
					break;
				case "25_50":
					productWhereClause.price = {
						[Sequelize.Op.gte]: 25,
						[Sequelize.Op.lte]: 50,
					};
					break;
				case "50_100":
					productWhereClause.price = {
						[Sequelize.Op.gte]: 50,
						[Sequelize.Op.lte]: 100,
					};
					break;
				case "over_100":
					productWhereClause.price = { [Sequelize.Op.gte]: 100 };
					break;
			}
		}

		const products = await Product.findAll({
			attributes: ["id", "name", "price", "average_rating", "user_id"],
			where: productWhereClause,
			include:
				product_category_ids && product_category_ids.length > 0
					? [
							{
								model: ProductCategory,
								as: "product_categories",
								attributes: [],
								through: { attributes: [] },
								where: {
									id: { [Sequelize.Op.in]: product_category_ids },
								},
							},
					  ]
					: [],
		});

		const enhancedProducts = await Promise.all(
			products.map(async (product) => {
				const attachment = await ProductAttachment.findOne({
					where: { product_id: product.id },
					attributes: [
						"id",
						"file_type",
						"file_name",
						"file_uri",
						"product_id",
					],
					order: [["id", "ASC"]],
				});

				const [inCart] = await sequelize.query(
					`SELECT EXISTS (
            SELECT 1 FROM carts 
            WHERE product_id = ? 
            AND user_id = ? 
            AND is_active = 1
          ) AS is_cart`,
					{
						replacements: [product.id, user.id],
						type: Sequelize.QueryTypes.SELECT,
					}
				);

				return {
					id: product.id,
					name: product.name,
					price: product.price,
					average_rating: product.average_rating,
					user_id: product.user_id,
					product_attachments: attachment
						? {
								id: attachment.id,
								file_type: attachment.file_type,
								file_name: attachment.file_name,
								file_uri: attachment.file_uri,
								product_id: attachment.product_id,
						  }
						: null,
					is_available_in_your_area: 1,
					is_cart: inCart.is_cart === 1 ? 1 : 0,
				};
			})
		);

		return enhancedProducts;
	} catch (error) {
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getAllProductsForAdmin = async () => {
	try {
		const productDoc = await Product.findAll({
			where: { is_active: true },
			include: [
				{
					model: ProductAttachment,
					as: "product_attachments",
					attributes: ["id", "file_type", "file_name", "file_uri"],
				},
				{
					model: ProductCategory,
					as: "product_categories",
					attributes: ["id", "title", "slug"],
					through: { attributes: [] },
				},
				{
					model: ProductType,
					as: "product_type",
					attributes: ["id", "name"],
					through: { attributes: [] },
				},
				{
					model: User,
					as: "user_product",
					attributes: ["id", "email"],
					include: [
						{
							model: Profile,
							as: "user_profile",
							attributes: [
								"id",
								"name",
								"dialing_code",
								"qualification",
								"language",
								"mobile",
								"is_active",
								"created_at",
								"about",
								"overall_ratings",
								"no_of_user_rated",
								"no_of_user_reviewed",
								"city_id",
								"state_id",
								"followee_count",
								"follower_count",
								"no_of_post_posted",
								"no_of_service_provided",
								"profession",
							],
						},
					],
				},
			],

			order: [["created_at", `DESC`]],
		});

		if (!productDoc)
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to Get All Products"
			);

		return productDoc;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getProductById = async (params) => {
	try {
		const { id } = params;

		if (!id) {
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Invalid Product id"
			);
		}

		const productDoc = await Product.findOne({
			attributes: [
				"id",
				"name",
				"description",
				"price",
				"stock",
				"brand_id",
				"vendor_id",
				"review_count",
				"rating",
				"average_rating",
				"updated_at",
			],
			where: { id: id, is_active: true },
			include: [
				{
					model: ProductAttachment,
					as: "product_attachments",
					attributes: ["id", "file_type", "file_name", "file_uri"],
				},
				{
					model: Vendor,
					as: "vendor_product",
					attributes: ["id", "name", "contact", "email", "address", "gst"],
				},
				{
					model: Brand,
					as: "brand_product",
					attributes: ["id", "name"],
				},
				{
					model: ProductCategory,
					as: "product_categories",
					attributes: ["id", "title", "slug"],
					through: { attributes: [] },
				},
				{
					model: ProductType,
					as: "product_type",
					attributes: ["id", "name"],
					through: { attributes: [] },
				},
				{
					model: User,
					as: "user_product",
					attributes: ["id", "email", "user_name"],
					include: [
						{
							model: UserAttachment,
							as: "user_attachments",
							attributes: [
								"id",
								"title",
								"file_type",
								"file_name",
								"file_uri",
								"role_id",
							],
							order: [["id", "desc"]],
							limit: 1,
							where: { title: "Profile Image" },
						},
						{
							model: Profile,
							as: "user_profile",
							attributes: [
								"id",
								"name",
								"dialing_code",
								"qualification",
								"language",
								"mobile",
								"is_active",
								"created_at",
								"about",
								"overall_ratings",
								"no_of_user_rated",
								"no_of_user_reviewed",
								"city_id",
								"state_id",
								"followee_count",
								"follower_count",
								"no_of_post_posted",
								"no_of_service_provided",
							],
						},
					],
				},
			],
		});

		if (!productDoc) {
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to Get Product"
			);
		}

		return productDoc;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const updateProductStatus = async (reqBody, id) => {
	try {
		const { status, numeral_tax_category } = reqBody;

		// ✅ Validate status
		if (!["approved", "rejected"].includes(status)) {
			throw new ApiError(
				httpStatus.BAD_REQUEST,
				"Invalid status. Use 'approved' or 'rejected'."
			);
		}

		// ✅ Fetch product
		const product = await Product.findOne({
			where: { id: id },
		});

		if (!product) {
			throw new ApiError(httpStatus.NOT_FOUND, "Product not found");
		}

		// ✅ Fetch beautician
		const beautician = await User.findOne({
			where: { id: product.user_id },
			include: ["user_profile"],
		});

		if (!beautician) {
			throw new ApiError(httpStatus.NOT_FOUND, "Beautician not found");
		}

		// ✅ If approved, update status and save tax category
		if (status === "approved") {
			if (!numeral_tax_category) {
				throw new ApiError(
					httpStatus.BAD_REQUEST,
					"Numeral tax category is required when approving a product."
				);
			}

			await Product.update(
				{
					status: "approved",
					numeral_tax_category, // ✅ Save tax category in product table
				},
				{
					where: { id },
				}
			);

			// Send emails
			await sendProductApprovalEmail(
				beautician.email,
				product.name,
				"approved"
			);
			await sendProductStatusNotificationToAdmin(
				product.name,
				beautician.user_profile?.name || "Beautician",
				"approved"
			);
		} else {
			// If rejected, just update the status
			await Product.update({ status: "rejected" }, { where: { id } });

			await sendProductApprovalEmail(
				beautician.email,
				product.name,
				"rejected"
			);
			await sendProductStatusNotificationToAdmin(
				product.name,
				beautician.user_profile?.name || "Beautician",
				"rejected"
			);
		}
	} catch (error) {
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const provideServiceLocation = async (reqBody, res) => {
	const { locations, user } = reqBody;

	if (!Array.isArray(locations) || locations.length === 0) {
		throw new ApiError(
			httpStatus.BAD_REQUEST,
			"Invalid input. 'locations' should be a non-empty array."
		);
	}

	const professionalId = user.id;
	const toCreate = [];
	const toDelete = [];

	// Normalize input
	for (const loc of locations) {
		let state_id = loc.state_id;

		if (!state_id && loc.city_id) {
			const city = await City.findByPk(loc.city_id);
			state_id = city?.state_id;
		}

		if (!state_id || !loc.city_id) continue;

		if (loc.remove) {
			toDelete.push({ state_id, city_id: loc.city_id });
		} else {
			toCreate.push({
				state_id,
				city_id: loc.city_id,
				role_id: "7",
				professional_id: professionalId,
				country_id: 233,
			});
		}
	}

	// Remove locations
	let removed = 0;
	for (const loc of toDelete) {
		const deleted = await ServiceLocation.destroy({
			where: {
				state_id: loc.state_id,
				city_id: loc.city_id,
				professional_id: professionalId,
			},
		});
		removed += deleted;
	}

	// Avoid duplicates before creating
	const existing = await ServiceLocation.findAll({
		where: {
			professional_id: professionalId,
		},
		attributes: ["state_id", "city_id"],
	});

	const existingSet = new Set(
		existing.map((e) => `${e.state_id}_${e.city_id}`)
	);

	const finalToCreate = toCreate.filter(
		(loc) => !existingSet.has(`${loc.state_id}_${loc.city_id}`)
	);

	if (finalToCreate.length > 0) {
		await ServiceLocation.bulkCreate(finalToCreate);
	}

};

const getAllServiceLocations = async (body) => {
	try {
		const { user } = body;

		if (
			user.is_form_filled &&
			(user.form_status === "pending" || user.form_status === null)
		) {
			throw new ApiError(
				httpStatus.FORBIDDEN,
				"Your form is under review. Please wait for admin approval."
			);
		}

		if (user.is_form_filled && user.form_status === "rejected") {
			throw new ApiError(httpStatus.FORBIDDEN, "Your form is rejected.");
		}

		// Check if user has access through any means
		const hasFreeTrialData = user.trial_start_date && user.trial_end_date;
		const hasPremiumData = user.premium_start_date && user.premium_end_date;

		if (
			!user.is_free_trial &&
			!user.is_premium &&
			!hasFreeTrialData &&
			!hasPremiumData
		) {
			throw new ApiError(
				httpStatus.FORBIDDEN,
				"You need to start a free trial or purchase a premium plan to access this feature."
			);
		}

		// Check if the user has an active free trial or premium subscription

		const locationDoc = await ServiceLocation.findAll({
			where: { is_active: true, professional_id: user.id },
			include: [
				{
					model: Country,
					as: "service_country",
					attributes: ["id", "name", "iso3"],
				},
				{
					model: State,
					as: "service_state",
					attributes: ["id", "name", "country_id"],
				},
				{
					model: City,
					as: "service_city",
					attributes: ["id", "name", "country_id", "state_id"],
				},
			],
		});

		if (!locationDoc)
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to Get Locations"
			);

		return locationDoc;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const checkServiceLocation = async (body) => {
	try {
		const { user } = body;

		const locationExists = await ServiceLocation.findOne({
			where: { is_active: true, professional_id: user.id },
		});

		return { exists: !!locationExists };
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const deleteServiceLocations = async (reqBody) => {
	try {
		const { user, location_ids } = reqBody;

		if (!Array.isArray(location_ids) || location_ids.length === 0) {
			throw new ApiError(
				httpStatus.BAD_REQUEST,
				"Invalid input. 'location_ids' should be a non-empty array."
			);
		}

		// Count the current locations for the professional
		const currentLocationsCount = await ServiceLocation.count({
			where: { professional_id: user.id },
		});

		// Check if the deletion will leave no locations
		if (currentLocationsCount <= location_ids.length) {
			throw new ApiError(
				httpStatus.BAD_REQUEST,
				"You cannot delete these locations because at least one location must remain for this professional."
			);
		}

		// Delete the specified locations
		const currentTimestamp = new Date()
			.toISOString()
			.replace("T", " ")
			.split(".")[0];
		await ServiceLocation.update(
			{ is_active: false, deleted_at: currentTimestamp },
			{
				where: {
					id: location_ids,
					professional_id: user.id,
					is_active: true,
				},
			}
		);
	} catch (error) {
		console.error(error);
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

module.exports = {
	createProduct,
	getPendingProductCount,
	getAllProducts,
	findProductById,
	getProductById,
	getAllProductsByBeuticianId,
	updateProduct,
	deleteProduct,
	getAllProductsForUser,
	getAllProductsForAdmin,
	updateProductStatus,
	provideServiceLocation,
	getAllServiceLocations,
	checkServiceLocation,
	deleteServiceLocations,
};
