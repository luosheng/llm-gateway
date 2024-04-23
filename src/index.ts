import { Hono } from 'hono'
import { stream } from 'hono/streaming'
import providers from './providers'
import type { GeneralResponse } from './providers/types'

const app = new Hono()

async function makeReadableStream(
  url: string,
  request: RequestInit,
  stream: boolean,
  responseTransformer?: <T>(response: T) => GeneralResponse,
): Promise<ReadableStream> {
  console.log('Making stream', stream, responseTransformer)
  const decoder = new TextDecoder('utf-8')
  const encoder = new TextEncoder()
  let result = ''
  return fetch(url, request).then((response) => {
    const reader = response.body?.getReader()
    return new ReadableStream({
      start(controller) {
        return pump()
        async function pump(): Promise<void> {
          if (!reader) {
            return
          }
          const { done, value } = await reader.read()
          if (done) {
            if (stream && responseTransformer !== undefined) {
              const doneData = 'data: [DONE]\n\n'
              controller.enqueue(encoder.encode(doneData))
            }
            controller.close()
            return
          }

          if (responseTransformer === undefined) {
            controller.enqueue(value)
            return pump()
          }

          const decodedValue = decoder.decode(value)
          if (!stream) {
            try {
              const transformedValue = responseTransformer(
                JSON.parse(decodedValue),
              )
              controller.enqueue(
                encoder.encode(JSON.stringify(transformedValue)),
              )
            } catch (e) {
              controller.enqueue(value)
            }
            return pump()
          }

          result += decodedValue
          const index = result.indexOf('\n\n')
          if (index === -1) {
            return pump()
          }
          const trunk = result.slice(0, index)
          const lines = trunk.split('\n')
          const lastLine = lines[lines.length - 1]
          const data = lastLine.slice('data:'.length).trim()
          try {
            const transformedValue = responseTransformer(JSON.parse(data))
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(transformedValue)}\n\n`),
            )
          } catch (e) {}
          result = result.slice(index + 2)
          return pump()
        }
      },
    })
  })
}

app.get('/', (c) => {
  return c.text('Unified LLM Gateway')
})

app.post('/v1/chat/completions', async (c) => {
  const _body = await c.req.json()
  const [model, serviceInBody, authorizationInBody] = _body.model.split(':')
  const service = serviceInBody ?? c.req.query('service') ?? 'openai'
  const provider = providers[service]
  const authorization = authorizationInBody
    ? `Bearer ${authorizationInBody}`
    : c.req.header('Authorization')
  if (!authorization || !provider) {
    return c.notFound()
  }
  _body.model = model

  const _headers = {
    authorization,
    'Content-Type': 'application/json',
  }
  const headers = provider.transformers?.header?.(_headers, _body) ?? _headers
  const body = provider.transformers?.body?.(_body) ?? _body

  const request: RequestInit = {
    headers,
    method: c.req.method,
    body: JSON.stringify(body),
  }

  const requestStream = await makeReadableStream(
    `${provider.baseUrl}${provider.chatCompletionPath ?? '/chat/completions'}`,
    request,
    Boolean(_body.stream),
    provider.transformers?.response?.bind(
      null,
      model,
      _body.stream ? 'chat.completion.chunk' : 'chat.completion',
    ),
  )

  return stream(c, async (stream) => {
    stream.onAbort(() => {
      console.log('Aborted!')
    })
    await stream.pipe(requestStream)
  })
})

app.get('/v1/models', async (c) => {
  return c.json({
    object: 'list',
    data: [],
  })
})

export default app
