export function flattenFields(schemaObj) {
  if (!schemaObj) return [];

  if (Array.isArray(schemaObj.fields)) {
    return schemaObj.fields;
  }

  if (Array.isArray(schemaObj.sections)) {
    return schemaObj.sections.flatMap((section) => section.fields || []);
  }

  if (Array.isArray(schemaObj)) {
    return schemaObj.flatMap((section) => section.fields || []);
  }

  return [];
}

export function getAllowedFieldNames(fields) {
  return new Set(
    fields
      .map((f) => f.name || f.id || f.key)
      .filter(Boolean)
  );
}

export function getFieldListText(fields) {
  return fields
    .map((f) => {
      const name = f.name || f.id || f.key;
      const type = f.type || "string";
      const required = f.required ? "required" : "optional";
      const options = Array.isArray(f.options)
        ? ` options: ${f.options.join(", ")}`
        : "";
      return `- ${name} (${type}, ${required})${options}`;
    })
    .join("\n");
}