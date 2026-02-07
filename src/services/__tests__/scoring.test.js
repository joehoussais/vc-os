import { describe, it, expect } from 'vitest';
import {
  getRealFields, emptyAssessment, getThemeCompletion, getOverallCompletion,
  getThemeScore, getOverallScore, scoreColor, completionColor,
  getKanbanColumn, getDealCalls,
} from '../scoring';
import { ASSESSMENT_THEMES } from '../../data/assessmentSchema';

describe('getRealFields', () => {
  it('filters out section-type fields', () => {
    const theme = {
      fields: [
        { id: '_s_header', type: 'section' },
        { id: 'field1', type: 'check' },
        { id: 'field2', type: 'rating' },
        { id: '_s_another', type: 'section' },
        { id: 'field3', type: 'select' },
      ],
    };
    const real = getRealFields(theme);
    expect(real).toHaveLength(3);
    expect(real.map(f => f.id)).toEqual(['field1', 'field2', 'field3']);
  });
});

describe('emptyAssessment', () => {
  it('returns an object with keys for each theme', () => {
    const empty = emptyAssessment();
    ASSESSMENT_THEMES.forEach(theme => {
      expect(empty[theme.id]).toBeDefined();
    });
  });

  it('initializes check fields to false', () => {
    const empty = emptyAssessment();
    const founder = ASSESSMENT_THEMES.find(t => t.id === 'founder');
    const checkField = getRealFields(founder).find(f => f.type === 'check');
    expect(empty.founder[checkField.id]).toBe(false);
  });

  it('initializes rating fields to null', () => {
    const empty = emptyAssessment();
    const founder = ASSESSMENT_THEMES.find(t => t.id === 'founder');
    const ratingField = getRealFields(founder).find(f => f.type === 'rating');
    expect(empty.founder[ratingField.id]).toBeNull();
  });

  it('initializes select fields to empty string', () => {
    const empty = emptyAssessment();
    const founder = ASSESSMENT_THEMES.find(t => t.id === 'founder');
    const selectField = getRealFields(founder).find(f => f.type === 'select');
    expect(empty.founder[selectField.id]).toBe('');
  });
});

describe('getThemeCompletion', () => {
  it('returns 0 for null data', () => {
    expect(getThemeCompletion(null, 'founder')).toBe(0);
  });

  it('returns 0 for unknown theme', () => {
    expect(getThemeCompletion({}, 'nonexistent')).toBe(0);
  });

  it('returns 0 for empty assessment', () => {
    const empty = emptyAssessment();
    expect(getThemeCompletion(empty.founder, 'founder')).toBe(0);
  });

  it('returns 100 when all fields filled', () => {
    const founder = ASSESSMENT_THEMES.find(t => t.id === 'founder');
    const data = {};
    getRealFields(founder).forEach(f => {
      if (f.type === 'check') data[f.id] = true;
      else if (f.type === 'rating') data[f.id] = 7;
      else if (f.type === 'select') data[f.id] = f.options[0];
    });
    expect(getThemeCompletion(data, 'founder')).toBe(100);
  });

  it('returns partial percentage correctly', () => {
    const founder = ASSESSMENT_THEMES.find(t => t.id === 'founder');
    const real = getRealFields(founder);
    const data = {};
    // Fill only the first field
    const first = real[0];
    if (first.type === 'check') data[first.id] = true;
    else if (first.type === 'rating') data[first.id] = 5;
    else data[first.id] = first.options?.[0] || 'test';

    const expected = Math.round((1 / real.length) * 100);
    expect(getThemeCompletion(data, 'founder')).toBe(expected);
  });
});

describe('getOverallCompletion', () => {
  it('returns 0 for null', () => {
    expect(getOverallCompletion(null)).toBe(0);
  });

  it('returns 0 for empty assessment', () => {
    expect(getOverallCompletion(emptyAssessment())).toBe(0);
  });
});

describe('getThemeScore', () => {
  it('returns null for null data', () => {
    expect(getThemeScore(null, 'founder')).toBeNull();
  });

  it('returns null for unknown theme', () => {
    expect(getThemeScore({}, 'nonexistent')).toBeNull();
  });

  it('returns null when no fields are scored', () => {
    expect(getThemeScore({}, 'founder')).toBeNull();
  });

  it('scores a rating field correctly', () => {
    // Rating of 8 should give score 8
    const data = { founderGutScore: 8 };
    const score = getThemeScore(data, 'founder');
    expect(score).toBe(8);
  });

  it('scores a check field as 10 when true', () => {
    const data = { founderRolesConfirmed: true };
    const score = getThemeScore(data, 'founder');
    expect(score).toBe(10);
  });

  it('ignores unchecked check fields', () => {
    const data = { founderRolesConfirmed: false, founderGutScore: 6 };
    const score = getThemeScore(data, 'founder');
    // Only the rating (6) should count, check=false is skipped
    expect(score).toBe(6);
  });

  it('scores select fields using SELECT_SCORE_MAP', () => {
    const data = { executionDiscipline: 'Exceptional' };
    const score = getThemeScore(data, 'founder');
    expect(score).toBe(10); // Exceptional = 10
  });
});

describe('getOverallScore', () => {
  it('returns null for null', () => {
    expect(getOverallScore(null)).toBeNull();
  });

  it('returns null for empty assessment', () => {
    expect(getOverallScore(emptyAssessment())).toBeNull();
  });
});

describe('scoreColor', () => {
  it('returns quaternary for null', () => {
    expect(scoreColor(null)).toBe('var(--text-quaternary)');
  });

  it('returns green for high scores', () => {
    expect(scoreColor(8)).toBe('#10B981');
    expect(scoreColor(7.5)).toBe('#10B981');
  });

  it('returns amber for medium scores', () => {
    expect(scoreColor(5)).toBe('#F59E0B');
    expect(scoreColor(7.4)).toBe('#F59E0B');
  });

  it('returns red for low scores', () => {
    expect(scoreColor(4.9)).toBe('#EF4444');
    expect(scoreColor(0)).toBe('#EF4444');
  });
});

describe('completionColor', () => {
  it('returns green for 80%+', () => {
    expect(completionColor(80)).toBe('#10B981');
    expect(completionColor(100)).toBe('#10B981');
  });

  it('returns amber for 50-79%', () => {
    expect(completionColor(50)).toBe('#F59E0B');
    expect(completionColor(79)).toBe('#F59E0B');
  });

  it('returns blue for 1-49%', () => {
    expect(completionColor(1)).toBe('#3B82F6');
    expect(completionColor(49)).toBe('#3B82F6');
  });

  it('returns default for 0%', () => {
    expect(completionColor(0)).toBe('var(--border-default)');
  });
});

describe('getKanbanColumn', () => {
  it('returns override when present', () => {
    const deal = { id: 'deal-1', satus: 'Met', maxStatus5: null };
    expect(getKanbanColumn(deal, { 'deal-1': 'committee' })).toBe('committee');
  });

  it('returns met as default', () => {
    const deal = { id: 'deal-1', satus: 'Met', maxStatus5: null };
    expect(getKanbanColumn(deal, {})).toBe('met');
  });

  it('returns analysis for In depth analysis', () => {
    const deal = { id: 'deal-1', satus: 'Met', maxStatus5: 'In depth analysis' };
    expect(getKanbanColumn(deal, {})).toBe('analysis');
  });

  it('returns analysis for LOI', () => {
    const deal = { id: 'deal-1', satus: 'Met', maxStatus5: 'LOI' };
    expect(getKanbanColumn(deal, {})).toBe('analysis');
  });

  it('returns committee for Committee satus', () => {
    const deal = { id: 'deal-1', satus: 'Committee', maxStatus5: 'In depth analysis' };
    expect(getKanbanColumn(deal, {})).toBe('committee');
  });

  it('does not put Won / Portfolio in analysis', () => {
    const deal = { id: 'deal-1', satus: 'Won / Portfolio', maxStatus5: 'In depth analysis' };
    expect(getKanbanColumn(deal, {})).toBe('met');
  });
});

describe('getDealCalls', () => {
  it('returns empty array for null', () => {
    expect(getDealCalls(null)).toEqual([]);
  });

  it('returns empty array for unknown company', () => {
    expect(getDealCalls('Unknown Company - Series A')).toEqual([]);
  });

  it('matches Upciti calls', () => {
    const calls = getDealCalls('Upciti - Series A');
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0].type).toBe('Founder');
  });

  it('matches case-insensitively', () => {
    const calls = getDealCalls('QUIET - Seed');
    expect(calls.length).toBeGreaterThan(0);
  });

  it('matches partial name before dash', () => {
    const calls = getDealCalls('Sunrise Robotics - Series B');
    expect(calls.length).toBe(2);
  });
});
