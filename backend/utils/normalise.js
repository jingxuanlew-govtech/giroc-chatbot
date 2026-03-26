export function sanitiseUpdatedFields(updatedFields, allowedFieldNames) {
  const cleaned = {};

  for (const [key, value] of Object.entries(updatedFields || {})) {
    if (
      allowedFieldNames.has(key) &&
      key !== "undefined" &&
      key !== "null" &&
      key !== ""
    ) {
      cleaned[key] = value;
    } else {
      console.warn(`Dropping invalid field from model output: ${key}`);
    }
  }

  return cleaned;
}

export function normaliseExtractionOutput(parsed, allowedFieldNames) {
  return {
    updated_fields: sanitiseUpdatedFields(
      parsed?.updated_fields || {},
      allowedFieldNames
    ),
    next_question:
      typeof parsed?.next_question === "string" ? parsed.next_question : "",
  };
}

export function normaliseCriticOutput(critic) {
  return {
    passed: Boolean(critic?.passed),
    scores: {
      field_accuracy: Number(critic?.scores?.field_accuracy ?? 0),
      no_guessing: Number(critic?.scores?.no_guessing ?? 0),
      schema_compliance: Number(
        critic?.scores?.schema_compliance ??
          critic?.scores?.scheme_compliance ??
          0
      ),
      next_question_quality: Number(
        critic?.scores?.next_question_quality ?? 0
      ),
      overall: Number(critic?.scores?.overall ?? 0),
    },
    issues: Array.isArray(critic?.issues) ? critic.issues : [],
  };
}

export function mergeFormState(currentState, updates) {
  return {
    ...currentState,
    ...updates,
  };
}