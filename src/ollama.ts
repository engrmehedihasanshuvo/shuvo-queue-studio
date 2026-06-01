export interface OllamaModelInfo {
  name: string;
  modified_at?: string;
  size?: number;
}

export interface OllamaTagsResponse {
  models?: Array<{
    name: string;
    modified_at?: string;
    size?: number;
  }>;
}

export interface ChatResponseMessage {
  role: string;
  content: string;
}

export async function listOllamaModels(baseUrl: string): Promise<OllamaModelInfo[]> {
  const response = await fetch(new URL("/api/tags", baseUrl));
  if (!response.ok) {
    throw new Error(`Failed to list Ollama models: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as OllamaTagsResponse;
  return (data.models ?? []).map((model) => ({
    name: model.name,
    modified_at: model.modified_at,
    size: model.size,
  }));
}

export async function chatWithOllama(options: {
  baseUrl: string;
  model: string;
  prompt: string;
  systemPrompt?: string;
}): Promise<string> {
  const response = await fetch(new URL("/api/chat", options.baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.model,
      stream: false,
      messages: [
        ...(options.systemPrompt
          ? [{ role: "system", content: options.systemPrompt }]
          : []),
        { role: "user", content: options.prompt },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama chat failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as {
    message?: ChatResponseMessage;
    response?: string;
  };

  return data.message?.content ?? data.response ?? "";
}
