import { callOllama } from "./llm.js";
import { extractJSON } from "../utils/json.js";
import { normaliseExtractionOutput } from "../utils/normalise.js";
import { getFieldListText } from "../utils/schema.js";

export async function runExtractionAgent(userMessage, formState, formFields, allowedFieldNames) {
  const prompt = `
You are an extraction agent for a form-filling chatbot.

Your job:
- Read the user's latest message.
- Extract only values that clearly match the allowed field names below.
- Never invent new field names.
- Never use "undefined" as a key.
- If no field can be safely updated, return an empty updated_fields object.
- Return ONLY valid JSON.
- No markdown.
- No explanation.

Allowed fields:
${getFieldListText(formFields)}

Current form state:
${JSON.stringify(formState, null, 2)}

User message:
${userMessage}

Return exactly in this format:
{
  "updated_fields": {},
  "next_question": ""
}
`.trim();

  const raw = await callOllama([
    {
      role: "system",
      content: "You strictly return valid JSON for form extraction.",
    },
    {
      role: "user",
      content: prompt,
    },
  ]);

  console.log("EXTRACTION RAW:", raw);

  const parsed = extractJSON(raw);
  return normaliseExtractionOutput(parsed, allowedFieldNames);
}