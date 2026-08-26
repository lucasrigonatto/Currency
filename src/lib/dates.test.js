import { addMonths, isValidIsoDate } from './dates';

test('addMonths keeps January 31 in February instead of overflowing to March', () => {
  expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
  expect(addMonths('2026-01-31', 2)).toBe('2026-03-31');
});

test('addMonths supports leap years and negative deltas', () => {
  expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
  expect(addMonths('2024-03-31', -1)).toBe('2024-02-29');
  expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
});

test('isValidIsoDate rejects impossible calendar dates', () => {
  expect(isValidIsoDate('2026-02-31')).toBe(false);
  expect(isValidIsoDate('2026-13-01')).toBe(false);
  expect(isValidIsoDate('2026-00-10')).toBe(false);
  expect(isValidIsoDate('2026-02-28')).toBe(true);
});
