/** @format */

const OpenAI = require("openai");

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function getAISkinExplanation(attrs) {
	const prompt = `
You are an AI skin-care consultant.
Analyze the following skin attributes from Face++ and provide a 2–3 sentence explanation 
in natural language about the user's skin condition, overall health, and care suggestions.
${JSON.stringify(attrs, null, 2)}
`;

	const completion = await client.chat.completions.create({
		model: "gpt-4o-mini",
		messages: [{ role: "user", content: prompt }],
	});

	return completion.choices[0].message.content.trim();
}

async function askAIQuestion(summary, question) {
  const completion = await client.chat.completions.create({
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


async function getBeauticianServiceRecommendation (summary, beauticians) {
  const beauticianSummary = beauticians.map(b => {
    const aboutText = b.about ? `About: ${b.about}` : "";
    const serviceList = b.services.map(s => `- ${s.name} ($${s.price})`).join("\n");
    return `Beautician: ${b.name}\n${aboutText}\nServices:\n${serviceList}`;
  }).join("\n\n");

  const prompt = `
You are a professional AI skincare consultant.
A user's skin analysis summary is provided below, followed by a list of available beauticians and their services.

--- USER SKIN SUMMARY ---
${summary}

--- AVAILABLE BEAUTICIANS ---
${beauticianSummary}

Please analyze the user's skin needs and recommend:
1. The **most suitable beautician(s)**.
2. The **specific services** that best match their skin concerns.
3. A friendly, human-style explanation of why these were chosen.
4. If no “About” text is available for a beautician, skip it gracefully.

Your answer should sound like a personal skincare consultation.
`;

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  return completion.choices[0].message.content.trim();
};




module.exports = { getAISkinExplanation, askAIQuestion,getBeauticianServiceRecommendation };
