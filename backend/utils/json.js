export function extractJSON(raw) {
  if (!raw || typeof raw !== "string") {
    throw new Error("Model output is empty or not a string");
  }

  let text = raw.trim();

  text = text.replace(/^```json\s*/i, "");
  text = text.replace(/^```\s*/i, "");
  text = text.replace(/\s*```$/i, "");

  try {
    return JSON.parse(text);
  } catch {}

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error(`No JSON object found in model output:\n${raw}`);
  }

  const candidate = text.slice(firstBrace, lastBrace + 1);

  try {
    return JSON.parse(candidate);
  } catch (err) {
    console.error("FAILED JSON CANDIDATE:\n", candidate);
    throw new Error(`Failed to parse JSON: ${err.message}`);
  }
}