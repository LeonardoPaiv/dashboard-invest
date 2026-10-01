export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

export interface ToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export type AssistantMessage = { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }

export type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | AssistantMessage
  | { role: 'tool'; tool_call_id: string; content: string }

export interface ToolDefinition {
  type: 'function'
  function: { name: string; description: string; parameters: Record<string, unknown> }
}

export class OpenRouterError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'OpenRouterError'
    this.status = status
  }
}

export async function validateKey(apiKey: string, fetchImpl: typeof fetch = fetch): Promise<'valid' | 'invalid'> {
  const response = await fetchImpl(`${OPENROUTER_BASE_URL}/key`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (response.ok) return 'valid'
  if (response.status === 401) return 'invalid'
  throw new OpenRouterError(`Falha ao validar a chave (HTTP ${response.status}).`, response.status)
}

export interface ChatCompletionParams {
  apiKey: string
  model: string
  messages: ChatMessage[]
  tools: ToolDefinition[]
}

export async function createChatCompletion(
  { apiKey, model, messages, tools }: ChatCompletionParams,
  fetchImpl: typeof fetch = fetch,
): Promise<AssistantMessage> {
  const response = await fetchImpl(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-Title': 'Dashboard Invest',
    },
    body: JSON.stringify({ model, messages, tools }),
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new OpenRouterError(body?.error?.message || `HTTP ${response.status}`, response.status)
  }
  const message = body?.choices?.[0]?.message
  if (!message) throw new OpenRouterError(body?.error?.message || 'Resposta vazia do modelo.', 502)
  return {
    role: 'assistant',
    content: message.content ?? null,
    ...(Array.isArray(message.tool_calls) && message.tool_calls.length > 0 ? { tool_calls: message.tool_calls } : {}),
  }
}
