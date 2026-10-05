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

export function lookupRequest(cards: number, model: string, estimate: Estimate): AiRequest {
  return {
    action: `Check ${cardsText(cards)} against the set’s checklist with ${modelLabel(model)} (up to 3 web searches each).`,
    estimate,
  }
}

export function identifyRequest(model: string, estimate: Estimate): AiRequest {
  return {
    action: `Look up this card’s details with ${modelLabel(model)} (up to 3 web searches).`,
    estimate,
    note: 'Runs right away at full price, so it costs more per card than scanning. Takes up to a minute.',
  }
}
