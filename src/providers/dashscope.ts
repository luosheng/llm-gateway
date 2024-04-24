import type {
  AIProvider,
  ChatMode,
  GeneralRequest,
  GeneralResponse,
} from './types'

interface QwenRequestBody {
  model: string
  input: {
    messages: Array<{
      role: string
      content: string
      tool_call_id?: string
      name?: string
    }>
  }
  parameters: {
    stream?: boolean
    max_tokens?: number
    top_p?: number
    incremental_output?: boolean
  }
}
interface QwenResponse {
  output: {
    finish_reason: string
    text: string
  }
  usage: {
    total_tokens: number
    output_tokens: number
    input_tokens: number
  }
  request_id: string
}

const provider: AIProvider = {
  baseUrl: 'https://dashscope.aliyuncs.com/api/v1',
  pathBuilder: {
    chat: () => '/services/aigc/text-generation/generation',
  },
  transformers: {
    header: (header: Record<string, string>, body) => {
      if (body.stream === true) {
        header['X-DashScope-SSE'] = 'enable'
      }
      return header
    },
    body: <T>(body: GeneralRequest): T => {
      const { model, messages, stream, max_tokens, ...rest } = body
      return <T>{
        model,
        input: {
          messages,
        },
        parameters: {
          ...rest,
          top_p: 0.8,
          incremental_output: stream,
        },
      }
    },
    response: <T>(model: string, mode: ChatMode, data: T): GeneralResponse => {
      const { output, usage, request_id } = data as QwenResponse
      const message = {
        role: 'assistant',
        content: output.text,
      }
      return {
        id: request_id,
        object: mode,
        model: model,
        created: new Date().getTime(),
        usage:
          output.finish_reason === 'stop'
            ? {
                completion_tokens: usage.output_tokens,
                prompt_tokens: usage.input_tokens,
                total_tokens: usage.total_tokens,
              }
            : undefined,
        choices: [
          {
            index: 0,
            message: mode === 'chat.completion' ? message : undefined,
            delta: mode === 'chat.completion.chunk' ? message : undefined,
          },
        ],
        finish_reason:
          output.finish_reason === 'null' ? undefined : output.finish_reason,
      }
    },
  },
}

export default provider
