/** @format */

const axios = require("axios");
const { getAllProductsInCart } = require("./cart.service");
const { getAllUserAddress } = require("./order.service");
const config = require("../../config/config");

const NUMERAL_API_KEY = config.NUMERAL_API_KEY || "";
const NUMERAL_BASE_URL = config.NUMERAL_BASE_URL || "";

const calculateCheckoutTax = async (reqBody) => {
	console.log(reqBody,"reqBody")
	try {
		const { user } = reqBody;


		// ✅ Fetch user's cart
		const cartData = await getAllProductsInCart({ user });
		if (cartData.totalItems === 0) {
			return {
				totalPrice: 0,
				taxAmount: 0,
				finalAmount: 0,
				message: "Cart is empty.",
			};
		}

		console.log(cartData.cartItems, "🛒 cartData");

		// ✅ Fetch User's Address (Destination)
		const userAddresses = await getAllUserAddress({ user });
		if (userAddresses.length === 0) {
			throw new Error("No active shipping address found.");
		}
		const selectedAddress = userAddresses[0];

		const destination = {
			address_line_1: selectedAddress.address_line_1 || "",
			address_city: selectedAddress.user_city?.name || "",
			address_province: selectedAddress.province_code || "",
			address_postal_code: selectedAddress.postal_code || "89101",
			address_country: "US",
			address_type: "shipping",
		};
		console.log("🚀 Destination Address:", destination);

		// ✅ Group Products by Seller & Tax Category
		const sellerCategoryMap = {};
		cartData.cartItems.forEach((cartItem) => {
			const product = cartItem.cart_product;
			const category = product.numeral_tax_category;
			const quantity = cartItem.total_items || 1;
			const sellerId = product.user_id; // Seller ID (Beautician)

			if (!category) {
				throw new Error(`🚨 Product ${product.name} is missing a tax category.`);
			}

			// Group by Seller ID & Category
			if (!sellerCategoryMap[sellerId]) {
				sellerCategoryMap[sellerId] = {};
			}
			if (!sellerCategoryMap[sellerId][category]) {
				sellerCategoryMap[sellerId][category] = { amount: 0, quantity: 0 };
			}

			// Add Amount & Quantity
			// sellerCategoryMap[sellerId][category].amount += product.price * quantity;
			sellerCategoryMap[sellerId][category].amount += Math.round(product.price * 100) * quantity;

			sellerCategoryMap[sellerId][category].quantity += quantity;
		});
		console.log("📊 Grouped by Seller & Tax Category:", sellerCategoryMap);

		// ✅ Fetch Origin Addresses for Each Seller
		const sellerAddresses = {};
		for (const sellerId of Object.keys(sellerCategoryMap)) {
			const sellerAddressData = await getAllUserAddress({ user: { id: sellerId } });

			if (sellerAddressData.length === 0) {
				throw new Error(`No active address found for seller ID: ${sellerId}`);
			}

			const sellerAddress = sellerAddressData[0];

			sellerAddresses[sellerId] = {
				address_line_1: sellerAddress.address_line_1 || "",
				address_city: sellerAddress.user_city?.name || "",
				address_province: sellerAddress.province_code || "",
				address_postal_code: sellerAddress.postal_code || "90001",
				address_country: "US",
			};
			console.log(`🏢 Seller ${sellerId} Origin Address:`, sellerAddresses[sellerId]);
		}

		// ✅ Call NumeralHQ API for Each Seller & Tax Category
		const taxResponses = await Promise.all(
			Object.entries(sellerCategoryMap).map(async ([sellerId, categories]) => {
				return Promise.all(
					Object.entries(categories).map(async ([category, { amount, quantity }]) => {
						const requestData = {
							customer: { address: destination },
							origin_address: sellerAddresses[sellerId], // Seller's Address
							order_details: {
								customer_currency_code: "USD",
								tax_included_in_amount: false,
								line_items: [{ product_category: category, amount, quantity }],
							},
						};

						console.log("📤 Sending Request to NumeralHQ:", JSON.stringify(requestData, null, 2));

						const response = await axios.post(
							"https://api.numeralhq.com/tax/calculations",
							requestData,
							{
								headers: {
									Authorization: `Bearer ${NUMERAL_API_KEY}`,
									"Content-Type": "application/json",
								},
							}
						);

						console.log("✅ Numeral API Response:", response.data);

						return {
							line_item_id: `li_${Date.now()}`,
							product: {
								reference_line_item_id: "",
								reference_product_id: "",
								reference_product_name: "",
								product_tax_code: category,
							},
							tax_jurisdictions: response.data.line_items[0].tax_jurisdictions || [],
							tax_amount: response.data.total_tax_amount,
							amount_excluding_tax: amount,
							amount_including_tax: amount + response.data.total_tax_amount,
							quantity,
						};
					})
				);
			})
		);

		// ✅ Flatten Tax Responses
		const flatTaxResponses = taxResponses.flat();

		// ✅ Sum up total tax
		const totalTax = flatTaxResponses.reduce((sum, item) => sum + item.tax_amount, 0);
		const totalTaxInDollars = totalTax / 100;
		
        const totalAmountExcludingTax = cartData.totalPrice; // already in dollars
        // const totalAmountIncludingTax = totalAmountExcludingTax + totalTaxInDollars;
		const totalAmountIncludingTax = parseFloat((totalAmountExcludingTax + totalTaxInDollars).toFixed(2));


		// const totalAmountExcludingTax = cartData.totalPrice;
		// const totalAmountIncludingTax = totalAmountExcludingTax + totalTax;

		// ✅ Return response in the expected format
		const responseData = {
			testmode: true,
			id: `calc_${Date.now()}`,
			object: "tax.calculation",
			customer_currency_code: "USD",
			line_items: flatTaxResponses,
			total_tax_amount: totalTaxInDollars,
			tax_included_in_amount: false,
			total_amount_excluding_tax: totalAmountExcludingTax,
	        total_amount_including_tax: totalAmountIncludingTax,
			expires_at: Math.floor(Date.now() / 1000) + 86400, // Expires in 24 hours
		};

		console.log("📤 Final Response:", JSON.stringify(responseData, null, 2));
		return responseData;
	} catch (error) {
		console.error("❌ Checkout Tax Calculation Error:", error.response?.data || error.message);
		throw new Error("NumeralHQ API request failed.");
	}
};


module.exports = { calculateCheckoutTax };
