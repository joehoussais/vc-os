import { describe, it, expect } from 'vitest';
import { getAttrValue, getEntryValue, getLocationCountryCode, getAttrValues, extractCompanyFields } from '../attioApi';

describe('getAttrValue', () => {
  it('returns null for missing record', () => {
    expect(getAttrValue(null, 'name')).toBeNull();
    expect(getAttrValue(undefined, 'name')).toBeNull();
  });

  it('returns null for missing slug', () => {
    expect(getAttrValue({ values: {} }, 'name')).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(getAttrValue({ values: { name: [] } }, 'name')).toBeNull();
  });

  it('extracts text value', () => {
    const record = { values: { name: [{ value: 'Acme Corp' }] } };
    expect(getAttrValue(record, 'name')).toBe('Acme Corp');
  });

  it('extracts numeric value', () => {
    const record = { values: { score: [{ value: 42 }] } };
    expect(getAttrValue(record, 'score')).toBe(42);
  });

  it('extracts status title', () => {
    const record = { values: { status_4: [{ status: { title: 'Contacted / to meet' } }] } };
    expect(getAttrValue(record, 'status_4')).toBe('Contacted / to meet');
  });

  it('extracts option title', () => {
    const record = { values: { lp_type: [{ option: { title: 'Family Office' } }] } };
    expect(getAttrValue(record, 'lp_type')).toBe('Family Office');
  });

  it('extracts target_record_id', () => {
    const record = { values: { company: [{ target_record_id: 'abc-123' }] } };
    expect(getAttrValue(record, 'company')).toBe('abc-123');
  });

  it('extracts domain', () => {
    const record = { values: { domains: [{ domain: 'acme.com' }] } };
    expect(getAttrValue(record, 'domains')).toBe('acme.com');
  });

  it('extracts location object (has country_code)', () => {
    const loc = { country_code: 'FR', locality: 'Paris' };
    const record = { values: { primary_location: [loc] } };
    expect(getAttrValue(record, 'primary_location')).toBe(loc);
  });

  it('extracts currency_value', () => {
    const record = { values: { amount: [{ currency_value: 6000000 }] } };
    expect(getAttrValue(record, 'amount')).toBe(6000000);
  });

  it('extracts full_name', () => {
    const record = { values: { person: [{ full_name: 'Jane Doe' }] } };
    expect(getAttrValue(record, 'person')).toBe('Jane Doe');
  });

  it('handles value=0 correctly (falsy but valid)', () => {
    const record = { values: { score: [{ value: 0 }] } };
    expect(getAttrValue(record, 'score')).toBe(0);
  });

  it('handles value="" correctly', () => {
    const record = { values: { name: [{ value: '' }] } };
    expect(getAttrValue(record, 'name')).toBe('');
  });
});

describe('getEntryValue', () => {
  it('returns null for missing entry', () => {
    expect(getEntryValue(null, 'in_scope')).toBeNull();
  });

  it('returns null for missing slug', () => {
    expect(getEntryValue({ entry_values: {} }, 'in_scope')).toBeNull();
  });

  it('extracts checkbox value', () => {
    const entry = { entry_values: { in_scope: [{ value: true }] } };
    expect(getEntryValue(entry, 'in_scope')).toBe(true);
  });

  it('extracts currency_value', () => {
    const entry = { entry_values: { amount_raised_in_meu: [{ currency_value: 6000000 }] } };
    expect(getEntryValue(entry, 'amount_raised_in_meu')).toBe(6000000);
  });

  it('extracts status title', () => {
    const entry = { entry_values: { status: [{ status: { title: 'Active' } }] } };
    expect(getEntryValue(entry, 'status')).toBe('Active');
  });

  it('extracts option title', () => {
    const entry = { entry_values: { type: [{ option: { title: 'Type A' } }] } };
    expect(getEntryValue(entry, 'type')).toBe('Type A');
  });
});

describe('getLocationCountryCode', () => {
  it('returns null for missing record', () => {
    expect(getLocationCountryCode(null, 'primary_location')).toBeNull();
  });

  it('extracts country code', () => {
    const record = { values: { primary_location: [{ country_code: 'DE' }] } };
    expect(getLocationCountryCode(record, 'primary_location')).toBe('DE');
  });

  it('returns null when country_code is missing', () => {
    const record = { values: { primary_location: [{ locality: 'Berlin' }] } };
    expect(getLocationCountryCode(record, 'primary_location')).toBeNull();
  });
});

describe('getAttrValues', () => {
  it('returns empty array for missing record', () => {
    expect(getAttrValues(null, 'categories')).toEqual([]);
  });

  it('returns empty array for missing slug', () => {
    expect(getAttrValues({ values: {} }, 'categories')).toEqual([]);
  });

  it('extracts multiple option titles', () => {
    const record = {
      values: {
        categories: [
          { option: { title: 'SaaS' } },
          { option: { title: 'AI' } },
        ],
      },
    };
    expect(getAttrValues(record, 'categories')).toEqual(['SaaS', 'AI']);
  });

  it('extracts multiple values', () => {
    const record = {
      values: { tags: [{ value: 'hot' }, { value: 'priority' }] },
    };
    expect(getAttrValues(record, 'tags')).toEqual(['hot', 'priority']);
  });
});

describe('extractCompanyFields', () => {
  it('returns null for missing record', () => {
    expect(extractCompanyFields(null)).toBeNull();
    expect(extractCompanyFields({})).toBeNull();
    expect(extractCompanyFields({ id: {} })).toBeNull();
  });

  it('extracts all fields from a full record', () => {
    const record = {
      id: { record_id: 'comp-123' },
      values: {
        name: [{ value: 'Acme Corp' }],
        status_4: [{ status: { title: 'Met' } }],
        owner: [
          { referenced_actor_id: 'owner-1' },
          { workspace_membership_id: 'owner-2' },
        ],
        first_email_interaction: [{ value: '2025-01-15' }],
        first_calendar_interaction: [{ value: '2025-02-01' }],
        domains: [{ domain: 'acme.com' }],
        logo_url: [{ value: 'https://logo.com/acme.png' }],
        primary_location: [{ country_code: 'FR' }],
      },
    };

    const result = extractCompanyFields(record);
    expect(result).toEqual({
      id: 'comp-123',
      name: 'Acme Corp',
      status4: 'Met',
      ownerIds: ['owner-1', 'owner-2'],
      firstEmail: '2025-01-15',
      firstCalendar: '2025-02-01',
      domain: 'acme.com',
      logoUrl: 'https://logo.com/acme.png',
      location: 'FR',
    });
  });

  it('handles minimal record with defaults', () => {
    const record = {
      id: { record_id: 'comp-456' },
      values: {},
    };

    const result = extractCompanyFields(record);
    expect(result.name).toBe('Unknown');
    expect(result.status4).toBeNull();
    expect(result.ownerIds).toEqual([]);
    expect(result.firstEmail).toBeNull();
    expect(result.domain).toBeNull();
  });

  it('extracts status4 from option.title as fallback', () => {
    const record = {
      id: { record_id: 'comp-789' },
      values: {
        status_4: [{ option: { title: 'Qualification' } }],
      },
    };
    expect(extractCompanyFields(record).status4).toBe('Qualification');
  });
});
