import { Hono } from 'hono'
import { stream } from 'hono/streaming'
import providers from './providers'
import type { GeneralResponse } from './providers/types'

const app = new Hono()

const transformTrunk = (
  trunk: string,
  transformer: <T>(response: T) => GeneralResponse,
): string => {
  const lines = trunk.split('\n')
  const lastLine = lines[lines.length - 1]
  const data = lastLine.slice('data:'.length).trim()
  const transformedValue = transformer(JSON.parse(data))
  return `data: ${JSON.stringify(transformedValue)}\n\n`
}

async function makeReadableStream(
  url: string,
  request: RequestInit,
  stream: boolean,
  responseTransformer?: <T>(response: T) => GeneralResponse,
): Promise<ReadableStream> {
  console.log('Making stream', url, request, responseTransformer)
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
              const trunks = result.trim().split(/\n\n/)
              for (const trunk of trunks) {
                controller.enqueue(
                  encoder.encode(
                    transformTrunk(trunk.trim(), responseTransformer),
                  ),
                )
              }
              controller.enqueue(encoder.encode('data: [DONE]\n\n'))
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
              console.error(e)
              controller.enqueue(value)
            }
            return pump()
          }

          result += decodedValue
          const index = result.indexOf('\n\n')
          console.log(result, index)
          if (index === -1) {
            return pump()
          }
          const trunk = result.slice(0, index)
          try {
            controller.enqueue(
              encoder.encode(transformTrunk(trunk, responseTransformer)),
            )
            result = result.slice(index + 2)
          } catch (e) {
            console.error(e)
          }
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
  const [model, serviceInBody, accessKey] = _body.model.split(':')
  const service = serviceInBody ?? c.req.query('service') ?? 'openai'
  const provider = providers[service]
  const authorization = accessKey
    ? `Bearer ${accessKey}`
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
    `${provider.baseUrl}${
      provider.pathBuilder?.chat(
        model,
        authorization.slice('Bearer '.length),
        Boolean(_body.stream),
      ) ?? '/chat/completions'
    }`,
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
