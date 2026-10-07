/** @format */

const httpStatus = require("http-status");

const { Product, ProductAttachment, Cart } = require("../../models");
const ApiError = require("../../utils/ApiError");

const addItemToCart = async (reqBody) => {
	const { user, quantity } = reqBody;
	try {
		const productDoc = await Product.findOne({
			where: { id: reqBody.product_id },
		});

		if (!productDoc) {
			throw new ApiError(httpStatus.BAD_REQUEST, "Product Id doesn't exist");
		}

		const existingCartItem = await Cart.findOne({
			where: { user_id: user.id, product_id: reqBody.product_id },
		});

		let totalItems = quantity > 1 ? quantity : 1;
		console.log("object", totalItems);

		if (existingCartItem) {
			totalItems = +totalItems;
			totalItems += existingCartItem.dataValues.total_items;
		}

		if (productDoc.stock < totalItems) {
			throw new ApiError(
				httpStatus.BAD_REQUEST,
				`Not enough stock for this product. Please Select ${productDoc.stock} products only`
			);
		}

		const totalPriceOfProduct = productDoc.price * totalItems;

		if (existingCartItem) {
			// Update existing cart item
			existingCartItem.total_items = totalItems;
			existingCartItem.total_price = totalPriceOfProduct;
			await existingCartItem.save();
		} else {
			// Create a new cart item
			const cartObj = {
				user_id: user.id,
				product_id: reqBody.product_id,
				total_items: totalItems,
                price:productDoc.price,
				total_price: totalPriceOfProduct,
			};

			const cartDoc = await Cart.create(cartObj);
			if (!cartDoc) {
				throw new ApiError(
					httpStatus.INTERNAL_SERVER_ERROR,
					"Failed to add item to cart"
				);
			}
		}

	} catch (error) {
		throw new ApiError(
			error.statusCode ?? httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const updateProductQuantity = async (reqBody) => {
	const { user } = reqBody;
	try {
		const cartDoc = await Cart.findOne({
			where: { id: reqBody.cart_id, user_id: user.id, is_active: 1 },
			include: [
				{
					model: Product,
					as: "cart_product",
					attributes: ["id", "name", "price", "stock"],
				},
			],
		});

		if (!cartDoc) {
			throw new ApiError(
				httpStatus.BAD_REQUEST,
				"This product doesn't exist in cart"
			);
		}

		// Determine whether to increase or decrease the quantity
		const quantityChange = reqBody.action === "increase" ? 1 : -1;

		// Check if the stock is sufficient when increasing the quantity
		if (
			quantityChange === 1 &&
			cartDoc.cart_product.stock < cartDoc.total_items + quantityChange
		) {
			throw new ApiError(
				httpStatus.BAD_REQUEST,
				"Not enough stock for this product"
			);
		}

		// Update the quantity and recalculate total price
		cartDoc.total_items += quantityChange;
		cartDoc.total_price = cartDoc.cart_product.price * cartDoc.total_items;

		await cartDoc.save();

		// Check if the quantity becomes 0, delete the row from the database
		if (cartDoc.total_items === 0) {
			await cartDoc.destroy();
			return { message: "Product removed from the cart successfully" };
		}

		return cartDoc;
	} catch (error) {
		throw new ApiError(
			error.statusCode ?? httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const removeProduct = async (reqBody) => {
	const { user } = reqBody;
	try {
		const cartDoc = await Cart.findOne({
			where: { id: reqBody.cart_id, user_id: user.id, is_active: 1 },
		});

		if (!cartDoc) {
			throw new ApiError(
				httpStatus.BAD_REQUEST,
				"This product doesn't exist in cart"
			);
		}

		// Delete the cart entry from the database
		await cartDoc.destroy();

		return { message: "Product removed from the cart successfully" };
	} catch (error) {
		throw new ApiError(
			error.statusCode ?? httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getAllProductsInCart = async (body) => {
	try {
		const { user } = body;
		const cartDocs = await Cart.findAll({
			where: {
				user_id: user.id,
				is_active: 1,
			},
			include: [
				{
					model: Product,
					as: "cart_product",
					attributes: ["id", "name", "price", "stock","numeral_tax_category","user_id"],
					include: [
						{
							model: ProductAttachment,
							as: "product_attachments",
							attributes: [
								"id",
								"file_type",
								"file_name",
								"file_uri",
								"product_id",
							],
						},
					],
				},
			],
		});

		if (!cartDocs || cartDocs.length === 0) {
			return {
				cartItems: [],
				totalItems: 0,
				totalPrice: 0,
			};
		}

		// Calculate total items and total price
		let totalItems = 0;
		let totalPrice = 0;

		cartDocs.forEach((cartDoc) => {
			const product = cartDoc.cart_product;
			let quantity = cartDoc.total_items || 1;

			// Ensure quantity does not exceed the available stock
			quantity = Math.min(quantity, product.stock);

			totalItems += quantity;
			totalPrice += product.price * quantity;

			// Deduct total_price and total_items if stock is 0
			if (product.stock === 0) {
				totalPrice += cartDoc.total_price;
				totalItems += cartDoc.total_items;
			}
		});

		// Add total items and total price to the result
		const result = {
			cartItems: cartDocs,
			totalItems,
			totalPrice,
		};

		return result;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

module.exports = {
	addItemToCart,
	updateProductQuantity,
	removeProduct,
	getAllProductsInCart,
	
};
