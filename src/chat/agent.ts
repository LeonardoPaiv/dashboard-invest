import {
  createChatCompletion,
  type AssistantMessage,
  type ChatCompletionParams,
  type ChatMessage,
} from '../lib/openrouter/client'
import { SYSTEM_PROMPT } from './systemPrompt'
import { TOOL_DEFINITIONS, executeTool, type Proposal, type ToolContext } from './tools'

export interface AgentTurnInput {
  apiKey: string
  model: string
  history: ChatMessage[]
  userContent: string
  toolContext: ToolContext
  complete?: (params: ChatCompletionParams) => Promise<AssistantMessage>
  maxSteps?: number
}

export interface AgentTurnResult {
  history: ChatMessage[]
  reply: string
  proposals: Proposal[]
}

export async function runAgentTurn({
  apiKey,
  model,
  history,
  userContent,
  toolContext,
  complete = createChatCompletion,
  maxSteps = 6,
}: AgentTurnInput): Promise<AgentTurnResult> {
  const messages: ChatMessage[] = [...history, { role: 'user', content: userContent }]
  const proposals: Proposal[] = []

  for (let step = 0; step < maxSteps; step++) {
    const assistant = await complete({
      apiKey,
      model,
      tools: TOOL_DEFINITIONS,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
    })
    messages.push(assistant)

    if (!assistant.tool_calls || assistant.tool_calls.length === 0) {
      const reply =
        assistant.content?.trim() ||
        (proposals.length > 0 ? 'Confira a prévia abaixo antes de salvar.' : 'O modelo não respondeu. Tente de novo.')
      return { history: messages, reply, proposals }
    }

    for (const toolCall of assistant.tool_calls) {
      const result = executeTool(toolCall.function.name, toolCall.function.arguments ?? '', toolContext)
      if (result.proposal) proposals.push(result.proposal)
      messages.push({ role: 'tool', tool_call_id: toolCall.id, content: result.content })
    }
  }

  return { history: messages, reply: 'Parei depois de várias etapas sem concluir. Tente reformular o pedido.', proposals }
}
