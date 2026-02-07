import { describe, it, expect } from 'vitest';
import { parseStageFromDealId, formatAmount, dateToQuarter, countryToRegion, countryToFilterRegion } from '../geography';

describe('parseStageFromDealId', () => {
  it('returns null for null/empty input', () => {
    expect(parseStageFromDealId(null)).toBeNull();
    expect(parseStageFromDealId('')).toBeNull();
    expect(parseStageFromDealId(undefined)).toBeNull();
  });

  it('parses Series A', () => {
    expect(parseStageFromDealId('Series A - Acme Corp')).toBe('Series A');
  });

  it('parses Series B', () => {
    expect(parseStageFromDealId('Series B - BigCo')).toBe('Series B');
  });

  it('parses Seed', () => {
    expect(parseStageFromDealId('Seed - StartupX')).toBe('Seed');
  });

  it('parses Pre-Seed', () => {
    expect(parseStageFromDealId('Pre-Seed - TinyStartup')).toBe('Pre-seed');
  });

  it('parses case-insensitively and normalizes', () => {
    expect(parseStageFromDealId('series a - Foo')).toBe('Series A');
  });

  it('returns null for unrecognized format', () => {
    expect(parseStageFromDealId('Acme Corp raised money')).toBeNull();
    expect(parseStageFromDealId('IPO - BigCo')).toBeNull();
  });

  it('parses Venture', () => {
    expect(parseStageFromDealId('Venture - SomeCompany')).toBe('Venture');
  });
});

describe('formatAmount', () => {
  it('returns null for null/empty input', () => {
    expect(formatAmount(null)).toBeNull();
    expect(formatAmount(undefined)).toBeNull();
    expect(formatAmount('')).toBeNull();
  });

  it('converts number to millions', () => {
    expect(formatAmount(6000000)).toBe(6);
    expect(formatAmount(15500000)).toBe(16);
    expect(formatAmount(500000)).toBe(1);
  });

  it('rounds to nearest integer', () => {
    expect(formatAmount(1500000)).toBe(2);
    expect(formatAmount(2499999)).toBe(2);
  });

  it('returns 0 for very small amounts', () => {
    expect(formatAmount(100)).toBe(0);
  });

  it('parses string amounts', () => {
    expect(formatAmount('6,000,000')).toBe(6);
    expect(formatAmount('$15,000,000')).toBe(15);
  });

  it('handles strings with no numbers', () => {
    expect(formatAmount('unknown')).toBeNull();
  });
});

describe('dateToQuarter', () => {
  it('returns null for null/empty input', () => {
    expect(dateToQuarter(null)).toBeNull();
    expect(dateToQuarter('')).toBeNull();
    expect(dateToQuarter(undefined)).toBeNull();
  });

  it('returns null for invalid date', () => {
    expect(dateToQuarter('not-a-date')).toBeNull();
  });

  it('converts Q1 dates', () => {
    expect(dateToQuarter('2024-01-15')).toBe('Q1 2024');
    expect(dateToQuarter('2024-03-31')).toBe('Q1 2024');
  });

  it('converts Q2 dates', () => {
    expect(dateToQuarter('2024-04-01')).toBe('Q2 2024');
    expect(dateToQuarter('2024-06-30')).toBe('Q2 2024');
  });

  it('converts Q3 dates', () => {
    expect(dateToQuarter('2024-07-15')).toBe('Q3 2024');
  });

  it('converts Q4 dates', () => {
    expect(dateToQuarter('2024-12-25')).toBe('Q4 2024');
  });
});

describe('countryToRegion', () => {
  it('maps FR to France', () => {
    expect(countryToRegion['FR']).toBe('France');
  });

  it('maps GB and UK both to UK', () => {
    expect(countryToRegion['GB']).toBe('UK');
    expect(countryToRegion['UK']).toBe('UK');
  });

  it('returns undefined for unmapped codes', () => {
    expect(countryToRegion['US']).toBeUndefined();
    expect(countryToRegion['CN']).toBeUndefined();
  });
});

describe('countryToFilterRegion', () => {
  it('groups Germany, NL, BE, LU under Germany', () => {
    expect(countryToFilterRegion['DE']).toBe('Germany');
    expect(countryToFilterRegion['NL']).toBe('Germany');
    expect(countryToFilterRegion['BE']).toBe('Germany');
    expect(countryToFilterRegion['LU']).toBe('Germany');
  });

  it('groups Nordics', () => {
    expect(countryToFilterRegion['SE']).toBe('Nordics');
    expect(countryToFilterRegion['NO']).toBe('Nordics');
    expect(countryToFilterRegion['DK']).toBe('Nordics');
    expect(countryToFilterRegion['FI']).toBe('Nordics');
  });

  it('returns undefined for unmapped codes', () => {
    expect(countryToFilterRegion['US']).toBeUndefined();
    expect(countryToFilterRegion['GB']).toBeUndefined();
  });
});
