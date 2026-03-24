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

    return res.json(extraction);
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

    const formStateAfter = mergeFormState(
      formStateBefore,
      extractionResult.updated_fields
    );

    const criticResult = await runCriticAgent(
      message,
      extractionResult,
      formStateBefore,
      formStateAfter,
      formFields
    );

    return res.json({
      form_state: formStateAfter,
      updated_fields: extractionResult.updated_fields,
      next_question: extractionResult.next_question,
      critic: criticResult,
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