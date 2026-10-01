import { describe, expect, it } from 'vitest'
import { MAX_CONVERSATIONS, conversationTitle, forStorage, relevantConversation, saveConversation, type Conversation } from './conversations'

const conv = (id: string, page: Conversation['page'], updatedAt: string, extra: Partial<Conversation> = {}): Conversation => ({
  id, title: id, page, createdAt: updatedAt, updatedAt, messages: [], history: [], ...extra,
})

describe('conversations', () => {
  it('titles a conversation after its first user message, on one line, capped at 48 chars', () => {
    expect(conversationTitle([])).toBe('Nova conversa')
    expect(conversationTitle([{ id: 'a', role: 'assistant', text: 'Olá' }])).toBe('Nova conversa')
    expect(conversationTitle([{ id: 'u', role: 'user', text: '  Mude o prazo\npara 300 meses  ' }])).toBe('Mude o prazo para 300 meses')
    const long = conversationTitle([{ id: 'u', role: 'user', text: 'x'.repeat(80) }])
    expect(long).toHaveLength(48)
    expect(long.endsWith('…')).toBe(true)
  })
  it('inserts or replaces by id, newest first, and caps the list', () => {
    const list = [conv('a', 'dashboard', '2026-01-01'), conv('b', 'history', '2026-01-02')]
    expect(saveConversation(list, conv('a', 'dashboard', '2026-01-03')).map((c) => c.id)).toEqual(['a', 'b'])
    expect(saveConversation(list, conv('c', 'dashboard', '2025-12-31')).map((c) => c.id)).toEqual(['b', 'a', 'c'])
    let many: Conversation[] = []
    for (let i = 0; i < MAX_CONVERSATIONS + 5; i++) many = saveConversation(many, conv(`c${i}`, 'dashboard', `2026-01-01T00:00:${String(i).padStart(2, '0')}`))
    expect(many).toHaveLength(MAX_CONVERSATIONS)
    expect(many[0].id).toBe(`c${MAX_CONVERSATIONS + 4}`)
  })
  it('picks the most recent conversation of a page', () => {
    const list = [conv('a', 'financiamento', '2026-01-01'), conv('b', 'financiamento', '2026-01-05'), conv('c', 'history', '2026-01-09')]
    expect(relevantConversation(list, 'financiamento')?.id).toBe('b')
    expect(relevantConversation(list, 'strategy')).toBeUndefined()
  })
  it('trims big attachment text before writing to disk, without touching the original', () => {
    const big = 'linha;de;planilha\n'.repeat(2000)
    const original = conv('a', 'dashboard', '2026-01-01', {
      history: [{ role: 'user', content: big }, { role: 'assistant', content: 'ok' }, { role: 'tool', tool_call_id: 't', content: big }],
    })
    const [stored] = forStorage([original])
    expect((stored.history[0].content as string).length).toBeLessThan(4100)
    expect(stored.history[0].content).toContain('[conteúdo longo omitido ao salvar a conversa]')
    expect(stored.history[1].content).toBe('ok')
    expect((stored.history[2].content as string).length).toBeLessThan(4100)
    expect(original.history[0].content).toBe(big)
  })
})
