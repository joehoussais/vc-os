import { useState, useMemo, useCallback } from 'react';
import { useAttioCompanies } from '../hooks/useAttioCompanies';
import { TEAM_MEMBERS, TEAM_MAP } from '../data/team';
import { granolaMeetings } from '../data/mockData';
import Modal from '../components/Modal';
import { useLocalStorage } from '../hooks/useLocalStorage';

// ─── Assessment schema ───────────────────────────────────────────────
const ASSESSMENT_THEMES = [
  {
    id: 'founder',
    label: 'Founder / Team',
    icon: '👤',
    fields: [
      { id: 'initialResponse', label: 'Initial response time', type: 'select', options: ['< 1 hour', '< 24 hours', '2-3 days', '> 3 days'] },
      { id: 'typicalReply', label: 'Typical reply time', type: 'select', options: ['< 1 hour', '< 24 hours', '2-3 days', '> 3 days'] },
      { id: 'camePrepared', label: 'Came prepared to first call?', type: 'select', options: ['Yes', 'No'] },
      { id: 'curveball', label: 'Curveball handling', type: 'select', options: ['Exceptional', 'Good', 'Mediocre', 'Poor'] },
      { id: 'tenYears', label: 'Work with them 10 years?', type: 'select', options: ['Yes', 'Unsure', 'No'] },
      { id: 'gutScore', label: 'Gut score (1-10)', type: 'rating' },
      { id: 'teamComposition', label: 'Team composition', type: 'select', options: ['Strong', 'Decent', 'Weak'] },
    ],
  },
  {
    id: 'market',
    label: 'Market',
    icon: '🌍',
    fields: [
      { id: 'tamSize', label: 'TAM size', type: 'select', options: ['< €100M', '€100M – €1B', '€1B – €10B', '> €10B'] },
      { id: 'competition', label: 'Competitive landscape', type: 'select', options: ['Blue ocean', 'Few players', 'Crowded', 'Red ocean'] },
      { id: 'timing', label: 'Market timing', type: 'select', options: ['Too early', 'Right time', 'Late'] },
      { id: 'regulatoryRisk', label: 'Regulatory risk', type: 'select', options: ['Low', 'Medium', 'High'] },
    ],
  },
  {
    id: 'financials',
    label: 'Traction / Financials',
    icon: '📊',
    fields: [
      { id: 'revenueStage', label: 'Revenue stage', type: 'select', options: ['Pre-revenue', '< €1M', '€1M – €5M', '€5M – €20M', '> €20M'] },
      { id: 'growthRate', label: 'YoY growth', type: 'select', options: ['< 50%', '50% – 100%', '100% – 200%', '> 200%'] },
      { id: 'unitEconomics', label: 'Unit economics', type: 'select', options: ['Proven', 'Promising', 'Unclear', 'Negative'] },
      { id: 'fundraisingClean', label: 'Clean fundraising process?', type: 'select', options: ['Yes', 'No'] },
    ],
  },
  {
    id: 'tech',
    label: 'Tech',
    icon: '⚙️',
    fields: [
      { id: 'techMoat', label: 'Tech moat', type: 'select', options: ['Strong', 'Moderate', 'Weak', 'None'] },
      { id: 'scalability', label: 'Scalability', type: 'select', options: ['Proven', 'Likely', 'Uncertain', 'Unlikely'] },
      { id: 'ipProtection', label: 'IP protection', type: 'select', options: ['Patents', 'Trade secret', 'None'] },
    ],
  },
  {
    id: 'ddLegal',
    label: 'DD / Legal',
    icon: '⚖️',
    fields: [
      { id: 'legalStructure', label: 'Legal structure', type: 'select', options: ['Clean', 'Minor issues', 'Major issues'] },
      { id: 'capTable', label: 'Cap table', type: 'select', options: ['Clean', 'Acceptable', 'Messy'] },
      { id: 'regulatoryCompliance', label: 'Regulatory compliance', type: 'select', options: ['Compliant', 'In progress', 'Non-compliant'] },
      { id: 'ipOwnership', label: 'IP ownership', type: 'select', options: ['Clear', 'Partially clear', 'Unclear'] },
    ],
  },
];

// Kanban columns — map Attio satus values to columns
const KANBAN_STAGES = [
  { id: 'met', label: 'Met', color: '#10B981' },
  { id: 'analysis', label: 'In-Depth Analysis', color: '#8B5CF6' },
  { id: 'committee', label: 'Committee', color: '#F59E0B' },
];

// Active pipeline stages to show in Deal Analysis — only deals we're actively working
const ACTIVE_SATUS = new Set(['Met', 'Committee']);

// Manual column overrides: entry_id → kanban column
// Used when a deal should be in a different column than its Attio satus suggests
// (e.g. user wants them in In-Depth Analysis but Attio still shows "Met")
const COLUMN_OVERRIDES = {
  'e9854ff6-6128-44f1-ab44-83f2e9fcf33e': 'analysis', // Upciti - Series A
  'cc2c5d68-b872-4f03-b82c-c1bbd6b7952d': 'analysis', // Sunrise Robotics - Series A
};

const ratingOptions = [1, 2, 3, 4, 6, 7, 8, 9, 10];

// ─── Helpers ─────────────────────────────────────────────────────────
function emptyAssessment() {
  const data = {};
  ASSESSMENT_THEMES.forEach(theme => {
    data[theme.id] = {};
    theme.fields.forEach(f => { data[theme.id][f.id] = f.type === 'rating' ? null : ''; });
  });
  return data;
}

function getThemeCompletion(themeData, themeId) {
  const theme = ASSESSMENT_THEMES.find(t => t.id === themeId);
  if (!theme || !themeData) return 0;
  const filled = theme.fields.filter(f => {
    const val = themeData[f.id];
    return val !== '' && val !== null && val !== undefined;
  }).length;
  return Math.round((filled / theme.fields.length) * 100);
}

function getOverallCompletion(assessment) {
  if (!assessment) return 0;
  const scores = ASSESSMENT_THEMES.map(t => getThemeCompletion(assessment[t.id], t.id));
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

function completionColor(pct) {
  if (pct >= 80) return '#10B981';
  if (pct >= 50) return '#F59E0B';
  if (pct > 0) return '#3B82F6';
  return 'var(--border-default)';
}

// Determine kanban column from deal data
function getKanbanColumn(deal) {
  // Check manual override first
  if (COLUMN_OVERRIDES[deal.id]) return COLUMN_OVERRIDES[deal.id];

  const { satus, maxStatus5 } = deal;

  // In-depth analysis: determined by max_status_5
  if (maxStatus5 === 'In depth analysis' || maxStatus5 === 'LOI' || maxStatus5 === 'Memo started') {
    if (satus !== 'Committee' && satus !== 'Won / Portfolio') {
      return 'analysis';
    }
  }
  if (satus === 'Committee') return 'committee';
  return 'met'; // Default for active pipeline deals
}

// ─── Components ──────────────────────────────────────────────────────

function GaugeRing({ pct, size = 48, strokeWidth = 3 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const color = completionColor(pct);

  return (
    <svg width={size} height={size} className="flex-shrink-0">
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none"
        stroke="var(--border-subtle)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-all duration-500"
      />
      <text
        x={size / 2} y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontSize={size < 40 ? 9 : 11}
        fontWeight="700"
      >
        {pct}%
      </text>
    </svg>
  );
}

function MiniProgressBar({ pct, label }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-[var(--text-quaternary)] w-14 truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-[var(--border-subtle)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: completionColor(pct) }}
        />
      </div>
      <span className="text-[10px] font-medium w-7 text-right" style={{ color: completionColor(pct) }}>
        {pct}%
      </span>
    </div>
  );
}

function KanbanCard({ deal, assessment, onClick }) {
  const ownerNames = (deal.ownerIds || [])
    .map(id => TEAM_MAP[id])
    .filter(Boolean);

  const overall = getOverallCompletion(assessment);

  // Extract short company name from deal name (e.g. "Imperia - Series A" → "Imperia")
  const shortName = deal.name?.split(' - ')[0] || deal.name || 'Unknown';
  const roundInfo = deal.name?.split(' - ').slice(1).join(' - ') || '';

  return (
    <div
      onClick={onClick}
      className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-3 cursor-pointer hover:border-[var(--rrw-red)] hover:shadow-[var(--shadow-md)] transition-all group"
    >
      {/* Header */}
      <div className="flex items-start gap-2.5 mb-2.5">
        <div className="w-7 h-7 rounded bg-[var(--bg-tertiary)] flex items-center justify-center text-[11px] font-bold text-[var(--text-tertiary)] flex-shrink-0 mt-0.5">
          {shortName.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-[13px] text-[var(--text-primary)] truncate leading-tight">
            {shortName}
          </div>
          {roundInfo && (
            <div className="text-[10px] text-[var(--text-quaternary)] mt-0.5 truncate">
              {roundInfo}
            </div>
          )}
          {ownerNames.length > 0 && (
            <div className="text-[10px] text-[var(--text-quaternary)] mt-0.5">
              {ownerNames.join(', ')}
            </div>
          )}
        </div>
        {/* Overall completion gauge */}
        <GaugeRing pct={overall} size={36} strokeWidth={2.5} />
      </div>

      {/* Mini progress bars per assessment theme */}
      <div className="space-y-1">
        {ASSESSMENT_THEMES.map(theme => {
          const pct = getThemeCompletion(assessment?.[theme.id], theme.id);
          return (
            <MiniProgressBar
              key={theme.id}
              pct={pct}
              label={`${theme.icon} ${theme.label.split(' / ')[0].split(' ')[0]}`}
            />
          );
        })}
      </div>

      {/* Amount if available */}
      {deal.amountInMeu != null && deal.amountInMeu > 0 && (
        <div className="mt-2 pt-2 border-t border-[var(--border-subtle)] text-[10px] text-[var(--text-quaternary)]">
          Round size: <span className="font-medium text-[var(--text-secondary)]">{deal.amountInMeu}M€</span>
        </div>
      )}
    </div>
  );
}

function KanbanColumn({ stage, deals, assessments, onCardClick }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
        <h4 className="text-[13px] font-semibold text-[var(--text-primary)]">{stage.label}</h4>
        <span className="text-[11px] text-[var(--text-quaternary)] bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded-md">
          {deals.length}
        </span>
      </div>
      <div className="space-y-2.5 min-h-[100px]">
        {deals.map(d => (
          <KanbanCard
            key={d.id}
            deal={d}
            assessment={assessments[d.id]}
            onClick={() => onCardClick(d)}
          />
        ))}
        {deals.length === 0 && (
          <div className="text-center py-8 text-[11px] text-[var(--text-quaternary)] border border-dashed border-[var(--border-subtle)] rounded-lg">
            No deals at this stage
          </div>
        )}
      </div>
    </div>
  );
}

function AssessmentField({ field, value, onChange }) {
  if (field.type === 'rating') {
    return (
      <div>
        <label className="text-[11px] font-medium text-[var(--text-tertiary)] block mb-2">{field.label}</label>
        <div className="flex gap-1 flex-wrap">
          {ratingOptions.map(n => (
            <button
              key={n}
              onClick={() => onChange(value === n ? null : n)}
              className={`rating-btn ${value === n ? 'selected' : ''}`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="text-[11px] font-medium text-[var(--text-tertiary)] block mb-1">{field.label}</label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--rrw-red)]"
      >
        <option value="">Select...</option>
        {field.options.map(o => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

function AssessmentModal({ deal, assessment, onUpdate, onClose }) {
  const [activeTheme, setActiveTheme] = useState(ASSESSMENT_THEMES[0].id);

  const currentTheme = ASSESSMENT_THEMES.find(t => t.id === activeTheme);
  const themeData = assessment?.[activeTheme] || {};
  const overall = getOverallCompletion(assessment);

  const ownerNames = (deal.ownerIds || [])
    .map(id => TEAM_MAP[id])
    .filter(Boolean);

  const kanbanCol = KANBAN_STAGES.find(s => s.id === getKanbanColumn(deal));

  const handleFieldChange = (fieldId, value) => {
    onUpdate(deal.id, activeTheme, fieldId, value);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--bg-primary)] rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-4 p-5 border-b border-[var(--border-default)]">
          <div className="w-10 h-10 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center text-lg font-bold text-[var(--text-tertiary)]">
            {(deal.name?.split(' - ')[0] || 'D').charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] truncate">{deal.name}</h2>
            <div className="flex items-center gap-3 mt-0.5">
              {kanbanCol && (
                <span className="text-[11px] px-2 py-0.5 rounded-md font-medium text-white" style={{ backgroundColor: kanbanCol.color }}>
                  {kanbanCol.label}
                </span>
              )}
              {deal.satus && deal.satus !== kanbanCol?.label && (
                <span className="text-[11px] text-[var(--text-quaternary)]">
                  {deal.satus}
                </span>
              )}
              {ownerNames.length > 0 && (
                <span className="text-[12px] text-[var(--text-tertiary)]">
                  {ownerNames.join(', ')}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Overall gauge */}
            <GaugeRing pct={overall} size={52} strokeWidth={3.5} />
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)]"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Theme gauge summary row */}
        <div className="flex items-center justify-center gap-6 py-3 px-5 bg-[var(--bg-secondary)] border-b border-[var(--border-default)]">
          {ASSESSMENT_THEMES.map(theme => {
            const pct = getThemeCompletion(assessment?.[theme.id], theme.id);
            return (
              <button
                key={theme.id}
                onClick={() => setActiveTheme(theme.id)}
                className={`flex flex-col items-center gap-1 transition-all ${
                  activeTheme === theme.id ? 'scale-110' : 'opacity-70 hover:opacity-100'
                }`}
              >
                <GaugeRing pct={pct} size={40} strokeWidth={2.5} />
                <span className={`text-[9px] font-medium ${
                  activeTheme === theme.id ? 'text-[var(--text-primary)]' : 'text-[var(--text-quaternary)]'
                }`}>
                  {theme.icon} {theme.label.split(' / ')[0].split(' ')[0]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Theme tabs */}
        <div className="flex border-b border-[var(--border-default)] px-5 gap-1 overflow-x-auto">
          {ASSESSMENT_THEMES.map(theme => {
            const pct = getThemeCompletion(assessment?.[theme.id], theme.id);
            return (
              <button
                key={theme.id}
                onClick={() => setActiveTheme(theme.id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-medium whitespace-nowrap border-b-2 transition-all ${
                  activeTheme === theme.id
                    ? 'border-[var(--rrw-red)] text-[var(--text-primary)]'
                    : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                }`}
              >
                <span>{theme.icon}</span>
                <span>{theme.label}</span>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                  style={{
                    backgroundColor: pct > 0 ? completionColor(pct) + '20' : 'var(--bg-tertiary)',
                    color: pct > 0 ? completionColor(pct) : 'var(--text-quaternary)',
                  }}
                >
                  {pct}%
                </span>
              </button>
            );
          })}
        </div>

        {/* Theme content */}
        <div className="flex-1 overflow-y-auto p-5">
          {currentTheme && (
            <div className="grid grid-cols-2 gap-4">
              {currentTheme.fields.map(field => (
                <div key={field.id} className={field.type === 'rating' ? 'col-span-2' : ''}>
                  <AssessmentField
                    field={field}
                    value={themeData[field.id]}
                    onChange={(val) => handleFieldChange(field.id, val)}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Deal metadata footer */}
          <div className="mt-6 pt-4 border-t border-[var(--border-default)]">
            <div className="grid grid-cols-3 gap-4 text-[12px]">
              {deal.amountInMeu != null && deal.amountInMeu > 0 && (
                <div>
                  <span className="text-[var(--text-quaternary)] block mb-1">Round size</span>
                  <span className="text-[var(--text-secondary)] font-semibold">{deal.amountInMeu}M€</span>
                </div>
              )}
              {deal.sourceType && (
                <div>
                  <span className="text-[var(--text-quaternary)] block mb-1">Source</span>
                  <span className="text-[var(--text-secondary)]">{deal.sourceType}</span>
                </div>
              )}
              {deal.foundingTeam && (
                <div>
                  <span className="text-[var(--text-quaternary)] block mb-1">Founding team</span>
                  <span className="text-[var(--text-secondary)]">{deal.foundingTeam}</span>
                </div>
              )}
              {deal.maxStatus5 && (
                <div>
                  <span className="text-[var(--text-quaternary)] block mb-1">Max status</span>
                  <span className="text-[var(--text-secondary)]">{deal.maxStatus5}</span>
                </div>
              )}
              {deal.createdAt && (
                <div>
                  <span className="text-[var(--text-quaternary)] block mb-1">Created</span>
                  <span className="text-[var(--text-secondary)]">{deal.createdAt}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────
export default function DealAnalysis({ meetingRatings, setMeetingRatings, showToast }) {
  const { dealFlowData, loading, isLive } = useAttioCompanies();
  const [assessments, setAssessments] = useLocalStorage('deal-assessments', {});
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [selectedMeeting, setSelectedMeeting] = useState(null);

  // Show only active pipeline deals (Met, Committee) — the deals we're actively working on
  const activeDeals = useMemo(() => {
    if (!dealFlowData?.deals) return [];
    return dealFlowData.deals
      .filter(d => ACTIVE_SATUS.has(d.satus) || COLUMN_OVERRIDES[d.id])
      .filter(d => ownerFilter === 'all' || (d.ownerIds || []).includes(ownerFilter))
      .map(d => ({
        ...d,
        kanbanColumn: getKanbanColumn(d),
      }));
  }, [dealFlowData, ownerFilter]);

  // Group by kanban stage
  const dealsByStage = useMemo(() => {
    const grouped = {};
    KANBAN_STAGES.forEach(s => { grouped[s.id] = []; });
    activeDeals.forEach(d => {
      if (grouped[d.kanbanColumn]) grouped[d.kanbanColumn].push(d);
    });
    // Sort within each column by completion desc
    Object.keys(grouped).forEach(stageId => {
      grouped[stageId].sort((a, b) => {
        return getOverallCompletion(assessments[b.id]) - getOverallCompletion(assessments[a.id]);
      });
    });
    return grouped;
  }, [activeDeals, assessments]);

  // Update a single field in an assessment
  const handleAssessmentUpdate = useCallback((dealId, themeId, fieldId, value) => {
    setAssessments(prev => {
      const current = prev[dealId] || emptyAssessment();
      return {
        ...prev,
        [dealId]: {
          ...current,
          [themeId]: {
            ...current[themeId],
            [fieldId]: value,
          },
        },
      };
    });
  }, [setAssessments]);

  const rateMeeting = (id, rating) => {
    setMeetingRatings({ ...meetingRatings, [id]: rating });
    showToast(`Rated ${rating}/10`);
  };

  const handleRefresh = () => {
    showToast('Syncing with Granola...');
    setTimeout(() => showToast('Meetings synced!'), 1000);
  };

  if (loading && !dealFlowData) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[var(--rrw-red)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-[var(--text-tertiary)] text-sm">Loading deal flow data from Attio...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Status */}
      {isLive && (
        <div className="flex items-center justify-end mb-2 gap-2">
          <span className="text-[11px] text-[var(--text-quaternary)]">
            {activeDeals.length} active deals
          </span>
          {loading && <span className="text-[11px] text-[var(--rrw-red)]">Syncing...</span>}
        </div>
      )}

      <div className="grid grid-cols-5 gap-4">
        {/* ─── LEFT: Kanban Board (4 cols) ─────────────────── */}
        <div className="col-span-4">
          {/* Filter bar */}
          <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-3 mb-4">
            <div className="flex items-center gap-4">
              <div>
                <label className="text-[11px] font-medium text-[var(--text-tertiary)] block mb-1">Owner</label>
                <select
                  value={ownerFilter}
                  onChange={(e) => setOwnerFilter(e.target.value)}
                  className="px-3 py-1.5 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--rrw-red)]"
                >
                  <option value="all">Everyone</option>
                  {TEAM_MEMBERS.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div className="ml-auto flex items-center gap-6">
                {KANBAN_STAGES.map(stage => {
                  const count = dealsByStage[stage.id]?.length || 0;
                  return (
                    <div key={stage.id} className="text-center">
                      <div className="text-lg font-bold text-[var(--text-primary)]">{count}</div>
                      <div className="text-[10px] text-[var(--text-quaternary)]">{stage.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Kanban columns */}
          <div className="flex gap-4">
            {KANBAN_STAGES.map(stage => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                deals={dealsByStage[stage.id] || []}
                assessments={assessments}
                onCardClick={setSelectedDeal}
              />
            ))}
          </div>
        </div>

        {/* ─── RIGHT: Calls + Stats sidebar ─────────────────── */}
        <div className="col-span-1 space-y-4">
          {/* Assessment Progress */}
          <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-4">
            <h3 className="font-semibold text-[13px] text-[var(--text-primary)] mb-3">Assessment Progress</h3>
            <div className="space-y-2">
              {KANBAN_STAGES.map(stage => {
                const deals = dealsByStage[stage.id] || [];
                const avgCompletion = deals.length > 0
                  ? Math.round(deals.reduce((sum, d) => sum + getOverallCompletion(assessments[d.id]), 0) / deals.length)
                  : 0;
                return (
                  <div key={stage.id}>
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-[var(--text-tertiary)]">{stage.label}</span>
                      <span className="font-semibold" style={{ color: completionColor(avgCompletion) }}>
                        {avgCompletion}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-[var(--border-subtle)] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${avgCompletion}%`, backgroundColor: completionColor(avgCompletion) }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Calls */}
          <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-[13px] text-[var(--text-primary)]">Recent Calls</h3>
              <button
                onClick={handleRefresh}
                className="h-7 px-2 flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] bg-[var(--bg-primary)] border border-[var(--border-default)] hover:bg-[var(--bg-hover)] rounded-md transition-all"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
                Sync
              </button>
            </div>
            <div className="space-y-1">
              {granolaMeetings.map(meeting => {
                const savedRating = meetingRatings[meeting.id] || meeting.rating;
                return (
                  <div
                    key={meeting.id}
                    className="p-2 rounded-md hover:bg-[var(--bg-hover)] cursor-pointer transition-colors"
                    onClick={() => setSelectedMeeting(meeting)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12px] font-medium text-[var(--text-primary)] truncate flex-1 mr-2">
                        {meeting.title}
                      </span>
                      {savedRating && (
                        <span className="text-[11px] font-bold" style={{ color: savedRating >= 7 ? '#10B981' : savedRating >= 4 ? '#F59E0B' : '#EF4444' }}>
                          {savedRating}/10
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-[var(--text-quaternary)]">
                      {meeting.attendees.slice(0, 2).join(', ')} · {meeting.date}
                    </div>
                    {meeting.company && (
                      <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 text-[10px] font-medium">
                        {meeting.company}
                      </span>
                    )}
                    {/* Compact rating row */}
                    <div className="flex gap-0.5 mt-1.5" onClick={(e) => e.stopPropagation()}>
                      {ratingOptions.map(n => (
                        <button
                          key={n}
                          onClick={() => rateMeeting(meeting.id, n)}
                          className={`w-5 h-5 text-[9px] rounded flex items-center justify-center transition-all ${
                            savedRating === n
                              ? 'bg-[var(--rrw-red)] text-white font-bold'
                              : 'bg-[var(--bg-tertiary)] text-[var(--text-quaternary)] hover:bg-[var(--bg-hover)]'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Assessment Modal ──────────────────────────── */}
      {selectedDeal && (
        <AssessmentModal
          deal={selectedDeal}
          assessment={assessments[selectedDeal.id] || emptyAssessment()}
          onUpdate={handleAssessmentUpdate}
          onClose={() => setSelectedDeal(null)}
        />
      )}

      {/* ─── Meeting Detail Modal ──────────────────────── */}
      <Modal isOpen={!!selectedMeeting} onClose={() => setSelectedMeeting(null)}>
        {selectedMeeting && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">{selectedMeeting.title}</h2>
              <button onClick={() => setSelectedMeeting(null)} className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4 mb-6">
              <div className="flex gap-4">
                <span className="text-[var(--text-tertiary)] w-24 text-[13px]">Date</span>
                <span className="font-medium text-[var(--text-primary)] text-[13px]">{selectedMeeting.date}</span>
              </div>
              <div className="flex gap-4">
                <span className="text-[var(--text-tertiary)] w-24 text-[13px]">Attendees</span>
                <span className="text-[var(--text-primary)] text-[13px]">{selectedMeeting.attendees.join(', ')}</span>
              </div>
              {selectedMeeting.company && (
                <div className="flex gap-4">
                  <span className="text-[var(--text-tertiary)] w-24 text-[13px]">Company</span>
                  <span className="px-2 py-1 rounded-md bg-blue-500/10 text-blue-500 text-[11px] font-medium">
                    {selectedMeeting.company}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={() => setSelectedMeeting(null)}
              className="w-full h-10 bg-[var(--rrw-red)] text-white rounded-lg font-medium hover:bg-[var(--rrw-red-hover)] transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
