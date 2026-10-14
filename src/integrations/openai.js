/** @format */

const httpClient = require("../core/http/httpClient");

// OpenAI Chat Completions over plain HTTP (https://platform.openai.com/docs/api-reference/chat).
const createChatCompletion = async (body) => {
	const response = await httpClient.post("https://api.openai.com/v1/chat/completions", body, {
		headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
		timeout: 120000,
	});
	return response.data;
};

async function getAISkinExplanation(attrs) {
	const prompt = `
You are an AI skin-care consultant.
Analyze the following skin attributes from Face++ and provide a 2–3 sentence explanation 
in natural language about the user's skin condition, overall health, and care suggestions.
${JSON.stringify(attrs, null, 2)}
`;

	const completion = await createChatCompletion({
		model: "gpt-4o-mini",
		messages: [{ role: "user", content: prompt }],
	});

	return completion.choices[0].message.content.trim();
}

async function askAIQuestion(summary, question) {
  const completion = await createChatCompletion({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are a professional AI skincare consultant providing advice based on prior skin analysis.",
      },
      { role: "user", content: `Skin analysis summary: ${summary}` },
      { role: "user", content: `User's question: ${question}` },
    ],
  });

  return completion.choices[0].message.content.trim();
}


async function getProfessionalServiceRecommendation (summary, professionals) {
  const professionalSummary = professionals.map(b => {
    const aboutText = b.about ? `About: ${b.about}` : "";
    const serviceList = b.services.map(s => `- ${s.name} ($${s.price})`).join("\n");
    return `Professional: ${b.name}\n${aboutText}\nServices:\n${serviceList}`;
  }).join("\n\n");

  const prompt = `
You are a professional AI skincare consultant.
A user's skin analysis summary is provided below, followed by a list of available professionals and their services.

--- USER SKIN SUMMARY ---
${summary}

--- AVAILABLE PROFESSIONALS ---
${professionalSummary}

Please analyze the user's skin needs and recommend:
1. The **most suitable professional(s)**.
2. The **specific services** that best match their skin concerns.
3. A friendly, human-style explanation of why these were chosen.
4. If no “About” text is available for a professional, skip it gracefully.

Your answer should sound like a personal skincare consultation.
`;

  const completion = await createChatCompletion({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  return completion.choices[0].message.content.trim();
};




module.exports = { getAISkinExplanation, askAIQuestion,getProfessionalServiceRecommendation };
