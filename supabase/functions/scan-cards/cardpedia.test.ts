import { describe, expect, it } from 'vitest'
import { matchPage, parseSetPage, withCollectorInserts } from './cardpedia'

describe('matchPage', () => {
  const titles = [
    '2024 Finest',
    '2024 Topps',
    '2024 Topps Chrome',
    '2024 Topps Chrome Update',
    '2024 Select',
    '2024 Bowman Chrome',
    '2023 Topps',
    '2011 Bowman Draft Picks & Prospects',
    '2011 Bowman',
    '2016 Topps Allen & Ginter',
  ]

  it('ignores a brand the page leaves off', () => {
    expect(matchPage('2024', 'Topps Finest', titles)).toEqual({ title: '2024 Finest', variant: null })
    expect(matchPage('2024', 'Panini Select', titles)).toEqual({ title: '2024 Select', variant: null })
  })

  it('prefers the exact set over a page it could be part of', () => {
    expect(matchPage('2024', 'Topps Chrome', titles)?.title).toBe('2024 Topps Chrome')
    expect(matchPage('2024', 'Topps Chrome Update', titles)?.title).toBe('2024 Topps Chrome Update')
  })

  it('finds a series on the product’s page', () => {
    expect(matchPage('2024', 'Topps Series 2', titles)).toEqual({ title: '2024 Topps', variant: null })
  })

  it('finds a Chrome set on the page that lists its Chrome cards', () => {
    expect(matchPage('2011', 'Bowman Chrome Draft', titles)).toEqual({
      title: '2011 Bowman Draft Picks & Prospects',
      variant: 'Chrome',
    })
  })

  it('matches punctuation and possessives loosely', () => {
    expect(matchPage('2016', 'Topps Allen & Ginter’s', titles)?.title).toBe('2016 Topps Allen & Ginter')
  })

  it('needs the same year and no unexplained words', () => {
    expect(matchPage('2025', 'Topps Finest', titles)).toBeNull()
    expect(matchPage('2024', 'Bowman Chrome Draft', titles)).toBeNull()
    expect(matchPage('2024', 'Leaf Metal', titles)).toBeNull()
  })
})

const ratio = (rows: [string, string, string][]) =>
  `<table class="ratio"><tbody><tr><th>Cards</th><th>Total Cards</th><th>Numbered To</th><th>Hobby Odds</th></tr>${rows
    .map((r) => `<tr><td>${r.join('</td><td>')}</td><td>1:2</td></tr>`)
    .join('')}</tbody></table>`
const h = (level: number, text: string) => `<div class="mw-heading"><h${level} id="x">${text}</h${level}><span>edit</span></div>`
const list = (items: string[]) => `<ul style="list-style-type:none;">${items.map((i) => `<li>${i} </li>`).join('')}</ul>`

const flagship = [
  h(1, 'Description'),
  '<p>A set.</p>',
  h(1, 'Insertion Ratios'),
  ratio([
    ['Base', '350', '-'],
    ['Traded Gimmicks', '2', '-'],
    ['Rainbow Foil', '350', '-'],
    ['Gold', '350', '2024'],
    ['Black', '350', '73'],
    ['Platinum', '350', 'one-of-one'],
    ['Printing Plates', '350', 'four for each'],
    ['Grand Gamers', '26', '-'],
    ['Grand Gamers Blue', '26', '600'],
    ['Grand Gamers Platinum', '26', 'one-of-one'],
    ['Stars Of MLB Chrome', '30', '-'],
    ['Stars Of MLB Chrome Red Refractor', '30', '70'],
    ['1989 Topps Baseball Autograph Black', '299', '199'],
  ]),
  h(1, 'Checklist'),
  h(2, 'Base Set'),
  h(3, 'Series One'),
  list(['1 Ronald Acuña, Jr.', '2 San Diego Padres TC', '3 Endy Rodríguez RC', '15 Henry Davis (RC)']),
  h(3, 'Gimmicks'),
  h(4, 'Traded Gimmicks'),
  list(['50 Juan Soto NYY']),
  h(2, 'Parallels'),
  list(['Rainbow Foil', 'Gold (serial-numbered to 2024 copies)']),
  h(2, 'Inserts'),
  h(3, 'Grand Gamers'),
  list(['GOG-1 Nolan Ryan', 'GOG-2 Cal Ripken, Jr.']),
  h(2, 'Autographs'),
  h(3, '1989 Topps Baseball Autographs'),
  list(['89BA-AA Andrew Abbott', '89BA-AB Alex Bregman  25']),
  h(1, 'Errata'),
  list(['9 Not A Card']),
].join('\n')

describe('parseSetPage', () => {
  const parsed = parseSetPage(flagship)
  const of = (insert: string) =>
    parsed.parallels.filter((p) => p.insert_name === insert).map((p) => [p.parallel, p.print_run])

  it('reads base parallels with their print runs from the odds table', () => {
    expect(of('')).toEqual([
      ['Rainbow Foil', null],
      ['Gold', 2024],
      ['Black', 73],
      ['Platinum', 1],
      ['Printing Plates', 1],
    ])
  })

  it('puts an insert’s parallels under its checklist name', () => {
    expect(of('Grand Gamers')).toEqual([
      ['Blue', 600],
      ['Platinum', 1],
    ])
    // The table says "Autograph", the checklist heading "Autographs".
    expect(of('1989 Topps Baseball Autographs')).toEqual([['Black', 199]])
    // A version row starts a subset of its own.
    expect(of('Stars Of MLB Chrome')).toEqual([['Red Refractor', 70]])
  })

  it('reads the checklist by insert, skipping variations and the parallels list', () => {
    expect(parsed.cards).toEqual([
      { insert_name: '', card_number: '1', player: 'Ronald Acuña, Jr.', is_rookie: false },
      { insert_name: '', card_number: '2', player: 'San Diego Padres TC', is_rookie: false },
      { insert_name: '', card_number: '3', player: 'Endy Rodríguez', is_rookie: true },
      { insert_name: '', card_number: '15', player: 'Henry Davis', is_rookie: true },
      { insert_name: 'Grand Gamers', card_number: 'GOG-1', player: 'Nolan Ryan', is_rookie: false },
      { insert_name: 'Grand Gamers', card_number: 'GOG-2', player: 'Cal Ripken, Jr.', is_rookie: false },
      { insert_name: '1989 Topps Baseball Autographs', card_number: '89BA-AA', player: 'Andrew Abbott', is_rookie: false },
      { insert_name: '1989 Topps Baseball Autographs', card_number: '89BA-AB', player: 'Alex Bregman', is_rookie: false },
    ])
  })

  it('names a tiered base parallel once, and leaves a print run that differs by tier blank', () => {
    const finest = parseSetPage(
      [
        h(1, 'Insertion Ratios'),
        ratio([
          ['Base Set', '300', '-'],
          ['Common', '100', '-'],
          ['Common Refractor', '100', '-'],
          ['Common Gold Refractor', '100', '50'],
          ['Common SuperFractor', '100', 'one-of-one'],
          ['Uncommon Gold Refractor', '100', '25'],
          ['Uncommon SuperFractor', '100', 'one-of-one'],
        ]),
      ].join(''),
    )
    expect(finest.parallels.map((p) => [p.parallel, p.print_run])).toEqual([
      ['Refractor', null],
      ['Gold Refractor', null],
      ['SuperFractor', 1],
    ])
  })

  it('gives a base subset with its own numbering its own name and parallels', () => {
    const chrome = parseSetPage(
      [
        h(1, 'Insertion Ratios'),
        ratio([
          ['Base', '100', '-'],
          ['Prospects', '100', '-'],
          ['Refractors', '200', '499'],
          ['Speckle Prospect Refractors', '100', '299'],
        ]),
        h(1, 'Checklist'),
        h(2, 'Base Set'),
        list(['1 Bobby Dalbec RC']),
        h(3, 'Prospects'),
        list(['BCP-151 Victor Acosta']),
      ].join(''),
    )
    expect(chrome.parallels).toEqual([
      { insert_name: '', parallel: 'Refractor', print_run: 499 },
      { insert_name: 'Prospects', parallel: 'Refractor', print_run: 499 },
      { insert_name: 'Prospects', parallel: 'Speckle Refractor', print_run: 299 },
    ])
    expect(chrome.cards.map((c) => [c.insert_name, c.card_number])).toEqual([
      ['', '1'],
      ['Prospects', 'BCP-151'],
    ])
  })

  it('reads only a variant’s rows, and nothing when the page has none', () => {
    const draft = [
      h(1, 'Insertion Ratios'),
      ratio([
        ['Base', '200', '-'],
        ['Red', '200', '5'],
        ['Chrome', '200', '-'],
        ['Chrome Refractor', '200', '-'],
        ['Chrome Red Refractor', '200', '5'],
      ]),
      h(1, 'Checklist'),
      h(2, 'Base Set'),
      list(['BD-1 Adley Rutschman']),
    ].join('')
    expect(parseSetPage(draft, 'Chrome')).toEqual({
      parallels: [
        { insert_name: '', parallel: 'Refractor', print_run: null },
        { insert_name: '', parallel: 'Red Refractor', print_run: 5 },
      ],
      cards: [],
      inserts: [],
    })
    expect(parseSetPage(flagship, 'Chrome').parallels).toEqual([])
  })

  it('reads a parallel written in front of an insert’s name', () => {
    const optic = parseSetPage(
      [
        h(1, 'Insertion Ratios'),
        ratio([
          ['Base', '175', '-'],
          ['Rated Rookies', '35', '-'],
          ['Holo Rated Rookies', '35', '150'],
        ]),
      ].join(''),
    )
    expect(optic.parallels).toEqual([{ insert_name: 'Rated Rookies', parallel: 'Holo', print_run: 150 }])
  })
})

describe('withCollectorInserts', () => {
  it('uses the collector’s spelling of the same insert', () => {
    const rows = [{ insert_name: 'Prospect Autograph' }, { insert_name: '' }, { insert_name: 'Future Stars' }]
    expect(withCollectorInserts(rows, ['Prospect Autographs'])).toEqual([
      { insert_name: 'Prospect Autographs' },
      { insert_name: '' },
      { insert_name: 'Future Stars' },
    ])
  })
})
