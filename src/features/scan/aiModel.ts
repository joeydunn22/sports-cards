/** Which Claude model reads scanned cards. Kept per device; Sonnet is the default. */
export const AI_MODELS = [
  { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5', note: 'Recommended: about 1¢ per card' },
  { id: 'claude-opus-5-5', label: 'Opus 5.5', note: 'Most accurate: about 2¢ per card' },
  { id: 'claude-haiku-4-5', label: 'Haiku 4.5', note: 'Cheapest: under 1¢ per card' },
] as const

export type AiModel = (typeof AI_MODELS)[number]['id']

export const modelLabel = (id: string) => AI_MODELS.find((m) => m.id === id)?.label ?? id

const KEY = 'sports-cards:ai-model'

export function getAiModel(): AiModel {
  try {
    const stored = localStorage.getItem(KEY)
    return AI_MODELS.find((m) => m.id === stored)?.id ?? AI_MODELS[0].id
  } catch {
    return AI_MODELS[0].id
  }
}

export function setAiModel(model: AiModel) {
  try {
    localStorage.setItem(KEY, model)
  } catch {
    // Not critical: falls back to the default model.
  }
}
