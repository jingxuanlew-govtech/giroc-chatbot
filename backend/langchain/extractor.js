import { ChatOllama } from "@langchain/ollama";

export const model = new ChatOllama({
  model: process.env.OLLAMA_MODEL || "llama3",
  baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
  temperature: 0,
});