import { useState, useMemo, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import { useAttioCompanies } from '../hooks/useAttioCompanies';
import { TEAM_MEMBERS, TEAM_MAP } from '../data/team';
import { useLocalStorage } from '../hooks/useLocalStorage';
import {
  ASSESSMENT_THEMES, KANBAN_STAGES, ACTIVE_SATUS, REQUIRED_CALLS,
  PLACEHOLDER_CALLS, INITIAL_OVERRIDES, SELECT_SCORE_MAP,
} from '../data/assessmentSchema';
import {
  getRealFields, emptyAssessment, getThemeCompletion, getOverallCompletion,
  getThemeScore, getOverallScore, scoreColor, completionColor,
  getKanbanColumn, getDealCalls,
} from '../services/scoring';

// ─── Theme icons (inline SVGs, no emojis) ────────────────────────────
const THEME_ICONS = {
  founder: (sz = 16) => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  ),
  market: (sz = 16) => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10A15.3 15.3 0 0112 2z" />
    </svg>
  ),
  product: (sz = 16) => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
    </svg>
  ),
  traction: (sz = 16) => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
  deal: (sz = 16) => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </svg>
  ),
  legal: (sz = 16) => (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" /><path d="M12 8v4l3 3" />
      <path d="M3.5 12H2m20 0h-1.5M12 3.5V2m0 20v-1.5" />
    </svg>
  ),
};

// ASSESSMENT_THEMES, KANBAN_STAGES, ACTIVE_SATUS, REQUIRED_CALLS,
// PLACEHOLDER_CALLS, INITIAL_OVERRIDES, SELECT_SCORE_MAP
// → imported from '../data/assessmentSchema'
//
// getRealFields, emptyAssessment, getThemeCompletion, getOverallCompletion,
// getThemeScore, getOverallScore, scoreColor, completionColor,
// getKanbanColumn, getDealCalls
// → imported from '../services/scoring'

// ratingOptions used locally in AssessmentModal
const ratingOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// ─── Components ──────────────────────────────────────────────────────

// NOTE: THEME_ICONS intentionally kept inline — JSX cannot be extracted to a data file
// {THEME_ICONS object is above}

function GaugeRing({ pct, size = 48, strokeWidth = 3 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const color = completionColor(pct);

  return (
    <svg width={size} height={size} className="flex-shrink-0">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border-subtle)" strokeWidth={strokeWidth} />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-all duration-500"
      />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central" fill={color} fontSize={size < 40 ? 9 : 11} fontWeight="700">
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
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: completionColor(pct) }} />
      </div>
      <span className="text-[10px] font-medium w-7 text-right" style={{ color: completionColor(pct) }}>{pct}%</span>
    </div>
  );
}

// ─── Draggable Card ──────────────────────────────────────────────────
function DraggableKanbanCard({ deal, assessment, onClick }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id: deal.id, data: { deal } });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 50 : 'auto',
    position: 'relative',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <KanbanCardContent deal={deal} assessment={assessment} onClick={onClick} isDragging={isDragging} />
    </div>
  );
}

function KanbanCardContent({ deal, assessment, onClick, isDragging }) {
  const ownerNames = (deal.ownerIds || []).map(id => TEAM_MAP[id]).filter(Boolean);
  const overall = getOverallCompletion(assessment);
  const shortName = deal.name?.split(' - ')[0] || deal.name || 'Unknown';
  const roundInfo = deal.name?.split(' - ').slice(1).join(' - ') || '';

  return (
    <div
      onClick={isDragging ? undefined : onClick}
      className={`bg-[var(--bg-primary)] border rounded-lg p-3 transition-all select-none ${
        isDragging
          ? 'border-[var(--rrw-red)] shadow-lg shadow-[var(--rrw-red)]/20 ring-2 ring-[var(--rrw-red)]/30'
          : 'border-[var(--border-default)] cursor-pointer hover:border-[var(--rrw-red)] hover:shadow-[var(--shadow-md)]'
      }`}
    >
      <div className="flex items-start gap-2.5 mb-2.5">
        {deal.domain ? (
          <img
            src={`https://www.google.com/s2/favicons?domain=${deal.domain}&sz=64`}
            alt=""
            className="w-7 h-7 rounded flex-shrink-0 mt-0.5 bg-[var(--bg-tertiary)]"
            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
          />
        ) : null}
        <div
          className="w-7 h-7 rounded bg-[var(--bg-tertiary)] items-center justify-center text-[11px] font-bold text-[var(--text-tertiary)] flex-shrink-0 mt-0.5"
          style={{ display: deal.domain ? 'none' : 'flex' }}
        >
          {shortName.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-[13px] text-[var(--text-primary)] truncate leading-tight">{shortName}</div>
          {roundInfo && <div className="text-[10px] text-[var(--text-quaternary)] mt-0.5 truncate">{roundInfo}</div>}
          {ownerNames.length > 0 && <div className="text-[10px] text-[var(--text-quaternary)] mt-0.5">{ownerNames.join(', ')}</div>}
        </div>
        <GaugeRing pct={overall} size={36} strokeWidth={2.5} />
      </div>
      <div className="space-y-1">
        {ASSESSMENT_THEMES.map(theme => {
          const pct = getThemeCompletion(assessment?.[theme.id], theme.id);
          return <MiniProgressBar key={theme.id} pct={pct} label={theme.label.split(' & ')[0].split(',')[0]} />;
        })}
      </div>
      {deal.amountInMeu != null && deal.amountInMeu > 0 && (
        <div className="mt-2 pt-2 border-t border-[var(--border-subtle)] text-[10px] text-[var(--text-quaternary)]">
          Round size: <span className="font-medium text-[var(--text-secondary)]">{deal.amountInMeu}M€</span>
        </div>
      )}
    </div>
  );
}

// ─── Droppable Column ────────────────────────────────────────────────
function DroppableColumn({ stage, dealIds, allDeals, assessments, onCardClick }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const deals = dealIds.map(id => allDeals.find(d => d.id === id)).filter(Boolean);

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
        <h4 className="text-[13px] font-semibold text-[var(--text-primary)]">{stage.label}</h4>
        <span className="text-[11px] text-[var(--text-quaternary)] bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded-md">{deals.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`space-y-2.5 min-h-[120px] rounded-lg p-1.5 transition-all duration-200 ${
          isOver ? 'bg-[var(--rrw-red)]/5 ring-2 ring-[var(--rrw-red)]/20' : ''
        }`}
      >
        {deals.map(d => (
          <DraggableKanbanCard
            key={d.id}
            deal={d}
            assessment={assessments[d.id]}
            onClick={() => onCardClick(d)}
          />
        ))}
        {deals.length === 0 && (
          <div className={`text-center py-8 text-[11px] border border-dashed rounded-lg transition-colors ${
            isOver
              ? 'text-[var(--rrw-red)] border-[var(--rrw-red)]/40 bg-[var(--rrw-red)]/5'
              : 'text-[var(--text-quaternary)] border-[var(--border-subtle)]'
          }`}>
            {isOver ? 'Drop here' : 'No deals at this stage'}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Assessment Modal ────────────────────────────────────────────────
function AssessmentField({ field, value, onChange }) {
  if (field.type === 'section') {
    return (
      <div className="col-span-2 mt-4 mb-1 first:mt-0">
        <h4 className="text-[12px] font-bold text-[var(--text-secondary)] uppercase tracking-wider border-b border-[var(--border-subtle)] pb-1.5">{field.label}</h4>
      </div>
    );
  }
  if (field.type === 'check') {
    return (
      <label className="flex items-start gap-2.5 cursor-pointer group col-span-2 py-1">
        <div className="relative flex-shrink-0 mt-0.5">
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
          <div className="w-4.5 h-4.5 w-[18px] h-[18px] rounded border-2 border-[var(--border-default)] peer-checked:border-[var(--rrw-red)] peer-checked:bg-[var(--rrw-red)] transition-all flex items-center justify-center group-hover:border-[var(--rrw-red)]/50">
            {value && (
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            )}
          </div>
        </div>
        <span className={`text-[12px] leading-snug transition-colors ${value ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]'}`}>{field.label}</span>
      </label>
    );
  }
  if (field.type === 'rating') {
    return (
      <div className="col-span-2 mt-1">
        <label className="text-[11px] font-medium text-[var(--text-tertiary)] block mb-2">{field.label}</label>
        <div className="flex gap-1 flex-wrap">
          {ratingOptions.map(n => (
            <button key={n} onClick={() => onChange(value === n ? null : n)} className={`rating-btn ${value === n ? 'selected' : ''}`}>{n}</button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div>
      <label className="text-[11px] font-medium text-[var(--text-tertiary)] block mb-1">{field.label}</label>
      <select value={value || ''} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--rrw-red)]">
        <option value="">Select...</option>
        {field.options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function ScoreBadge({ score, label }) {
  return (
    <div className="flex flex-col items-center">
      <div className="text-[18px] font-bold" style={{ color: scoreColor(score) }}>
        {score != null ? score.toFixed(1) : '—'}
      </div>
      <div className="text-[9px] text-[var(--text-quaternary)] uppercase tracking-wider">{label}</div>
    </div>
  );
}

const CALL_TYPE_COLORS = {
  Founder: { bg: 'rgba(139, 92, 246, 0.1)', fg: '#8B5CF6' },
  Product: { bg: 'rgba(59, 130, 246, 0.1)', fg: '#3B82F6' },
  Reference: { bg: 'rgba(16, 185, 129, 0.1)', fg: '#10B981' },
  Market: { bg: 'rgba(245, 158, 11, 0.1)', fg: '#F59E0B' },
  Financials: { bg: 'rgba(239, 68, 68, 0.1)', fg: '#EF4444' },
  GTM: { bg: 'rgba(236, 72, 153, 0.1)', fg: '#EC4899' },
  Deal: { bg: 'rgba(99, 102, 241, 0.1)', fg: '#6366F1' },
  Legal: { bg: 'rgba(107, 114, 128, 0.1)', fg: '#6B7280' },
};

function CallTypeTag({ type }) {
  const c = CALL_TYPE_COLORS[type] || { bg: 'var(--bg-tertiary)', fg: 'var(--text-tertiary)' };
  return (
    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide" style={{ backgroundColor: c.bg, color: c.fg }}>{type}</span>
  );
}

function AssessmentModal({ deal, assessment, onUpdate, onClose, columnOverrides, meetingRatings, onRateMeeting }) {
  const [activeTheme, setActiveTheme] = useState(ASSESSMENT_THEMES[0].id);
  const currentTheme = ASSESSMENT_THEMES.find(t => t.id === activeTheme);
  const themeData = assessment?.[activeTheme] || {};
  const overall = getOverallCompletion(assessment);
  const overallScore = getOverallScore(assessment);
  const ownerNames = (deal.ownerIds || []).map(id => TEAM_MAP[id]).filter(Boolean);
  const kanbanCol = KANBAN_STAGES.find(s => s.id === getKanbanColumn(deal, columnOverrides));
  const dealCalls = getDealCalls(deal.name);

  const handleFieldChange = (fieldId, value) => onUpdate(deal.id, activeTheme, fieldId, value);

  // Count total checks done and total
  const totalChecks = ASSESSMENT_THEMES.reduce((sum, t) => sum + getRealFields(t).filter(f => f.type === 'check').length, 0);
  const doneChecks = ASSESSMENT_THEMES.reduce((sum, t) => {
    const d = assessment?.[t.id] || {};
    return sum + getRealFields(t).filter(f => f.type === 'check' && d[f.id] === true).length;
  }, 0);

  // Average call rating for this deal
  const ratedCalls = dealCalls.filter(c => meetingRatings?.[c.id] != null);
  const avgCallRating = ratedCalls.length > 0 ? Math.round((ratedCalls.reduce((s, c) => s + meetingRatings[c.id], 0) / ratedCalls.length) * 10) / 10 : null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop — only closes on direct click, not drag/accidental */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} />

      {/* Modal container — 3-panel layout */}
      <div className="relative bg-[var(--bg-primary)] rounded-xl shadow-2xl flex overflow-hidden" style={{ width: 'min(1320px, calc(100vw - 48px))', height: 'min(85vh, 820px)' }}>

        {/* ─── Left sidebar: nav + scores ─── */}
        <div className="w-[220px] flex-shrink-0 bg-[var(--bg-secondary)] border-r border-[var(--border-default)] flex flex-col">
          {/* Company header */}
          <div className="p-4 border-b border-[var(--border-default)]">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center text-sm font-bold text-[var(--text-tertiary)] overflow-hidden flex-shrink-0">
                {deal.domain ? (
                  <img src={`https://www.google.com/s2/favicons?domain=${deal.domain}&sz=64`} alt="" className="w-8 h-8 object-contain" />
                ) : (deal.name?.split(' - ')[0] || 'D').charAt(0)}
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{deal.name?.split(' - ')[0] || deal.name}</div>
                {kanbanCol && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium text-white inline-block mt-0.5" style={{ backgroundColor: kanbanCol.color }}>{kanbanCol.label}</span>
                )}
              </div>
            </div>
            {/* Overall stats */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <GaugeRing pct={overall} size={40} strokeWidth={3} />
                <div>
                  <div className="text-[16px] font-bold" style={{ color: scoreColor(overallScore) }}>{overallScore != null ? overallScore.toFixed(1) : '—'}</div>
                  <div className="text-[9px] text-[var(--text-quaternary)] uppercase">Score</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[12px] font-semibold text-[var(--text-secondary)]">{doneChecks}/{totalChecks}</div>
                <div className="text-[9px] text-[var(--text-quaternary)]">checks</div>
              </div>
            </div>
          </div>

          {/* Theme nav buttons */}
          <div className="flex-1 overflow-y-auto py-1.5">
            {ASSESSMENT_THEMES.map(theme => {
              const pct = getThemeCompletion(assessment?.[theme.id], theme.id);
              const thScore = getThemeScore(assessment?.[theme.id], theme.id);
              const isActive = activeTheme === theme.id;
              return (
                <button
                  key={theme.id}
                  onClick={() => setActiveTheme(theme.id)}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-left transition-colors ${
                    isActive
                      ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] border-r-2 border-[var(--rrw-red)]'
                      : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  <span className="flex-shrink-0 text-[var(--text-quaternary)]">{THEME_ICONS[theme.icon]?.(14)}</span>
                  <div className="flex-1 min-w-0">
                    <div className={`text-[11px] font-medium truncate ${isActive ? 'text-[var(--text-primary)]' : ''}`}>{theme.label}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex-1 h-1 bg-[var(--border-subtle)] rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: completionColor(pct) }} />
                      </div>
                      <span className="text-[9px] font-semibold w-7 text-right" style={{ color: completionColor(pct) }}>{pct}%</span>
                    </div>
                  </div>
                  {thScore != null && (
                    <span className="text-[11px] font-bold flex-shrink-0" style={{ color: scoreColor(thScore) }}>{thScore.toFixed(1)}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Deal metadata at sidebar bottom */}
          <div className="p-3 border-t border-[var(--border-default)] space-y-1.5">
            {deal.amountInMeu != null && deal.amountInMeu > 0 && (
              <div className="flex justify-between text-[10px]"><span className="text-[var(--text-quaternary)]">Round</span><span className="text-[var(--text-secondary)] font-medium">{deal.amountInMeu}M€</span></div>
            )}
            {ownerNames.length > 0 && (
              <div className="flex justify-between text-[10px]"><span className="text-[var(--text-quaternary)]">Owner</span><span className="text-[var(--text-secondary)] font-medium truncate ml-2">{ownerNames.join(', ')}</span></div>
            )}
            {deal.maxStatus5 && (
              <div className="flex justify-between text-[10px]"><span className="text-[var(--text-quaternary)]">Status</span><span className="text-[var(--text-secondary)] font-medium">{deal.maxStatus5}</span></div>
            )}
          </div>
        </div>

        {/* ─── Center: scoring content area ─── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Content header with theme name + close button */}
          <div className="flex items-center justify-between px-6 py-3.5 border-b border-[var(--border-default)] flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-tertiary)]">{THEME_ICONS[currentTheme?.icon]?.(20)}</span>
              <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">{currentTheme?.label}</h3>
              {(() => {
                const pct = getThemeCompletion(assessment?.[activeTheme], activeTheme);
                return (
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: pct > 0 ? completionColor(pct) + '15' : 'var(--bg-tertiary)', color: pct > 0 ? completionColor(pct) : 'var(--text-quaternary)' }}>
                    {pct}% complete
                  </span>
                );
              })()}
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Scrollable fields */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {currentTheme && (
              <div className="grid grid-cols-2 gap-x-5 gap-y-1">
                {currentTheme.fields.map(field => (
                  <AssessmentField key={field.id} field={field} value={themeData[field.id]} onChange={(val) => handleFieldChange(field.id, val)} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ─── Right panel: calls timeline ─── */}
        {(() => {
          // Required calls for the active theme
          const themeRequired = REQUIRED_CALLS.filter(rc => rc.theme === activeTheme);
          // Which required calls are fulfilled by completed calls
          const fulfilledIds = new Set(dealCalls.map(c => c.requiredCallId).filter(Boolean));
          // Completed calls for this theme (matched by requiredCallId theme, or by type match)
          const themeCalls = dealCalls.filter(c => {
            if (c.requiredCallId) {
              const rc = REQUIRED_CALLS.find(r => r.id === c.requiredCallId);
              return rc?.theme === activeTheme;
            }
            return false;
          });
          // Ad-hoc calls: completed calls not linked to any required call for this theme
          // (We show all calls in "All calls" section below the required ones)
          const doneCount = themeRequired.filter(rc => fulfilledIds.has(rc.id)).length;
          const totalRequired = themeRequired.length;

          return (
            <div className="w-[260px] flex-shrink-0 bg-[var(--bg-secondary)] border-l border-[var(--border-default)] flex flex-col">
              {/* Calls header */}
              <div className="px-4 py-3 border-b border-[var(--border-default)]">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-quaternary)]">
                      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                    </svg>
                    <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">DD Calls</h3>
                  </div>
                  <span className="text-[10px] text-[var(--text-quaternary)] bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded-md">{dealCalls.length} total</span>
                </div>
                {avgCallRating != null && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[10px] text-[var(--text-quaternary)]">Avg rating</span>
                    <span className="text-[12px] font-bold" style={{ color: avgCallRating >= 7 ? '#10B981' : avgCallRating >= 4 ? '#F59E0B' : '#EF4444' }}>{avgCallRating}/10</span>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto">
                {/* ── Required calls for this theme ── */}
                {themeRequired.length > 0 && (
                  <div className="px-3 pt-3 pb-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">Required</span>
                      <span className="text-[10px] font-semibold" style={{ color: doneCount === totalRequired ? '#10B981' : doneCount > 0 ? '#F59E0B' : 'var(--text-quaternary)' }}>
                        {doneCount}/{totalRequired}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {themeRequired.map(rc => {
                        const fulfilled = fulfilledIds.has(rc.id);
                        const linkedCall = fulfilled ? dealCalls.find(c => c.requiredCallId === rc.id) : null;
                        const rating = linkedCall ? meetingRatings?.[linkedCall.id] : null;
                        return (
                          <div key={rc.id} className={`rounded-lg p-2 transition-colors ${fulfilled ? 'bg-[var(--bg-primary)]' : 'bg-[var(--bg-secondary)] border border-dashed border-[var(--border-default)]'}`}>
                            <div className="flex items-start gap-2">
                              {/* Check circle */}
                              <div className={`w-[16px] h-[16px] rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center ${fulfilled ? 'bg-[#10B981]' : 'border-2 border-[var(--border-default)]'}`}>
                                {fulfilled && (
                                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className={`text-[11px] font-medium leading-tight ${fulfilled ? 'text-[var(--text-primary)]' : 'text-[var(--text-quaternary)]'}`}>
                                  {rc.label}
                                </div>
                                {fulfilled && linkedCall && (
                                  <div className="mt-1">
                                    <div className="text-[10px] text-[var(--text-quaternary)] truncate">{linkedCall.title}</div>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <span className="text-[9px] text-[var(--text-quaternary)]">{linkedCall.date}</span>
                                      {rating != null && (
                                        <span className="text-[10px] font-bold" style={{ color: rating >= 7 ? '#10B981' : rating >= 4 ? '#F59E0B' : '#EF4444' }}>{rating}/10</span>
                                      )}
                                    </div>
                                    {/* Inline rating */}
                                    <div className="flex gap-0.5 mt-1">
                                      {ratingOptions.map(n => (
                                        <button
                                          key={n}
                                          onClick={() => onRateMeeting(linkedCall.id, n)}
                                          className={`w-[17px] h-[17px] text-[8px] rounded flex items-center justify-center transition-all ${
                                            rating === n
                                              ? 'bg-[var(--rrw-red)] text-white font-bold'
                                              : 'bg-[var(--bg-tertiary)] text-[var(--text-quaternary)] hover:bg-[var(--bg-hover)]'
                                          }`}
                                        >
                                          {n}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {!fulfilled && (
                                  <div className="text-[9px] text-[var(--text-quaternary)] mt-0.5 italic">Not yet scheduled</div>
                                )}
                              </div>
                              <CallTypeTag type={rc.type} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── All completed calls timeline ── */}
                <div className="px-3 pt-3 pb-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">All completed</span>
                    <span className="text-[10px] text-[var(--text-quaternary)]">{dealCalls.length} calls</span>
                  </div>
                  {dealCalls.length === 0 ? (
                    <div className="py-4 text-center">
                      <p className="text-[10px] text-[var(--text-quaternary)]">No calls recorded yet</p>
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      {dealCalls.map((call, idx) => {
                        const rating = meetingRatings?.[call.id];
                        // Highlight calls that belong to the active theme
                        const rc = call.requiredCallId ? REQUIRED_CALLS.find(r => r.id === call.requiredCallId) : null;
                        const isThemeCall = rc?.theme === activeTheme;
                        return (
                          <div key={call.id} className={`relative pl-5 ${isThemeCall ? '' : 'opacity-50'}`}>
                            {/* Timeline line */}
                            {idx < dealCalls.length - 1 && (
                              <div className="absolute left-[7px] top-[18px] bottom-0 w-px bg-[var(--border-subtle)]" />
                            )}
                            {/* Timeline dot */}
                            <div className="absolute left-0 top-[6px] w-[15px] h-[15px] rounded-full border-2 flex items-center justify-center" style={{ borderColor: rating != null ? (rating >= 7 ? '#10B981' : rating >= 4 ? '#F59E0B' : '#EF4444') : 'var(--border-default)', backgroundColor: rating != null ? (rating >= 7 ? '#10B98115' : rating >= 4 ? '#F59E0B15' : '#EF444415') : 'var(--bg-primary)' }}>
                              {rating != null && <div className="w-[5px] h-[5px] rounded-full" style={{ backgroundColor: rating >= 7 ? '#10B981' : rating >= 4 ? '#F59E0B' : '#EF4444' }} />}
                            </div>
                            <div className="pb-2.5 pt-0.5">
                              <div className="flex items-start justify-between gap-1 mb-0.5">
                                <span className="text-[11px] font-medium text-[var(--text-primary)] leading-tight">{call.title}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-[var(--text-quaternary)]">{call.date}</span>
                                <CallTypeTag type={call.type} />
                                {rating != null && (
                                  <span className="text-[10px] font-bold ml-auto" style={{ color: rating >= 7 ? '#10B981' : rating >= 4 ? '#F59E0B' : '#EF4444' }}>{rating}/10</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────
export default function DealAnalysis({ meetingRatings, setMeetingRatings, showToast }) {
  const { dealFlowData, loading, isLive } = useAttioCompanies();
  const [assessments, setAssessments] = useLocalStorage('deal-assessments', {});
  const [columnOverrides, setColumnOverrides] = useLocalStorage('deal-column-overrides', INITIAL_OVERRIDES);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [activeDragId, setActiveDragId] = useState(null);

  // Merge initial overrides with any persisted ones
  const mergedOverrides = useMemo(() => ({ ...INITIAL_OVERRIDES, ...columnOverrides }), [columnOverrides]);

  // DnD sensors — distance threshold prevents accidental drags when clicking
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Active pipeline deals
  const activeDeals = useMemo(() => {
    if (!dealFlowData?.deals) return [];
    return dealFlowData.deals
      .filter(d => ACTIVE_SATUS.has(d.satus) || mergedOverrides[d.id])
      .filter(d => ownerFilter === 'all' || (d.ownerIds || []).includes(ownerFilter))
      .map(d => ({ ...d, kanbanColumn: getKanbanColumn(d, mergedOverrides) }));
  }, [dealFlowData, ownerFilter, mergedOverrides]);

  // Group deal IDs by stage
  const dealIdsByStage = useMemo(() => {
    const grouped = {};
    KANBAN_STAGES.forEach(s => { grouped[s.id] = []; });
    activeDeals.forEach(d => {
      if (grouped[d.kanbanColumn]) grouped[d.kanbanColumn].push(d.id);
    });
    // Sort by assessment completion desc
    Object.keys(grouped).forEach(stageId => {
      grouped[stageId].sort((a, b) =>
        getOverallCompletion(assessments[b]) - getOverallCompletion(assessments[a])
      );
    });
    return grouped;
  }, [activeDeals, assessments]);

  const activeDragDeal = activeDragId ? activeDeals.find(d => d.id === activeDragId) : null;

  // Find which column a deal ID is in
  function findColumn(dealId) {
    for (const [stageId, ids] of Object.entries(dealIdsByStage)) {
      if (ids.includes(dealId)) return stageId;
    }
    return null;
  }

  function handleDragStart(event) {
    setActiveDragId(event.active.id);
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    setActiveDragId(null);

    if (!over) return;

    const dealId = active.id;
    const sourceCol = findColumn(dealId);

    // The over.id is the droppable column ID (met, analysis, committee)
    const stageIds = new Set(KANBAN_STAGES.map(s => s.id));
    const targetCol = stageIds.has(over.id) ? over.id : null;
    if (!targetCol || targetCol === sourceCol) return;

    // Persist the column override
    setColumnOverrides(prev => ({ ...prev, [dealId]: targetCol }));
    const targetLabel = KANBAN_STAGES.find(s => s.id === targetCol)?.label;
    showToast?.(`Moved to ${targetLabel}`);
  }

  function handleDragCancel() {
    setActiveDragId(null);
  }

  // Assessment updates
  const handleAssessmentUpdate = useCallback((dealId, themeId, fieldId, value) => {
    setAssessments(prev => {
      const current = prev[dealId] || emptyAssessment();
      return {
        ...prev,
        [dealId]: {
          ...current,
          [themeId]: { ...current[themeId], [fieldId]: value },
        },
      };
    });
  }, [setAssessments]);

  const rateMeeting = (id, rating) => {
    setMeetingRatings({ ...meetingRatings, [id]: rating });
    showToast(`Rated ${rating}/10`);
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
      {isLive && (
        <div className="flex items-center justify-end mb-2 gap-2">
          <span className="text-[11px] text-[var(--text-quaternary)]">{activeDeals.length} active deals</span>
          {loading && <span className="text-[11px] text-[var(--rrw-red)]">Syncing...</span>}
        </div>
      )}

      <div>
        {/* Filter bar */}
        <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-3 mb-4">
          <div className="flex items-center gap-4">
            <div>
              <label className="text-[11px] font-medium text-[var(--text-tertiary)] block mb-1">Owner</label>
              <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} className="px-3 py-1.5 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--rrw-red)]">
                <option value="all">Everyone</option>
                {TEAM_MEMBERS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div className="ml-auto flex items-center gap-6">
              {KANBAN_STAGES.map(stage => (
                <div key={stage.id} className="text-center">
                  <div className="text-lg font-bold text-[var(--text-primary)]">{dealIdsByStage[stage.id]?.length || 0}</div>
                  <div className="text-[10px] text-[var(--text-quaternary)]">{stage.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Kanban columns with DnD */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="flex gap-4">
            {KANBAN_STAGES.map(stage => (
              <DroppableColumn
                key={stage.id}
                stage={stage}
                dealIds={dealIdsByStage[stage.id] || []}
                allDeals={activeDeals}
                assessments={assessments}
                onCardClick={setSelectedDeal}
              />
            ))}
          </div>

          {/* Drag overlay — floating card while dragging */}
          <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
            {activeDragDeal && (
              <div className="w-[280px]">
                <KanbanCardContent
                  deal={activeDragDeal}
                  assessment={assessments[activeDragDeal.id]}
                  onClick={() => {}}
                  isDragging={true}
                />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Assessment Modal */}
      {selectedDeal && (
        <AssessmentModal
          deal={selectedDeal}
          assessment={assessments[selectedDeal.id] || emptyAssessment()}
          onUpdate={handleAssessmentUpdate}
          onClose={() => setSelectedDeal(null)}
          columnOverrides={mergedOverrides}
          meetingRatings={meetingRatings}
          onRateMeeting={rateMeeting}
        />
      )}
    </div>
  );
}
