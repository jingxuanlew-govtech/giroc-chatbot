import { callOllama } from "./llm.js";
import { extractJSON } from "../utils/json.js";
import { normaliseCriticOutput } from "../utils/normalise.js";
import { getFieldListText } from "../utils/schema.js";

export async function runCriticAgent(
  userMessage,
  extractionResult,
  formStateBefore,
  formStateAfter,
  formFields
) {
  const prompt = `
You are a critic agent for a form-filling chatbot.

Evaluate whether the extraction result is good.

Rules:
- Only allowed field names may be used.
- Penalise invented fields such as "undefined".
- Reward no guessing.
- Return ONLY valid JSON.
- No markdown.
- No explanation.
- Only extract information explicitly stated by the user.
- Do not guess or invent values.
- Do not create an incident title unless the user explicitly provides one.
- If the user gives a relative date/time like "yesterday" or "this morning", keep it as stated rather than guessing an exact timestamp.
- Return null for unknown fields.

Allowed fields:
${getFieldListText(formFields)}

User message:
${userMessage}

Form state before:
${JSON.stringify(formStateBefore, null, 2)}

Extraction result:
${JSON.stringify(extractionResult, null, 2)}

Form state after:
${JSON.stringify(formStateAfter, null, 2)}

Return exactly in this format:
{
  "passed": true,
  "scores": {
    "field_accuracy": 0,
    "no_guessing": 0,
    "schema_compliance": 0,
    "next_question_quality": 0,
    "overall": 0
  },
  "issues": []
}
`.trim();

  const raw = await callOllama([
    {
      role: "system",
      content: "You strictly return valid JSON for critic evaluation.",
    },
    {
      role: "user",
      content: prompt,
    },
  ]);

  console.log("CRITIC RAW:", raw);

  try {
    const parsed = extractJSON(raw);
    return normaliseCriticOutput(parsed);
  } catch (err) {
    console.error("Critic parse failed:", err.message);
    return {
      passed: false,
      scores: {
        field_accuracy: 0,
        no_guessing: 0,
        schema_compliance: 0,
        next_question_quality: 0,
        overall: 0,
      },
      issues: [["critic_parse_failed", err.message]],
    };
  }
}