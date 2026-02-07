import { useState, useMemo } from 'react';
import { useAttioPortfolio, BOARD_MEMBERS, formatFunding } from '../hooks/useAttioPortfolio';

export default function Portfolio() {
  const { companies, loading, isLive } = useAttioPortfolio();
  const [selectedMember, setSelectedMember] = useState(null);

  // Build team member breakdown from board data
  const teamBreakdown = useMemo(() => {
    const byMember = {};

    companies.forEach(company => {
      (company.boardMembers || []).forEach(bm => {
        if (!byMember[bm.name]) {
          byMember[bm.name] = { companies: [], count: 0, totalFundingRaw: 0 };
        }
        byMember[bm.name].companies.push({
          name: company.name,
          role: bm.role,
          logoUrl: company.logoUrl,
          domain: company.domain,
          totalFunding: company.totalFunding,
        });
        byMember[bm.name].count++;
        if (company.totalFundingRaw) {
          byMember[bm.name].totalFundingRaw += company.totalFundingRaw;
        }
      });
    });

    // Sort by number of companies
    return Object.entries(byMember)
      .sort((a, b) => b[1].count - a[1].count);
  }, [companies]);

  const companiesWithSeat = companies.filter(c => (c.boardMembers || []).length > 0).length;
  const totalBoardSeats = companies.reduce(
    (sum, c) => sum + (c.boardMembers || []).filter(bm => bm.role === 'board').length, 0
  );

  // Filter by selected team member
  const displayedData = useMemo(() => {
    if (!selectedMember) return companies;
    return companies.filter(c =>
      (c.boardMembers || []).some(bm => bm.name === selectedMember)
    );
  }, [companies, selectedMember]);

  // Find color for a board member
  const getMemberColor = (name) => {
    return BOARD_MEMBERS.find(m => m.name === name)?.color || '#6B7280';
  };

  if (loading && companies.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[var(--rrw-red)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-[var(--text-tertiary)] text-sm">Loading portfolio from Attio...</p>
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
            {companies.length} portfolio companies
          </span>
          {loading && <span className="text-[11px] text-[var(--rrw-red)]">Syncing...</span>}
        </div>
      )}

      {/* Summary stats row */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5">
          <div className="text-[13px] text-[var(--text-tertiary)] mb-1">Portfolio Companies</div>
          <div className="text-2xl font-bold text-[var(--text-primary)]">{companies.length}</div>
          <div className="text-[11px] text-[var(--text-quaternary)]">Active investments</div>
        </div>
        <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5">
          <div className="text-[13px] text-[var(--text-tertiary)] mb-1">Board Representation</div>
          <div className="text-2xl font-bold text-[var(--text-primary)]">{totalBoardSeats}</div>
          <div className="text-[11px] text-[var(--text-quaternary)]">{companiesWithSeat}/{companies.length} companies covered</div>
        </div>
        <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5">
          <div className="text-[13px] text-[var(--text-tertiary)] mb-1">Team Members on Boards</div>
          <div className="text-2xl font-bold text-[var(--text-primary)]">{teamBreakdown.length}</div>
          <div className="text-[11px] text-[var(--text-quaternary)]">Partners with board seats</div>
        </div>
      </div>

      {/* Board member filter chips */}
      <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-4 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mr-1">Board Member</span>
          <button
            onClick={() => setSelectedMember(null)}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
              !selectedMember
                ? 'bg-[var(--rrw-red)] text-white'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            All ({companies.length})
          </button>
          {teamBreakdown.map(([name, data]) => {
            const color = getMemberColor(name);
            const isActive = selectedMember === name;
            return (
              <button
                key={name}
                onClick={() => setSelectedMember(isActive ? null : name)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all flex items-center gap-1.5 ${
                  isActive
                    ? 'text-white shadow-sm'
                    : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                }`}
                style={isActive ? { backgroundColor: color } : {}}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                {name}
                <span className={`text-[10px] ${isActive ? 'text-white/70' : 'text-[var(--text-quaternary)]'}`}>
                  {data.count}
                </span>
              </button>
            );
          })}
          {/* No board seat filter */}
          <button
            onClick={() => setSelectedMember('__none__')}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
              selectedMember === '__none__'
                ? 'bg-[var(--text-quaternary)] text-white'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-quaternary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            No seat ({companies.filter(c => (c.boardMembers || []).length === 0).length})
          </button>
        </div>
      </div>

      {/* Main Content: Grid + Sidebar */}
      <div className="grid grid-cols-4 gap-4">
        {/* Company Grid (3 cols) */}
        <div className="col-span-3 grid grid-cols-3 gap-4">
          {(selectedMember === '__none__'
            ? companies.filter(c => (c.boardMembers || []).length === 0)
            : displayedData
          ).map(company => {
            const boardMembers = company.boardMembers || [];

            return (
              <div
                key={company.id}
                className="bg-[var(--bg-primary)] rounded-lg p-4 border border-[var(--border-default)] hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5 transition-all"
              >
                {/* Header with logo */}
                <div className="flex items-start gap-3 mb-3">
                  {company.logoUrl ? (
                    <img
                      src={company.logoUrl}
                      alt={company.name}
                      className="w-10 h-10 rounded-lg object-contain bg-white border border-[var(--border-subtle)] flex-shrink-0"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-quaternary)] text-[13px] font-bold flex-shrink-0">
                      {company.name?.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-[var(--text-primary)] truncate">{company.name}</div>
                    <div className="text-[11px] text-[var(--text-quaternary)] truncate">
                      {company.domain || '—'}
                      {company.location && ` · ${company.location}`}
                    </div>
                  </div>
                </div>

                {/* Description */}
                {company.description && (
                  <p className="text-[11px] text-[var(--text-tertiary)] mb-3 line-clamp-2 leading-relaxed">
                    {company.description}
                  </p>
                )}

                {/* Tags / categories */}
                {company.lastFundingStatus && (
                  <div className="flex items-center gap-2 mb-3 text-[10px]">
                    <span className="px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] font-medium capitalize">
                      {company.lastFundingStatus.replace(/_/g, ' ')}
                    </span>
                    {company.employeeRange && (
                      <span className="text-[var(--text-quaternary)]">
                        {company.employeeRange} employees
                      </span>
                    )}
                  </div>
                )}

                {/* Funding */}
                {company.totalFunding && (
                  <div className="flex justify-between text-[11px] mb-2">
                    <span className="text-[var(--text-tertiary)]">Total Funding</span>
                    <span className="font-medium text-[var(--text-primary)]">{company.totalFunding}</span>
                  </div>
                )}

                {/* Board members */}
                {boardMembers.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-[var(--border-subtle)]">
                    <span className="text-[10px] text-[var(--text-quaternary)] mr-1">Board</span>
                    {boardMembers.map((bm, i) => (
                      <span
                        key={i}
                        className="px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
                        style={{ backgroundColor: getMemberColor(bm.name) }}
                      >
                        {bm.name}{bm.role === 'observer' ? ' (obs)' : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right Sidebar: Team Members */}
        <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5 self-start">
          <h3 className="font-semibold text-[var(--text-primary)] mb-4">By Team Member</h3>
          <div className="space-y-3">
            {teamBreakdown.map(([name, data]) => {
              const color = getMemberColor(name);
              const isActive = selectedMember === name;

              return (
                <div
                  key={name}
                  onClick={() => setSelectedMember(isActive ? null : name)}
                  className={`cursor-pointer rounded-lg p-2.5 -mx-1 transition-all ${
                    isActive
                      ? 'ring-1 shadow-sm'
                      : 'hover:bg-[var(--bg-hover)]'
                  }`}
                  style={isActive ? { backgroundColor: `${color}10`, ringColor: color } : {}}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-[13px] text-[var(--text-secondary)] font-medium">{name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[12px] font-bold text-[var(--text-primary)]">
                        {data.count} co{data.count > 1 ? 's' : ''}
                      </span>
                      {data.totalFundingRaw > 0 && (
                        <div className="text-[10px] text-[var(--text-quaternary)]">
                          {formatFunding(data.totalFundingRaw)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Company list for this member */}
                  <div className="ml-4 space-y-1.5">
                    {data.companies.map((co, i) => (
                      <div key={i} className="flex items-center gap-2 text-[11px]">
                        {co.logoUrl ? (
                          <img
                            src={co.logoUrl}
                            alt=""
                            className="w-4 h-4 rounded object-contain bg-white border border-[var(--border-subtle)] flex-shrink-0"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-4 h-4 rounded bg-[var(--bg-tertiary)] flex items-center justify-center text-[8px] text-[var(--text-quaternary)] flex-shrink-0">
                            {co.name?.charAt(0)}
                          </div>
                        )}
                        <span className="text-[var(--text-tertiary)] truncate flex-1">{co.name}</span>
                        {co.role === 'observer' && (
                          <span className="text-[9px] text-[var(--text-quaternary)]">obs</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Companies without board representation */}
          {companies.filter(c => (c.boardMembers || []).length === 0).length > 0 && (
            <div className="border-t border-[var(--border-default)] pt-4 mt-4">
              <div
                onClick={() => setSelectedMember(selectedMember === '__none__' ? null : '__none__')}
                className={`cursor-pointer rounded-lg p-2.5 -mx-1 transition-all ${
                  selectedMember === '__none__' ? 'bg-[var(--bg-tertiary)]' : 'hover:bg-[var(--bg-hover)]'
                }`}
              >
                <h4 className="text-[11px] font-medium text-[var(--text-quaternary)] uppercase tracking-wider mb-2">No Board Seat</h4>
                <div className="space-y-1.5">
                  {companies.filter(c => (c.boardMembers || []).length === 0).map(c => (
                    <div key={c.id} className="flex items-center gap-2 text-[11px]">
                      {c.logoUrl ? (
                        <img
                          src={c.logoUrl}
                          alt=""
                          className="w-4 h-4 rounded object-contain bg-white border border-[var(--border-subtle)] flex-shrink-0"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-4 h-4 rounded bg-[var(--bg-tertiary)] flex items-center justify-center text-[8px] text-[var(--text-quaternary)] flex-shrink-0">
                          {c.name?.charAt(0)}
                        </div>
                      )}
                      <span className="text-[var(--text-quaternary)] truncate">{c.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
