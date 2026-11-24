const httpClient = require("../core/http/httpClient");
const config = require("../core/config/config");

// --- The Responses API with Structured Outputs (Nov 24: the topics' AI runs, website/content/topicAi.service.js)

// An OpenAI failure, by kind: `unavailable` (no answer, a timeout, OpenAI's own error or rate limit: try again later),
// `refused` (the model declined), `invalid` (OpenAI refused the request: key, model or schema), `incomplete` (the answer
// was cut off).
class OpenAIError extends Error {
  constructor(kind, message) {
    super(message);
    this.name = "OpenAIError";
    this.kind = kind;
  }
}

// The model's answer text, or a refusal, from a response's output items (reasoning items have no text).
const answerOf = (data) => {
  for (const item of data.output || []) {
    if (item.type !== "message") continue;
    for (const part of item.content || []) {
      if (part.type === "refusal") throw new OpenAIError("refused", `The model declined: ${String(part.refusal || "").slice(0, 200)}`);
      if (part.type === "output_text" && typeof part.text === "string") return part.text;
    }
  }
  throw new OpenAIError("incomplete", "The model gave no answer.");
};

const responses = {
  // { value, usage: { input_tokens, output_tokens } }: the model's answer to `input` under `instructions`, as JSON
  // matching the strict JSON `schema` (named `name`). `effort`: the reasoning effort. Nothing is stored at OpenAI.
  json: async ({ model, instructions, input, schema, name, effort, maxOutputTokens = 32000, timeout = 180000 }) => {
    let data;
    try {
      ({ data } = await httpClient.post("https://api.openai.com/v1/responses", {
        model,
        instructions,
        input,
        ...(effort && { reasoning: { effort } }),
        text: { format: { type: "json_schema", name, schema, strict: true } },
        max_output_tokens: maxOutputTokens,
        store: false,
      }, { headers: { Authorization: `Bearer ${config.OPENAI_API_KEY}` }, timeout }));
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.error?.message;
      if (!status || status === 429 || status >= 500) throw new OpenAIError("unavailable", detail || err.message);
      throw new OpenAIError("invalid", `${status}: ${detail || err.message}`);
    }
    if (data.status === "incomplete") throw new OpenAIError("incomplete", `The answer was cut off (${data.incomplete_details?.reason || "unknown"}).`);
    if (data.status && data.status !== "completed") throw new OpenAIError("unavailable", `The response ended as ${data.status}.`);
    const text = answerOf(data);
    let value;
    try {
      value = JSON.parse(text);
    } catch {
      throw new OpenAIError("incomplete", "The answer was not JSON.");
    }
    return { value, usage: { input_tokens: data.usage?.input_tokens ?? 0, output_tokens: data.usage?.output_tokens ?? 0 } };
  },
};

const configured = () => Boolean(config.OPENAI_API_KEY);

// --- The app's skin analysis (src/mobile/face-analysis), unchanged

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




module.exports = { getAISkinExplanation, askAIQuestion, getProfessionalServiceRecommendation, responses, configured, OpenAIError };
