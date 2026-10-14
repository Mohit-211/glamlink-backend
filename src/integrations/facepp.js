/** @format */

const fs = require("fs");
const path = require("path");
const httpClient = require("../core/http/httpClient");

const FACEPP_API_KEY = process.env.FACEPP_API_KEY;
const FACEPP_API_SECRET = process.env.FACEPP_API_SECRET;

const FACEPP_DETECT_URL = "https://api-us.faceplusplus.com/facepp/v3/detect";
const FACEPP_SKIN_URL = "https://api-us.faceplusplus.com/facepp/v1/skinanalyze";

// Multipart form with the API credentials and the image file (native FormData; fetch sets the boundary).
const imageForm = async (imagePath) => {
	const form = new FormData();
	form.append("api_key", FACEPP_API_KEY);
	form.append("api_secret", FACEPP_API_SECRET);
	form.append("image_file", new Blob([await fs.promises.readFile(imagePath)]), path.basename(imagePath));
	return form;
};

const analyze = async (imagePath) => {
	try {
		const form = await imageForm(imagePath);
		form.append(
			"return_attributes",
			"gender,age,smiling,emotion,beauty,skinstatus"
		);

		const response = await httpClient.post(FACEPP_DETECT_URL, form);

		// Face++ returns { faces: [ { face_token, attributes: {...} } ] }
		if (response.data.faces && response.data.faces.length > 0) {
			return response.data.faces[0];
		} else {
			return null;
		}
	} catch (error) {
		console.error("Face++ API error:", error.response?.data || error.message);
		throw error;
	}
};

const analyzeSkin = async (imagePath) => {
	try {
		const form = await imageForm(imagePath);
		const response = await httpClient.post(FACEPP_SKIN_URL, form);
		return response.data;
	} catch (error) {
		console.error("Face++ Skin Analyze error:", error.response?.data || error.message);
		throw error;
	}
};

module.exports = { analyze, analyzeSkin };
