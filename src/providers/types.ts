export interface AIProvider {
  baseUrl: string
  pathBuilder?: {
    completion: (model: string, accessKey: string) => string
  }
  transformers?: {
    header?: (
      headers: Record<string, string>,
      body: GeneralRequest,
    ) => HeadersInit
    body?: <T>(body: GeneralRequest) => T
    response?: <T>(model: string, mode: ChatMode, data: T) => GeneralResponse
  }
}

export type ChatMode = 'chat.completion' | 'chat.completion.chunk'

export interface GeneralRequest {
  model: string
  messages: Array<{
    role: string
    content: string
    tool_call_id?: string
    name?: string
  }>
  stream?: boolean
  max_tokens?: number
  top_p?: number
}

export interface Message {
  role: string
  content: string
}

export interface GeneralResponse {
  id: string
  object: string
  created?: number
  model: string
  usage?: {
    completion_tokens: number
    prompt_tokens: number
    total_tokens: number
  }
  choices: Array<{
    index: number
    message?: Message
    delta?: Message
  }>
  finish_reason?: string
}
