/** @format */

const httpStatus = require("http-status");

const ApiError = require("../../utils/ApiError");
const { Product, Wishlist, ProductAttachment, Cart } = require("../../models");

const addToWishlist = async (reqBody) => {
	const { user, product_id } = reqBody;

	try {
		if (!product_id) {
			throw new ApiError(httpStatus.BAD_REQUEST, "Product ID must be provided");
		}

		// Find the product by its ID
		const productDoc = await Product.findOne({ where: { id: product_id } });
		if (!productDoc) {
			throw new ApiError(httpStatus.BAD_REQUEST, "Product not found");
		}

		// Check if the product is already in the user's wishlist
		const existingProductInWishlist = await Wishlist.findOne({
			where: { user_id: user.id, product_id: product_id },
		});

		// If product already exists in the wishlist, remove it
		if (existingProductInWishlist) {
			await Wishlist.destroy({
				where: { user_id: user.id, product_id: product_id },
			});
			return {
				success: true,
				status: httpStatus.OK,
				message: "Product removed from wishlist",
			};
		}

		// Otherwise, add the product to the wishlist
		const coursePrice = parseFloat(productDoc.price);
		await Wishlist.create({
			user_id: user.id,
			product_id: product_id,
			price: coursePrice,
		});

		return {
			success: true,
			status: httpStatus.OK,
			message: "Product added to wishlist",
		};
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getAllItemsFromWishlist = async (reqBody) => {
	const { user } = reqBody;

	try {
		// Fetch wishlist items with product details and attachments
		const wishlistItems = await Wishlist.findAll({
			where: { user_id: user.id },
			include: [
				{
					model: Product,
					as: "wishlist_product",
					attributes: [
						"id",
						"name",
						"price",
						"stock",
						"average_rating",
						"rating",
					],
					include: [
						{
							model: ProductAttachment,
							as: "product_attachments",
							attributes: ["id", "file_type", "file_name", "file_uri"],
						},
					],
				},
			],
		});

		// Check if cart contains the product
		const cartItems = await Cart.findAll({
			where: { user_id: user.id },
			attributes: ["product_id"], // Only need product ids from cart
		});
		const cartProductIds = cartItems.map(item => item.product_id);

		// Prepare response
		if (!wishlistItems || wishlistItems.length === 0) {
			return [];
		}

		// Format the wishlist items with the `in_cart` flag
		const formattedItems = wishlistItems.map((item) => {
			const product = item.wishlist_product;
			const firstImage =
				product.product_attachments && product.product_attachments.length > 0
					? product.product_attachments[0].file_name
					: null;

			return {
				id: item.id,
				productId: product.id,
				name: product.name,
				price: product.price,
				stock: product.stock,
				inStock: product.stock > 0,
				averageRating: product.average_rating,
				rating: product.rating,
				image: firstImage,
				in_cart: cartProductIds.includes(product.id), // Check if the product is in cart
			};
		});

		return {
			totalItems: formattedItems.length,
			wishlistItems: formattedItems,
		};
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};


const removeProductFromWishlist = async (reqBody) => {
	const { user } = reqBody;
	try {
		const cartDoc = await Wishlist.findOne({
			where: { id: reqBody.wishlist_id, user_id: user.id, is_active: true },
		});

		if (!cartDoc) {
			throw new ApiError(
				httpStatus.BAD_REQUEST,
				"This product doesn't exist in cart"
			);
		}

		// Delete the cart entry from the database
		await cartDoc.destroy();

		return { message: "Product removed from the wishlist successfully" };
	} catch (error) {
		throw new ApiError(
			error.statusCode ?? httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

module.exports = {
	addToWishlist,
	getAllItemsFromWishlist,
	removeProductFromWishlist
};
