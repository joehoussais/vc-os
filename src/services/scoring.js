import { ASSESSMENT_THEMES, PLACEHOLDER_CALLS, SELECT_SCORE_MAP } from '../data/assessmentSchema';

// ─── Helpers ─────────────────────────────────────────────────────────
export function getRealFields(theme) {
  return theme.fields.filter(f => f.type !== 'section');
}

export function emptyAssessment() {
  const data = {};
  ASSESSMENT_THEMES.forEach(theme => {
    data[theme.id] = {};
    getRealFields(theme).forEach(f => {
      data[theme.id][f.id] = f.type === 'rating' ? null : f.type === 'check' ? false : '';
    });
  });
  return data;
}

export function getThemeCompletion(themeData, themeId) {
  const theme = ASSESSMENT_THEMES.find(t => t.id === themeId);
  if (!theme || !themeData) return 0;
  const real = getRealFields(theme);
  const filled = real.filter(f => {
    const val = themeData[f.id];
    if (f.type === 'check') return val === true;
    if (f.type === 'rating') return val !== null && val !== undefined;
    return val !== '' && val !== null && val !== undefined;
  }).length;
  return Math.round((filled / real.length) * 100);
}

export function getOverallCompletion(assessment) {
  if (!assessment) return 0;
  const scores = ASSESSMENT_THEMES.map(t => getThemeCompletion(assessment[t.id], t.id));
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

export function getThemeScore(themeData, themeId) {
  const theme = ASSESSMENT_THEMES.find(t => t.id === themeId);
  if (!theme || !themeData) return null;
  const real = getRealFields(theme);
  let totalScore = 0;
  let scoredCount = 0;
  real.forEach(f => {
    const val = themeData[f.id];
    if (f.type === 'rating' && val != null) {
      totalScore += val;
      scoredCount++;
    } else if (f.type === 'check' && val === true) {
      totalScore += 10;
      scoredCount++;
    } else if (f.type === 'check' && val === false) {
      // not scored — skip
    } else if (f.type === 'select' && val && val !== '') {
      const s = SELECT_SCORE_MAP[val];
      if (s != null) { totalScore += s; scoredCount++; }
    }
  });
  return scoredCount > 0 ? Math.round((totalScore / scoredCount) * 10) / 10 : null;
}

export function getOverallScore(assessment) {
  if (!assessment) return null;
  const scores = ASSESSMENT_THEMES.map(t => getThemeScore(assessment[t.id], t.id)).filter(s => s !== null);
  return scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null;
}

export function scoreColor(score) {
  if (score == null) return 'var(--text-quaternary)';
  if (score >= 7.5) return '#10B981';
  if (score >= 5) return '#F59E0B';
  return '#EF4444';
}

export function completionColor(pct) {
  if (pct >= 80) return '#10B981';
  if (pct >= 50) return '#F59E0B';
  if (pct > 0) return '#3B82F6';
  return 'var(--border-default)';
}

export function getKanbanColumn(deal, columnOverrides) {
  if (columnOverrides[deal.id]) return columnOverrides[deal.id];
  const { satus, maxStatus5 } = deal;
  if (maxStatus5 === 'In depth analysis' || maxStatus5 === 'LOI' || maxStatus5 === 'Memo started') {
    if (satus !== 'Committee' && satus !== 'Won / Portfolio') return 'analysis';
  }
  if (satus === 'Committee') return 'committee';
  return 'met';
}

// Match a deal name to placeholder calls
export function getDealCalls(dealName) {
  if (!dealName) return [];
  const name = dealName.split(' - ')[0].trim().toLowerCase();
  for (const [key, calls] of Object.entries(PLACEHOLDER_CALLS)) {
    if (name.includes(key.toLowerCase())) return calls;
  }
  return [];
}
