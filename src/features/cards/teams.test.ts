import { describe, expect, it } from 'vitest'
import { MULTIPLE_TEAMS, standardTeam, teamFixes } from './teams'

const baseball = (team: string, year = '2023', known: string[] = []) =>
  standardTeam(team, { year, sport: 'Baseball', known })

describe('standardTeam', () => {
  it('turns nicknames, cities and abbreviations into full names', () => {
    expect(baseball('Reds')).toBe('Cincinnati Reds')
    expect(baseball('reds')).toBe('Cincinnati Reds')
    expect(baseball('CIN')).toBe('Cincinnati Reds')
    expect(baseball('Cincinnati')).toBe('Cincinnati Reds')
    expect(baseball('Cincinnati Reds')).toBe('Cincinnati Reds')
    expect(baseball('Red Sox')).toBe('Boston Red Sox')
    expect(baseball('St Louis Cardinals')).toBe('St. Louis Cardinals')
    expect(baseball('Los Angeles Angels of Anaheim', '2010')).toBe('Los Angeles Angels')
  })

  it('keeps the name the team had in the card year', () => {
    expect(baseball('Indians', '2015')).toBe('Cleveland Indians')
    expect(baseball('Indians', '2023')).toBe('Cleveland Indians')
    expect(baseball('CLE', '2015')).toBe('Cleveland Indians')
    expect(baseball('CLE', '2023')).toBe('Cleveland Guardians')
    expect(baseball('Marlins', '2010')).toBe('Florida Marlins')
    expect(baseball('Marlins', '2015')).toBe('Miami Marlins')
    expect(baseball('Rays', '2005')).toBe('Tampa Bay Devil Rays')
    expect(baseball('Angels', '1990')).toBe('California Angels')
    expect(baseball("A's", '2012')).toBe('Oakland Athletics')
    expect(baseball('Expos', '2021')).toBe('Montreal Expos')
    expect(baseball('Dodgers', '1955')).toBe('Brooklyn Dodgers')
  })

  it('reads the season start from a two-year season', () => {
    expect(standardTeam('Nets', { year: '2012-13', sport: 'Basketball' })).toBe('Brooklyn Nets')
    expect(standardTeam('Nets', { year: '2011-12', sport: 'Basketball' })).toBe('New Jersey Nets')
    expect(standardTeam('Coyotes', { year: '2019-20', sport: 'Hockey' })).toBe('Arizona Coyotes')
  })

  it('uses the sport to tell shared nicknames apart, and leaves them alone without one', () => {
    expect(standardTeam('Cardinals', { year: '2020', sport: 'Football' })).toBe('Arizona Cardinals')
    expect(standardTeam('Cardinals', { year: '2020', sport: 'Baseball' })).toBe('St. Louis Cardinals')
    expect(standardTeam('Rangers', { year: '2020', sport: 'Hockey' })).toBe('New York Rangers')
    expect(standardTeam('Cardinals', { year: '2020' })).toBe('Cardinals')
    expect(baseball('New York')).toBe('New York')
  })

  it('falls back to the collection’s own longer names, then leaves unknown teams as they are', () => {
    expect(standardTeam('Buckeyes', { year: '2020', sport: 'Football', known: ['Ohio State Buckeyes'] })).toBe(
      'Ohio State Buckeyes',
    )
    expect(standardTeam('Arsenal', { year: '2020', sport: 'Soccer' })).toBe('Arsenal')
    expect(standardTeam('Rangers', { year: '2020', sport: 'Soccer' })).toBe('Rangers')
    expect(standardTeam('  Durham   Bulls ', { year: '2020', sport: 'Baseball' })).toBe('Durham Bulls')
    expect(standardTeam('')).toBe('')
  })

  it('files cards with more than one team under one generic name', () => {
    expect(baseball('Reds / Cubs')).toBe(MULTIPLE_TEAMS)
    expect(baseball('Yankees & Mets')).toBe(MULTIPLE_TEAMS)
    expect(baseball('Dodgers vs. Giants')).toBe(MULTIPLE_TEAMS)
    expect(baseball('Cincinnati Reds, Chicago Cubs')).toBe(MULTIPLE_TEAMS)
    expect(baseball('multiple teams')).toBe(MULTIPLE_TEAMS)
    expect(standardTeam('Texas A&M Aggies', { year: '2020', sport: 'Football' })).toBe('Texas A&M Aggies')
  })
})

describe('teamFixes', () => {
  const card = (id: string, team: string | null, year = '2023', sport = 'Baseball') => ({ id, team, year, sport })

  it('groups saved cards by the change their team name needs', () => {
    const fixes = teamFixes([
      card('1', 'Cincinnati Reds'),
      card('2', 'Reds'),
      card('3', 'Reds'),
      card('4', 'Indians', '2016'),
      card('5', 'Reds/Cubs'),
      card('6', null),
      card('7', 'Durham Bulls'),
    ])
    expect(fixes).toEqual([
      { from: 'Reds', to: 'Cincinnati Reds', ids: ['2', '3'] },
      { from: 'Indians', to: 'Cleveland Indians', ids: ['4'] },
      { from: 'Reds/Cubs', to: MULTIPLE_TEAMS, ids: ['5'] },
    ])
  })
})
