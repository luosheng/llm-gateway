import baichuan from './baichuan'
import groq from './groq'
import minimax from './minimax'
import moonshot from './moonshot'
import openai from './openai'
import qwen from './qwen'
import type { AIProvider } from './types'
import yi from './yi'

const providers: Record<string, AIProvider> = {
  openai,
  groq,
  moonshot,
  minimax,
  yi,
  baichuan,
  qwen,
}

export default providers
