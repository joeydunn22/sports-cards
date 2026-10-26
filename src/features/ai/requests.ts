import { modelLabel } from '../scan/aiModel'
import type { Estimate } from './costEstimate'
import type { AiRequest } from './useAiApproval'

const cardsText = (n: number) => `${n} ${n === 1 ? 'card' : 'cards'}`

export function readRequest(cards: number, model: string, estimate: Estimate, autoLookup: boolean): AiRequest {
  return {
    action: `Read ${cardsText(cards)} with ${modelLabel(model)}.`,
    estimate,
    note: autoLookup
      ? 'Cards the AI is unsure about also get one checklist search (included in the “up to” figure). Results usually arrive within minutes.'
      : 'Results usually arrive within minutes. Automatic checklist searches are off.',
  }
}

export function parallelsRequest(sets: string[], model: string, estimate: Estimate, now: boolean): AiRequest {
  return {
    action:
      sets.length === 1
        ? `Look up the parallels of ${sets[0]} with ${modelLabel(model)} (up to 3 web searches).`
        : `Look up the parallels of ${sets.length} sets with ${modelLabel(model)} (up to 3 web searches each).`,
    estimate,
    note: now
      ? 'Takes up to a minute. Each set is looked up once and kept, so every later card from it is free.'
      : 'Results usually arrive within minutes. Each set is looked up once and kept, so every later card from it is free.',
  }
}

export function lookupRequest(cards: number, model: string, estimate: Estimate): AiRequest {
  return {
    action: `Check ${cardsText(cards)} against the set’s checklist with ${modelLabel(model)} (up to 3 web searches each).`,
    estimate,
  }
}
