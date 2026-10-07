/** @format */

const axios = require("axios");
const FormData = require("form-data");

const FACEPP_API_KEY = process.env.FACEPP_API_KEY;
const FACEPP_API_SECRET = process.env.FACEPP_API_SECRET;

const FACEPP_DETECT_URL = "https://api-us.faceplusplus.com/facepp/v3/detect";
const FACEPP_SKIN_URL = "https://api-us.faceplusplus.com/facepp/v1/skinanalyze";

const analyze = async (imagePath) => {
	try {
		const fs = require("fs");
		const FormData = require("form-data");
		const form = new FormData();

		form.append("api_key", FACEPP_API_KEY);
		form.append("api_secret", FACEPP_API_SECRET);
		form.append("image_file", fs.createReadStream(imagePath));
		form.append(
			"return_attributes",
			"gender,age,smiling,emotion,beauty,skinstatus"
		);

		const response = await axios.post(FACEPP_DETECT_URL, form, {
			headers: form.getHeaders(),
		});

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
		const fs = require("fs");
		const form = new FormData(); 
		form.append("api_key", FACEPP_API_KEY);
		form.append("api_secret", FACEPP_API_SECRET);
		form.append("image_file", fs.createReadStream(imagePath));

		const response = await axios.post(FACEPP_SKIN_URL, form, {
			headers: form.getHeaders(),
		});

		return response.data;
	} catch (error) {
		console.error("Face++ Skin Analyze error:", error.response?.data || error.message);
		throw error;
	}
};

module.exports = { analyze,analyzeSkin };
