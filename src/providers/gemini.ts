import type {
  AIProvider,
  ChatMode,
  GeneralRequest,
  GeneralResponse,
} from './types'

interface GeminiContent {
  role?: 'user' | 'model'
  parts: Array<{
    text: string
  }>
}

interface GeminiRequestBody {
  contents: GeminiContent[]
}

interface GeminiResponseBody {
  candidates: Array<{
    content: GeminiContent
    finisheReason?: string
    index: number
  }>
}

const provider: AIProvider = {
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  streamDelimiter: '\r\n\r\n',
  pathBuilder: {
    chat: (model: string, accessKey: string, stream?: boolean) =>
      `/models/${model}:${
        stream ? 'streamGenerateContent' : 'generateContent'
      }?key=${accessKey}&alt=sse`,
  },
  transformers: {
    body: <T>(body: GeneralRequest): T => {
      const { messages } = body
      return <T>{
        contents: messages
          .filter((m) => m.role !== 'system')
          .map((message) => ({
            role: message.role === 'user' ? 'user' : 'model',
            parts: [{ text: message.content }],
          })),
      }
    },
    header: (headers, body) => {
      // biome-ignore lint/performance/noDelete: <explanation>
      delete headers.authorization
      return headers
    },
    response: <T>(model: string, mode: ChatMode, data: T): GeneralResponse => {
      const response = data as GeminiResponseBody
      return {
        id: model,
        object: mode,
        model: model,
        choices: response.candidates.map((candidate) => ({
          index: candidate.index,
          message: {
            role: candidate.content.role === 'user' ? 'user' : 'model',
            content: candidate.content.parts.map((part) => part.text).join(''),
          },
        })),
      }
    },
  },
}

export default provider
