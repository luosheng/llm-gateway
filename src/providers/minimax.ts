import type { AIProvider } from './types'

const provider: AIProvider = {
  baseUrl: 'https://api.minimax.chat/v1',
  chatCompletionPath: '/text/chatcompletion_v2',
}

export default provider
