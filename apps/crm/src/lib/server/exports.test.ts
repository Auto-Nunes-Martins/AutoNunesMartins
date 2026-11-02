import { expect, it } from 'vitest';
import { buildCsv, csvEscape } from './exports';

it.each(['first\rsecond', 'first\nsecond', 'first\r\nsecond'])(
  'quotes embedded record separators without changing their contents: %j',
  (value) => {
    expect(csvEscape(value)).toBe(`"${value}"`);
  },
);

it('preserves numeric values, phone prefixes, leading zeroes and literal text', () => {
  expect(csvEscape(-12.5)).toBe('-12.5');
  expect(csvEscape('+351000000000')).toBe('+351000000000');
  expect(csvEscape('00123')).toBe('00123');
  expect(csvEscape('  text')).toBe('  text');
  expect(csvEscape(null)).toBe('');
  expect(csvEscape('quoted "name", detail; more')).toBe('"quoted ""name"", detail; more"');
});

it('keeps the UTF-8 BOM, header, row order and final newline', () => {
  expect(
    buildCsv(
      ['Nome', 'Valor'],
      [
        ['Fixture\rName', -12.5],
        ['Zero', 0],
      ],
    ),
  ).toBe('\uFEFFNome,Valor\n"Fixture\rName",-12.5\nZero,0\n');
});
