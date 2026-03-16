import express from "express"
import dotenv from "dotenv"
import fs from "fs"
import axios from "axios"
import cors from "cors"

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

const OLLAMA_URL =
  process.env.OLLAMA_URL || "http://localhost:11434/api/generate"

const MODEL = process.env.OLLAMA_MODEL || "llama3"

const schema = JSON.parse(
  fs.readFileSync(new URL("../schemas/form-schema.json", import.meta.url))
)

let formState = {}

////////////////////////////////////////////////////////////
// HELPERS
////////////////////////////////////////////////////////////

function buildFieldList(fields) {
  return fields
    .map((f) => {
      let line = `- ${f.name}`

      if (f.type) line += ` (type: ${f.type})`
      if (f.options) line += ` options: [${f.options.join(", ")}]`
      if (f.required) line += ` REQUIRED`

      return line
    })
    .join("\n")
}

function extractJSON(text) {
  const match = text.match(/\{[\s\S]*\}/)

  if (!match) {
    throw new Error("No JSON found in model output")
  }

  return JSON.parse(match[0])
}

async function callModel(prompt) {
  const res = await axios.post(OLLAMA_URL, {
    model: MODEL,
    prompt,
    stream: false,
  })

  return res.data.response
}

function cleanFields(fields) {
  const cleaned = {}

  for (const [k, v] of Object.entries(fields || {})) {
    if (
      v !== undefined &&
      v !== null &&
      v !== "" &&
      v !== "undefined" &&
      v !== "null"
    ) {
      cleaned[k] = v
    }
  }

  return cleaned
}

function validateFieldsAgainstSchema(fields, schema) {
  const allowed = new Set(schema.fields.map((f) => f.name))

  const valid = {}

  for (const [k, v] of Object.entries(fields)) {
    if (allowed.has(k)) {
      valid[k] = v
    }
  }

  return valid
}

function getNextRequiredField(schema, formState) {
  return schema.fields.find(
    (f) =>
      f.required &&
      (formState[f.name] === undefined || formState[f.name] === "")
  )
}

////////////////////////////////////////////////////////////
// AGENT 1 — EXTRACTION
////////////////////////////////////////////////////////////

async function runExtractionAgent(userMessage, formState, schema) {
  const fieldList = buildFieldList(schema.fields)
  const fieldNames = schema.fields.map((f) => f.name)

  const prompt = `
You are an incident form extraction assistant.

Current form state:
${JSON.stringify(formState, null, 2)}

User message:
${userMessage}

Available fields:
${fieldList}

Valid field names:
${JSON.stringify(fieldNames)}

Task:
Extract values from the user message.

Return ONLY JSON:

{
  "updated_fields": {},
  "next_question": ""
}

Rules:
- Use ONLY valid field names
- Do NOT invent new field names
- Do NOT guess
- If nothing found return {}
- Do not output undefined/null
- No explanations
`

  const raw = await callModel(prompt)

  console.log("EXTRACTION RAW:", raw)

  return extractJSON(raw)
}

////////////////////////////////////////////////////////////
// AGENT 2 — CRITIC
////////////////////////////////////////////////////////////

async function runCriticAgent(userMessage, extraction, schema) {
  const fieldList = buildFieldList(schema.fields)
  const fieldNames = schema.fields.map((f) => f.name)

  const prompt = `
You are a strict JSON reviewer.

User message:
${userMessage}

Extractor output:
${JSON.stringify(extraction, null, 2)}

Valid field names:
${JSON.stringify(fieldNames)}

Evaluate extraction quality.

Return ONLY JSON:

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

Rules:
- Scores 0–10
- Do NOT require all fields filled
- Penalize invented fields heavily
- No explanations
`

  const raw = await callModel(prompt)

  console.log("CRITIC RAW:", raw)

  return extractJSON(raw)
}

////////////////////////////////////////////////////////////
// AGENT 3 — PLANNER
////////////////////////////////////////////////////////////

async function runPlannerAgent(formState, userMessage, schema) {
  const fieldList = buildFieldList(schema.fields)

  const prompt = `
You are a planning agent for an incident chatbot.

Current form state:
${JSON.stringify(formState, null, 2)}

User message:
${userMessage}

Fields:
${fieldList}

Decide the best next question.

Return JSON:

{
  "next_field": "",
  "next_question": ""
}

Rules:
- Prefer REQUIRED fields
- Avoid already filled fields
- Ask ONE short question
`

  const raw = await callModel(prompt)

  console.log("PLANNER RAW:", raw)

  return extractJSON(raw)
}

////////////////////////////////////////////////////////////
// ROUTES
////////////////////////////////////////////////////////////

app.get("/", (req, res) => {
  res.send("Incident chatbot backend running")
})

app.get("/state", (req, res) => {
  res.json({ form_state: formState })
})

app.post("/reset", (req, res) => {
  formState = {}
  res.json({ message: "Conversation reset", form_state: formState })
})

////////////////////////////////////////////////////////////
// CHAT
////////////////////////////////////////////////////////////

app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message

    if (!userMessage) {
      return res.status(400).json({ error: "message is required" })
    }

    console.log("\n========================")
    console.log("USER:", userMessage)

    //////////////////////////////////////
    // EXTRACTION
    //////////////////////////////////////

    const extraction = await runExtractionAgent(
      userMessage,
      formState,
      schema
    )

    let cleaned = cleanFields(extraction.updated_fields)

    cleaned = validateFieldsAgainstSchema(cleaned, schema)

    //////////////////////////////////////
    // CRITIC
    //////////////////////////////////////

    const critic = await runCriticAgent(
      userMessage,
      extraction,
      schema
    )

    console.log("CRITIC SCORES:", critic.scores)

    if (critic.scores.overall >= 6) {
      Object.assign(formState, cleaned)
    }

    //////////////////////////////////////
    // PLANNER
    //////////////////////////////////////

    let nextQuestion

    try {
      const planner = await runPlannerAgent(
        formState,
        userMessage,
        schema
      )

      nextQuestion = planner.next_question
    } catch {
      const nextField = getNextRequiredField(schema, formState)

      nextQuestion = nextField
        ? `Please provide ${nextField.name}`
        : "Any other details?"
    }

    //////////////////////////////////////

    console.log("FINAL STATE:", formState)

    res.json({
      form_state: formState,
      next_question: nextQuestion,
      agent_review: critic.scores,
    })
  } catch (error) {
    console.error("CHAT ERROR:", error)

    res.status(500).json({
      error: "Chat processing failed",
    })
  }
})

////////////////////////////////////////////////////////////

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})