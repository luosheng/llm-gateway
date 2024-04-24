import type { AIProvider } from './types'

import anyscale from './anyscale'
import baichuan from './baichuan'
import dashscope from './dashscope'
import groq from './groq'
import minimax from './minimax'
import moonshot from './moonshot'
import openai from './openai'
import perplexity from './perplexity'
import yi from './yi'

const providers: Record<string, AIProvider> = {
  openai,
  groq,
  moonshot,
  minimax,
  yi,
  baichuan,
  dashscope,
  perplexity,
  anyscale,
}

export default providers
