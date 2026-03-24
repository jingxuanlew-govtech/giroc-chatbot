export async function callOllama(messages) {
  const model = process.env.OLLAMA_MODEL || "llama3";

  const response = await fetch("http://localhost:11434/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      options: {
        temperature: 0,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ollama error: ${response.status} ${text}`);
  }

  const data = await response.json();
  const content = data?.message?.content;

  if (!content) {
    throw new Error("Ollama response missing message.content");
  }

  return content;
}