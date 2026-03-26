export function flattenFields(schemaObj) {
  if (!schemaObj) return [];

  // Case 1: standard schema with top-level sections
  if (Array.isArray(schemaObj.sections)) {
    return schemaObj.sections.flatMap((section) => section.fields || []);
  }

  // Case 2: top-level fields exists, but may actually contain sections
  if (Array.isArray(schemaObj.fields)) {
    const firstItem = schemaObj.fields[0];

    // If fields array actually contains sections, flatten again
    if (firstItem && Array.isArray(firstItem.fields)) {
      return schemaObj.fields.flatMap((section) => section.fields || []);
    }

    // Otherwise it's already a flat array of real fields
    return schemaObj.fields;
  }

  // Case 3: schema itself is an array
  if (Array.isArray(schemaObj)) {
    const firstItem = schemaObj[0];

    // If array contains sections
    if (firstItem && Array.isArray(firstItem.fields)) {
      return schemaObj.flatMap((section) => section.fields || []);
    }

    // Otherwise assume already flat fields
    return schemaObj;
  }

  return [];
}

export function getAllowedFieldNames(fields) {
  return new Set(
    fields
      .map((field) => field.name)
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
