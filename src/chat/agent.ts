import {
  createChatCompletion,
  type AssistantReply,
  type ChatCompletionParams,
  type ChatMessage,
  type Citation,
} from '../lib/openrouter/client'
import { buildSystemPrompt } from './systemPrompt'
import { TOOL_DEFINITIONS, executeTool, type Proposal, type ToolContext } from './tools'

export interface AgentTurnInput {
  apiKey: string
  model: string
  history: ChatMessage[]
  userContent: string
  toolContext: ToolContext | (() => ToolContext)
  webSearch?: boolean
  complete?: (params: ChatCompletionParams) => Promise<AssistantReply>
  maxSteps?: number
}

export interface AgentTurnResult {
  history: ChatMessage[]
  reply: string
  proposals: Proposal[]
  citations: Citation[]
}

export async function runAgentTurn({
  apiKey,
  model,
  history,
  userContent,
  toolContext,
  webSearch = false,
  complete = createChatCompletion,
  maxSteps = 6,
}: AgentTurnInput): Promise<AgentTurnResult> {
  const messages: ChatMessage[] = [...history, { role: 'user', content: userContent }]
  const proposals: Proposal[] = []
  const citations: Citation[] = []
  const resolveContext = (): ToolContext => (typeof toolContext === 'function' ? toolContext() : toolContext)

  for (let step = 0; step < maxSteps; step++) {
    const { citations: found = [], ...assistant } = await complete({
      apiKey,
      model,
      tools: TOOL_DEFINITIONS,
      webSearch,
      messages: [{ role: 'system', content: buildSystemPrompt(resolveContext().currentPage, { webSearch }) }, ...messages],
    })
    messages.push(assistant)
    for (const citation of found) {
      if (!citations.some((c) => c.url === citation.url)) citations.push(citation)
    }

    if (!assistant.tool_calls || assistant.tool_calls.length === 0) {
      const reply =
        assistant.content?.trim() ||
        (proposals.length > 0 ? 'Confira a prévia abaixo antes de salvar.' : 'O modelo não respondeu. Tente de novo.')
      return { history: messages, reply, proposals, citations }
    }

    for (const toolCall of assistant.tool_calls) {
      const id = toolCall?.id
      const name = toolCall?.function?.name

      if (typeof id !== 'string' || id.trim() === '') {
        continue
      }

      let result
      if (typeof name !== 'string') {
        result = { content: JSON.stringify({ ok: false, errors: ['Chamada de ferramenta malformada.'] }) }
      } else {
        result = executeTool(name, toolCall.function.arguments ?? '', resolveContext())
      }

      if (result.proposal) proposals.push(result.proposal)
      messages.push({ role: 'tool', tool_call_id: id, content: result.content })
    }
  }

  return { history: messages, reply: 'Parei depois de várias etapas sem concluir. Tente reformular o pedido.', proposals, citations }
}
