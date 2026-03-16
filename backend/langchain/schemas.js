import * as z from "zod";

export const ExtractionSchema = z.object({
  updated_fields: z.record(z.string(), z.any()),
  next_question: z.string(),
});

export const CriticSchema = z.object({
  passed: z.boolean(),
  scores: z.object({
    field_accuracy: z.number(),
    no_guessing: z.number(),
    schema_compliance: z.number(),
    next_question_quality: z.number(),
    overall: z.number(),
  }),
  issues: z.array(z.string()),
});

export const PlannerSchema = z.object({
  next_field: z.string(),
  next_question: z.string(),
});