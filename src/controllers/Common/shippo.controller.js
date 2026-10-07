/** @format */

const httpStatus = require("http-status");
const catchAsync = require("../../utils/catchAsync");
const { OrderDetails } = require("../../models");

const handleShippoWebhook = catchAsync(async (req, res) => {
	try {
		const event = req.body;
		console.log("Shippo Webhook Event:", event);

		if (event.event !== "track_updated" || !event.data) {
			return res.status(400).json({ message: "Invalid event" });
		}

		const { tracking_status, eta, tracking_number ,object_id} = event.data;

		// Handle test webhook gracefully
		if (event.test) {
			console.log("Test webhook received:", tracking_number);
			return res.status(200).send("Test webhook received");
		}

		if (!tracking_status || !tracking_status.status) {
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Missing tracking status"
			);
		}

		const orderDoc = await OrderDetails.findOne({
			where: { shippo_tracking_number: object_id },
		});

		if (!orderDoc) {
			console.log("No order found for tracking number:", tracking_number);
			return res.status(200).send("Webhook received but order not found");
		}

		const statusMap = {
			PRE_TRANSIT: "PLACED",
			TRANSIT: "SHIPPED",
			OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
			DELIVERED: "DELIVERED",
			FAILURE: "FAILED_DELIVERY",
			RETURNED: "RETURNED",
		};

		const newStatus = statusMap[tracking_status.status];
		if (newStatus && orderDoc.order_status !== newStatus) {
			orderDoc.order_status = newStatus;
		}

		if (eta) {
			orderDoc.estimated_date = eta;
		}

		await orderDoc.save();
		return res.status(200).send("OK");
	} catch (error) {
		console.error("Shippo Webhook Error:", error);
		return res.status(500).json({ message: "Internal server error" });
	}
});


module.exports = {
	handleShippoWebhook,
};
