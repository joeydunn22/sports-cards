import { describe, expect, it } from 'vitest'
import { BACKGROUND, contrast, MLB_TEAMS, teamColors } from './teamColors'

describe('teamColors', () => {
  it('matches a club by full name, nickname or abbreviation', () => {
    const reds = teamColors('Cincinnati Reds', { sport: 'Baseball' })
    expect(reds?.primary).toBe('#C6011F')
    expect(teamColors('Reds', { sport: 'Baseball' })).toEqual(reds)
    expect(teamColors('CIN', { sport: 'baseball' })).toEqual(reds)
  })

  it('keeps an old card on its old club', () => {
    expect(teamColors('Expos', { year: '1990', sport: 'Baseball' })?.primary).toBe('#003087')
    expect(teamColors('Marlins', { year: '2005', sport: 'Baseball' })?.primary).toBe('#00A3AD')
    expect(teamColors('Marlins', { year: '2020', sport: 'Baseball' })?.primary).toBe('#00A3E0')
  })

  it('treats a blank sport as baseball when the team is an MLB club', () => {
    expect(teamColors('Yankees')?.primary).toBe('#0C2340')
  })

  it('gives no colour for other sports, several teams or unknown teams', () => {
    expect(teamColors('Cardinals', { sport: 'Football' })).toBeNull()
    expect(teamColors('Reds / Cubs', { sport: 'Baseball' })).toBeNull()
    expect(teamColors('Multiple Teams', { sport: 'Baseball' })).toBeNull()
    expect(teamColors('Ohio State Buckeyes', { sport: 'Baseball' })).toBeNull()
    expect(teamColors('', { sport: 'Baseball' })).toBeNull()
    expect(teamColors(null)).toBeNull()
  })

  it('always gives a text colour that reads on the background', () => {
    for (const team of MLB_TEAMS) {
      const colors = teamColors(team, { sport: 'Baseball' })
      expect(colors, team).not.toBeNull()
      expect(contrast(colors!.onDark, BACKGROUND), team).toBeGreaterThanOrEqual(3)
    }
  })

  it('reaches for the second colour or a lighter shade when the first is too dark', () => {
    expect(teamColors('Padres', { sport: 'Baseball' })?.onDark).toBe('#FFC425')
    const tigers = teamColors('Tigers', { sport: 'Baseball' })!
    expect(tigers.onDark).toBe('#FA4616')
  })
})
