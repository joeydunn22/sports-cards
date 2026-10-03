/** Instructions and output schema for reading one card from its front and back photos. */

export const FIELDS = [
  'player',
  'year',
  'set_name',
  'insert_name',
  'parallel',
  'card_number',
  'sport',
  'team',
  'is_rookie',
  'is_auto',
  'is_patch',
  'is_relic',
  'serial_number',
  'print_run',
] as const

const nullableInt = { anyOf: [{ type: 'integer' }, { type: 'null' }] }

export const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    player: { type: 'string' },
    year: { type: 'string' },
    set_name: { type: 'string' },
    insert_name: { type: 'string' },
    parallel: { type: 'string' },
    card_number: { type: 'string' },
    sport: { type: 'string' },
    team: { type: 'string' },
    is_rookie: { type: 'boolean' },
    is_auto: { type: 'boolean' },
    is_patch: { type: 'boolean' },
    is_relic: { type: 'boolean' },
    serial_number: nullableInt,
    print_run: nullableInt,
    inferred_fields: { type: 'array', items: { type: 'string', enum: FIELDS } },
    uncertain_fields: { type: 'array', items: { type: 'string', enum: FIELDS } },
    needs_lookup: { type: 'boolean' },
    retake: { type: 'string' },
    notes: { type: 'string' },
  },
  required: [...FIELDS, 'inferred_fields', 'uncertain_fields', 'needs_lookup', 'retake', 'notes'],
  additionalProperties: false,
}

export type KnownNames = { set_name: string[]; insert_name: string[]; parallel: string[]; team: string[] }

export function systemPrompt(known: KnownNames): string {
  const list = (values: string[]) => (values.length ? values.join(' | ') : '(none yet)')
  return `You catalog sports trading cards for a collector. You get photos of one card: the front, and usually the back. The card is normally in a penny sleeve inside a rigid toploader, so expect glare and reflections. Read the card and return its details.

Three fields identify a card exactly, and they must never blur together:
- set_name: the product as Beckett and eBay list it, with the brand and without the year. Examples: Topps Finest, Bowman Chrome, Panini Prizm, Donruss Optic, Upper Deck Series 1, Topps Heritage. Never put a year, a color, "Refractor", or an insert name here.
- insert_name: a named subset within the set, such as Rookie Autographs, Prospect Autographs, Future Stars, Young Guns. Use "" for a base card.
- parallel: the color or finish variant, such as Refractor, Red Refractor, Silver, Gold Wave, Holo. Use "" for the base version. Never put the set name here.
Example: a red Finest refractor numbered to 5 is set_name "Topps Finest", insert_name "", parallel "Red Refractor", print_run 5.

Other fields:
- player: the player's name as printed. Read it; never identify a player from their face.
- year: the release year. Use a season like "2023-24" for basketball and hockey releases that are labeled that way, otherwise one year like "2023". The copyright line on the back is the best source. Watch for retro designs (Topps Heritage and Archives reuse old designs): go by the copyright year, not the look.
- card_number: exactly as printed, without "#" or "No.", such as "12", "BDC-150", "RA-JH".
- sport: Baseball, Basketball, Football, Hockey, Soccer, and so on.
- team: the team shown on the card, as its full common name, such as "Baltimore Orioles".
- is_rookie: true when the card has an RC logo or a printed rookie designation.
- is_auto: true when the card is signed (on-card or sticker autograph).
- is_patch: true for a multi-color jersey patch piece. is_relic: true for a plain memorabilia swatch (jersey, bat, ball) that is not a patch.
- serial_number and print_run: from a stamped serial such as "23/99" (serial 23, print run 99); a 1/1 is 1 and 1. Use null for both when the card is not serial numbered.

When the collector already uses a name for the same thing, use their exact spelling. Their existing names:
- Sets: ${list(known.set_name)}
- Inserts: ${list(known.insert_name)}
- Parallels: ${list(known.parallel)}
- Teams: ${list(known.team)}

Be honest about how you know each field:
- inferred_fields: fields you did not read directly off the card but worked out (for example a year recognized from the card design, or a set recognized from its look).
- uncertain_fields: fields you are not confident about, including any parallel you cannot tell apart from a similar one in the photo.
- needs_lookup: true when checking the set's checklist (by set, year and card number) would likely settle something you are unsure of.
- retake: "" if the photos are good enough. Otherwise a short instruction for the collector, such as "Glare hides the serial number on the front; tilt the light and retake."
- notes: one short sentence on anything the collector should know, or "".
Fill every field with your best reading even when unsure, and flag it rather than leaving it blank.`
}
