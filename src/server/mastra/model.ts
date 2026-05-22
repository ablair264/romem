import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function getOrganizerModel(overrides?: { baseURL?: string | null; model?: string | null; apiKey?: string | null }) {
  const baseURL = overrides?.baseURL ?? process.env.OLLAMA_BASE_URL;
  if (!baseURL) {
    return null;
  }

  const provider = createOpenAICompatible({
    name: "ollama-local",
    baseURL: `${baseURL.replace(/\/$/, "")}/v1`,
    apiKey: overrides?.apiKey ?? process.env.OLLAMA_API_KEY ?? "ollama",
  });

  return provider.chatModel(overrides?.model ?? process.env.OLLAMA_MODEL ?? "llama3.1:8b");
}

