import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import { flattenFields, getAllowedFieldNames } from "./utils/schema.js";
import { loadSchema } from "./utils/loadSchema.js";
import { mergeFormState } from "./utils/normalise.js";
import { runExtractionAgent } from "./services/extractor.js";
import { runCriticAgent } from "./services/critic.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ------------------------- Load form schema ------------------------- */

const schema = loadSchema(__dirname);
const formFields = flattenFields(schema);
const allowedFieldNames = getAllowedFieldNames(formFields);

/* ------------------------- Helper functions ------------------------- */

function isEmpty(value) {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

function getFieldName(field) {
  return field?.name || field?.field_name || field?.id || null;
}

function isRequiredField(field) {
  return (
    field?.required === true ||
    field?.is_required === true ||
    field?.mandatory === true
  );
}

function isFieldRelevant(field, formState) {
  const dependsOn = field?.depends_on || field?.dependsOn;
  if (!dependsOn) return true;

  const parentValue = formState?.[dependsOn];

  if (field?.depends_on_value !== undefined) {
    return parentValue === field.depends_on_value;
  }

  if (
    Array.isArray(field?.depends_on_values) &&
    field.depends_on_values.length > 0
  ) {
    return field.depends_on_values.includes(parentValue);
  }

  if (field?.mapping && typeof field.mapping === "object") {
    return Object.prototype.hasOwnProperty.call(field.mapping, parentValue);
  }

  return true;
}

function applySchemaRules(formState) {
  const updated = { ...formState };

  if (updated.reporting_agency === "DOS") {
    updated.ministry_family = "MTI";
  } else if (updated.reporting_agency === "GOVTECH") {
    updated.ministry_family = "MDDI";
  }

  return updated;
}

function isRelativeDateTime(value) {
  if (isEmpty(value)) return false;

  const text = String(value).toLowerCase();

  const relativeTerms = [
    "yesterday",
    "today",
    "tomorrow",
    "this morning",
    "this afternoon",
    "this evening",
    "tonight",
    "last night",
    "around",
    "about",
    "approximately",
    "approx",
  ];

  return relativeTerms.some((term) => text.includes(term));
}

function assessField(field, formState, meta = {}) {
  const fieldName = getFieldName(field);
  const value = formState?.[fieldName];

  if (isEmpty(value)) {
    return { status: "missing" };
  }

  if (field?.type === "datetime" && isRelativeDateTime(value)) {
    return { status: "partial", reason: "relative_datetime" };
  }

  if (
    fieldName === "incident_title" &&
    meta?.incident_title_source === "inferred"
  ) {
    return { status: "partial", reason: "unconfirmed_title" };
  }

  return { status: "complete" };
}

function buildQuestion(field) {
  if (typeof field?.question === "string" && field.question.trim()) {
    return field.question.trim();
  }

  if (typeof field?.label === "string" && field.label.trim()) {
    return `Please provide ${field.label.trim()}.`;
  }

  if (typeof field?.title === "string" && field.title.trim()) {
    return `Please provide ${field.title.trim()}.`;
  }

  const fieldName = getFieldName(field);
  if (fieldName) {
    return `Please provide ${fieldName}.`;
  }

  return "";
}

function getNextQuestion(fields, formState, meta = {}) {
  const byName = Object.fromEntries(fields.map((f) => [getFieldName(f), f]));

  const detection = byName["incident_detection_date"];
  if (detection && isFieldRelevant(detection, formState)) {
    const assessment = assessField(detection, formState, meta);

    if (assessment.status === "missing") {
      return "What date and time was the incident detected?";
    }

    if (
      assessment.status === "partial" &&
      assessment.reason === "relative_datetime"
    ) {
      return "You mentioned it was detected yesterday or at a relative time — what was the exact date and time of detection?";
    }
  }

  const occurrence = byName["incident_occurrence_date"];
  if (occurrence && isFieldRelevant(occurrence, formState)) {
    const assessment = assessField(occurrence, formState, meta);

    if (assessment.status === "missing") {
      return "What date and time did the incident occur?";
    }

    if (
      assessment.status === "partial" &&
      assessment.reason === "relative_datetime"
    ) {
      return "What was the exact date and time when the incident occurred?";
    }
  }

  const title = byName["incident_title"];
  if (title && isFieldRelevant(title, formState)) {
    const assessment = assessField(title, formState, meta);

    if (assessment.status === "missing") {
      return "What would you like to use as the incident title?";
    }

    if (
      assessment.status === "partial" &&
      assessment.reason === "unconfirmed_title"
    ) {
      return `I have a draft title of "${formState.incident_title}". Would you like to keep it, or change it?`;
    }
  }

  if (isEmpty(formState.affected_agencies_type)) {
    return "Was the incident affecting a single agency or multiple agencies?";
  }

  if (
    formState.affected_agencies_type === "Single Agency" &&
    isEmpty(formState.which_agency)
  ) {
    return "Which agency was affected?";
  }

  if (
    formState.affected_agencies_type === "Multiple Agencies" &&
    isEmpty(formState.which_agency)
  ) {
    return "Which agencies were affected?";
  }

  if (isEmpty(formState.select_incident_severity_classification)) {
    return "What is the incident severity classification?";
  }

  if (isEmpty(formState.incident_stakeholders)) {
    return "Who are the main stakeholders involved in this incident?";
  }

  const requiredMissingField = fields.find((field) => {
    const fieldName = getFieldName(field);
    if (!fieldName) return false;
    if (!isRequiredField(field)) return false;
    if (!isFieldRelevant(field, formState)) return false;
    return isEmpty(formState[fieldName]);
  });

  if (requiredMissingField) {
    return buildQuestion(requiredMissingField);
  }

  return "";
}

function sanitizeExtractionFields(updatedFields = {}) {
  const cleaned = { ...updatedFields };
  const meta = {};

  if (cleaned.incident_title && cleaned.incident_description) {
    const titleText = String(cleaned.incident_title).trim().toLowerCase();
    const descText = String(cleaned.incident_description).trim().toLowerCase();

    if (
      titleText === descText ||
      titleText.includes("yesterday") ||
      titleText.includes("today") ||
      titleText.includes("tomorrow")
    ) {
      delete cleaned.incident_title;
    }
  }

  return { cleanedFields: cleaned, meta };
}

/* ------------------------------- Routes ------------------------------ */

app.get("/", (_req, res) => {
  res.send("Incident chatbot backend running");
});

app.get("/form-schema", (_req, res) => {
  res.json(schema);
});

app.post("/extract-incident", async (req, res) => {
  try {
    const { message } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Missing or invalid message" });
    }

    const extraction = await runExtractionAgent(
      message,
      {},
      formFields,
      allowedFieldNames
    );

    const { cleanedFields, meta } = sanitizeExtractionFields(
      extraction?.updated_fields || {}
    );

    const cleanedExtraction = {
      ...extraction,
      updated_fields: cleanedFields,
      meta,
    };

    console.log("EXTRACTION ONLY:", JSON.stringify(cleanedExtraction, null, 2));

    return res.json(cleanedExtraction);
  } catch (error) {
    console.error("EXTRACTION ERROR:", error);
    return res.status(500).json({
      error: "Extraction failed",
      details: error.message,
    });
  }
});

app.post("/chat", async (req, res) => {
  try {
    const { message, form_state = {} } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Missing or invalid message" });
    }

    const formStateBefore = { ...form_state };

    const extractionResult = await runExtractionAgent(
      message,
      formStateBefore,
      formFields,
      allowedFieldNames
    );

    console.log("EXTRACTION RAW:", JSON.stringify(extractionResult, null, 2));

    const { cleanedFields, meta } = sanitizeExtractionFields(
      extractionResult?.updated_fields || {}
    );

    let formStateAfter = mergeFormState(formStateBefore, cleanedFields);
    formStateAfter = applySchemaRules(formStateAfter);

    console.log("FORM STATE BEFORE:", JSON.stringify(formStateBefore, null, 2));
    console.log("FORM STATE AFTER:", JSON.stringify(formStateAfter, null, 2));
    console.log(
      "FORM FIELDS SAMPLE:",
      JSON.stringify(formFields.slice(0, 5), null, 2)
    );

    const fallbackNextQuestion = getNextQuestion(
      formFields,
      formStateAfter,
      meta
    );

    const extractorNextQuestion =
      typeof extractionResult?.next_question === "string"
        ? extractionResult.next_question.trim()
        : "";

    const finalNextQuestion = extractorNextQuestion || fallbackNextQuestion;

    let criticResult = null;

    try {
      criticResult = await runCriticAgent(
        message,
        {
          ...extractionResult,
          updated_fields: cleanedFields,
          next_question: finalNextQuestion,
          meta,
        },
        formStateBefore,
        formStateAfter,
        formFields
      );

      console.log("CRITIC RAW:", JSON.stringify(criticResult, null, 2));
    } catch (criticError) {
      console.warn("CRITIC ERROR:", criticError.message);
    }

    return res.json({
      form_state: formStateAfter,
      updated_fields: cleanedFields,
      next_question: finalNextQuestion,
      critic: criticResult,
      meta,
    });
  } catch (error) {
    console.error("CHAT ERROR:", error);
    return res.status(500).json({
      error: "Chat failed",
      details: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});