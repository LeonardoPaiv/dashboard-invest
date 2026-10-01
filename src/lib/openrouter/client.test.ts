import { describe, expect, it, vi } from 'vitest'
import { OpenRouterError, createChatCompletion, validateKey } from './client'

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('validateKey', () => {
  it('calls the key endpoint with the bearer token and reports a valid key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { data: { label: 'k' } }))
    await expect(validateKey('sk-or-abc', fetchMock)).resolves.toBe('valid')
    expect(fetchMock).toHaveBeenCalledWith('https://openrouter.ai/api/v1/key', {
      headers: { Authorization: 'Bearer sk-or-abc' },
    })
  })

  it('reports an invalid key on 401', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, { error: { message: 'No auth' } }))
    await expect(validateKey('bad', fetchMock)).resolves.toBe('invalid')
  })

  it('throws on other HTTP errors so callers do not treat an outage as an invalid key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(503, {}))
    await expect(validateKey('k', fetchMock)).rejects.toMatchObject({ name: 'OpenRouterError', status: 503 })
  })
})

describe('createChatCompletion', () => {
  const params = {
    apiKey: 'sk-or-abc',
    model: 'stealth/space-bunny-alpha',
    messages: [{ role: 'user' as const, content: 'oi' }],
    tools: [],
  }

  it('posts model, messages and tools and returns the assistant message', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { choices: [{ message: { role: 'assistant', content: 'olá', tool_calls: [] } }] }),
    )
    await expect(createChatCompletion(params, fetchMock)).resolves.toEqual({ role: 'assistant', content: 'olá' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer sk-or-abc')
    expect(JSON.parse(init.body)).toEqual({ model: params.model, messages: params.messages, tools: [] })
  })

  it('keeps tool calls in the returned message', async () => {
    const toolCalls = [{ id: 'call_1', type: 'function', function: { name: 'get_portfolio', arguments: '{}' } }]
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { choices: [{ message: { role: 'assistant', content: null, tool_calls: toolCalls } }] }),
    )
    await expect(createChatCompletion(params, fetchMock)).resolves.toEqual({
      role: 'assistant',
      content: null,
      tool_calls: toolCalls,
    })
  })

  it('throws OpenRouterError with the HTTP status and the API message', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, { error: { message: 'Invalid credentials' } }))
    const error = await createChatCompletion(params, fetchMock).catch((e) => e)
    expect(error).toBeInstanceOf(OpenRouterError)
    expect(error.status).toBe(401)
    expect(error.message).toBe('Invalid credentials')
  })

  it('throws when a 200 response carries an error instead of choices', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { error: { message: 'Provider returned error' } }))
    await expect(createChatCompletion(params, fetchMock)).rejects.toMatchObject({
      status: 502,
      message: 'Provider returned error',
    })
  })
})
