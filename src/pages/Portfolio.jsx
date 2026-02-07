import { useState, useMemo } from 'react';
import { portfolioData } from '../data/mockData';
import Modal from '../components/Modal';

function getRunwayColor(months) {
  if (months <= 6) return { dot: 'bg-red-500', border: 'border-red-500/30', text: 'text-red-500' };
  if (months <= 12) return { dot: 'bg-amber-500', border: 'border-amber-500/30', text: 'text-amber-500' };
  return { dot: 'bg-emerald-500', border: 'border-emerald-500/30', text: 'text-emerald-500' };
}

export default function Portfolio() {
  const [sortBy, setSortBy] = useState('runway-asc');
  const [filterBy, setFilterBy] = useState('all');
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);

  // Build team member breakdown from board data
  const teamBreakdown = useMemo(() => {
    const byMember = {};

    portfolioData.forEach(company => {
      (company.boardMembers || []).forEach(bm => {
        if (!byMember[bm.name]) {
          byMember[bm.name] = { companies: [], totalInvested: 0, boardSeats: 0, observerSeats: 0 };
        }
        byMember[bm.name].companies.push({
          name: company.name,
          invested: company.invested || 0,
          role: bm.role,
          ownership: company.ownership,
        });
        byMember[bm.name].totalInvested += company.invested || 0;
        if (bm.role === 'board') byMember[bm.name].boardSeats++;
        else if (bm.role === 'observer') byMember[bm.name].observerSeats++;
      });
    });

    return Object.entries(byMember)
      .sort((a, b) => b[1].totalInvested - a[1].totalInvested);
  }, []);

  const totalInvested = portfolioData.reduce((sum, c) => sum + (c.invested || 0), 0);
  const totalBoardSeats = portfolioData.reduce((sum, c) => sum + (c.boardMembers || []).filter(bm => bm.role === 'board').length, 0);
  const totalObserverSeats = portfolioData.reduce((sum, c) => sum + (c.boardMembers || []).filter(bm => bm.role === 'observer').length, 0);
  const companiesWithSeat = portfolioData.filter(c => (c.boardMembers || []).length > 0).length;

  let displayedData = [...portfolioData];

  // Filter by selected team member
  if (selectedMember) {
    displayedData = displayedData.filter(c =>
      (c.boardMembers || []).some(bm => bm.name === selectedMember)
    );
  }

  if (filterBy === 'us-active') displayedData = displayedData.filter(c => c.usExpansion === 'active');
  else if (filterBy === 'us-planned') displayedData = displayedData.filter(c => c.usExpansion === 'planned');
  else if (filterBy === 'eu-only') displayedData = displayedData.filter(c => c.usExpansion === 'none');
  else if (filterBy === 'critical') displayedData = displayedData.filter(c => c.runway <= 6);
  else if (filterBy === 'at-risk') displayedData = displayedData.filter(c => c.runway <= 6 && !c.canRaise);

  if (sortBy === 'runway-asc') displayedData.sort((a, b) => a.runway - b.runway);
  else if (sortBy === 'runway-desc') displayedData.sort((a, b) => b.runway - a.runway);
  else if (sortBy === 'ownership') displayedData.sort((a, b) => (b.ownership || 0) - (a.ownership || 0));

  const criticalCount = portfolioData.filter(c => c.runway <= 6).length;
  const atRiskCount = portfolioData.filter(c => c.runway <= 6 && !c.canRaise).length;
  const avgOwnership = portfolioData.reduce((sum, c) => sum + (c.ownership || 0), 0) / portfolioData.filter(c => c.ownership).length;

  return (
    <div>
      {/* Summary Stats + Team Sidebar Row */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        {/* Left 3 cols: Summary stats */}
        <div className="col-span-3 grid grid-cols-4 gap-4">
          <div
            onClick={() => setFilterBy(filterBy === 'critical' ? 'all' : 'critical')}
            className={`bg-[var(--bg-primary)] border rounded-lg p-5 cursor-pointer transition-all ${
              filterBy === 'critical' ? 'border-[var(--rrw-red)] shadow-[var(--shadow-md)]' : 'border-[var(--border-default)] hover:border-[var(--rrw-red)] hover:shadow-[var(--shadow-md)]'
            }`}
          >
            <div className="text-[13px] text-[var(--text-tertiary)] mb-1">Critical Runway</div>
            <div className="text-2xl font-bold text-red-500">{criticalCount}</div>
            <div className="text-[11px] text-[var(--text-quaternary)]">≤ 6 months</div>
          </div>
          <div
            onClick={() => setFilterBy(filterBy === 'at-risk' ? 'all' : 'at-risk')}
            className={`bg-[var(--bg-primary)] border rounded-lg p-5 cursor-pointer transition-all ${
              filterBy === 'at-risk' ? 'border-[var(--rrw-red)] shadow-[var(--shadow-md)]' : 'border-[var(--border-default)] hover:border-[var(--rrw-red)] hover:shadow-[var(--shadow-md)]'
            }`}
          >
            <div className="text-[13px] text-[var(--text-tertiary)] mb-1">At Risk</div>
            <div className="text-2xl font-bold text-amber-500">{atRiskCount}</div>
            <div className="text-[11px] text-[var(--text-quaternary)]">No destiny control</div>
          </div>
          <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5 cursor-pointer hover:border-[var(--rrw-red)] hover:shadow-[var(--shadow-md)] transition-all">
            <div className="text-[13px] text-[var(--text-tertiary)] mb-1">Total Invested</div>
            <div className="text-2xl font-bold text-[var(--text-primary)]">€{totalInvested.toFixed(1)}M</div>
            <div className="text-[11px] text-[var(--text-quaternary)]">Across {portfolioData.length} companies</div>
          </div>
          <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5 cursor-pointer hover:border-[var(--rrw-red)] hover:shadow-[var(--shadow-md)] transition-all">
            <div className="text-[13px] text-[var(--text-tertiary)] mb-1">Avg Ownership</div>
            <div className="text-2xl font-bold text-[var(--text-primary)]">{avgOwnership.toFixed(1)}%</div>
            <div className="text-[11px] text-[var(--text-quaternary)]">Fully diluted</div>
          </div>
        </div>

        {/* Right col: Board Governance summary */}
        <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5">
          <div className="text-[13px] text-[var(--text-tertiary)] mb-1">Board Governance</div>
          <div className="text-2xl font-bold text-[var(--text-primary)]">{totalBoardSeats + totalObserverSeats}</div>
          <div className="text-[11px] text-[var(--text-quaternary)]">
            {totalBoardSeats} seats · {totalObserverSeats} observers · {companiesWithSeat}/{portfolioData.length} cos
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="h-9 px-3 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--rrw-red)]"
          >
            <option value="runway-asc">Shortest Runway</option>
            <option value="runway-desc">Longest Runway</option>
            <option value="ownership">Highest Ownership</option>
          </select>
          <select
            value={filterBy}
            onChange={(e) => setFilterBy(e.target.value)}
            className="h-9 px-3 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--rrw-red)]"
          >
            <option value="all">All Companies</option>
            <option value="us-active">US Active</option>
            <option value="us-planned">US Planned</option>
            <option value="eu-only">EU Only</option>
          </select>
          {selectedMember && (
            <button
              onClick={() => setSelectedMember(null)}
              className="h-9 px-3 bg-[var(--rrw-red-subtle)] border border-[var(--rrw-red)] rounded-lg text-[13px] text-[var(--rrw-red)] font-medium flex items-center gap-1.5"
            >
              {selectedMember}
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-[var(--text-tertiary)]">≤6mo</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
            <span className="text-[var(--text-tertiary)]">6-12mo</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
            <span className="text-[var(--text-tertiary)]">&gt;12mo</span>
          </div>
        </div>
      </div>

      {/* Main Content: Grid + Sidebar */}
      <div className="grid grid-cols-4 gap-4">
        {/* Company Grid (3 cols) */}
        <div className="col-span-3 grid grid-cols-3 gap-4">
          {displayedData.map(company => {
            const colors = getRunwayColor(company.runway);
            const trend = company.runwayTrend === 'up' ? '↑' : company.runwayTrend === 'down' ? '↓' : '→';
            const trendColor = company.runwayTrend === 'up' ? 'text-emerald-500' : company.runwayTrend === 'down' ? 'text-red-500' : 'text-[var(--text-quaternary)]';
            const boardMembers = company.boardMembers || [];

            return (
              <div
                key={company.id}
                onClick={() => setSelectedCompany(company)}
                className={`bg-[var(--bg-primary)] rounded-lg p-4 border-2 ${colors.border} cursor-pointer hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5 transition-all`}
              >
                <div className="flex justify-between mb-3">
                  <div>
                    <div className="font-semibold text-[var(--text-primary)]">{company.name}</div>
                    <div className="text-[11px] text-[var(--text-tertiary)]">{company.sector} · {company.stage}</div>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${colors.dot}`}></div>
                </div>
                <div className="bg-[var(--bg-tertiary)] rounded-lg p-3 mb-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-[var(--text-tertiary)]">Runway</span>
                    <span className={`${colors.text} text-xl font-bold`}>
                      {company.runway}mo <span className={trendColor}>{trend}</span>
                    </span>
                  </div>
                  <div className="text-[11px] text-[var(--text-quaternary)] mt-1">€{company.cashPosition}M · €{company.burn}M/mo</div>
                </div>
                <div className="space-y-2 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-[var(--text-tertiary)]">Ownership</span>
                    <span className="font-medium text-[var(--text-primary)]">{company.ownership ? company.ownership + '%' : '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-tertiary)]">Invested</span>
                    <span className="font-medium text-[var(--text-primary)]">{company.invested ? '€' + company.invested + 'M' : '—'}</span>
                  </div>
                  {boardMembers.length > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--text-tertiary)]">Board</span>
                      <div className="flex items-center gap-1">
                        {boardMembers.map((bm, i) => (
                          <span
                            key={i}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              bm.role === 'board'
                                ? 'bg-[var(--rrw-red-subtle)] text-[var(--rrw-red)]'
                                : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]'
                            }`}
                          >
                            {bm.name}{bm.role === 'observer' ? ' (obs)' : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Sidebar: Team Members */}
        <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5 self-start">
          <h3 className="font-semibold text-[var(--text-primary)] mb-4">By Team Member</h3>
          <div className="space-y-3">
            {teamBreakdown.map(([name, data]) => (
              <div
                key={name}
                onClick={() => setSelectedMember(selectedMember === name ? null : name)}
                className={`cursor-pointer rounded-lg p-2.5 -mx-1 transition-all ${
                  selectedMember === name
                    ? 'bg-[var(--rrw-red-subtle)] ring-1 ring-[var(--rrw-red)]'
                    : 'hover:bg-[var(--bg-hover)]'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[13px] text-[var(--text-secondary)] font-medium">{name}</span>
                  <span className="text-[13px] font-bold text-[var(--text-primary)]">
                    €{data.totalInvested.toFixed(1)}M
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="flex-1 h-1.5 bg-[var(--border-subtle)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${totalInvested > 0 ? (data.totalInvested / totalInvested) * 100 : 0}%`,
                        backgroundColor: 'var(--rrw-red)',
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-[var(--text-quaternary)] w-8 text-right">
                    {totalInvested > 0 ? Math.round((data.totalInvested / totalInvested) * 100) : 0}%
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-[var(--text-quaternary)]">
                  {data.boardSeats > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-[var(--rrw-red-subtle)] text-[var(--rrw-red)] font-medium">
                      {data.boardSeats} seat{data.boardSeats > 1 ? 's' : ''}
                    </span>
                  )}
                  {data.observerSeats > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] font-medium">
                      {data.observerSeats} obs
                    </span>
                  )}
                  <span>{data.companies.length} co{data.companies.length > 1 ? 's' : ''}</span>
                </div>
                {/* Company list for this member */}
                <div className="mt-2 space-y-1">
                  {data.companies.map((co, i) => (
                    <div key={i} className="flex items-center justify-between text-[11px]">
                      <span className="text-[var(--text-tertiary)] truncate flex-1 mr-2">{co.name}</span>
                      <span className="text-[var(--text-secondary)] font-medium whitespace-nowrap">
                        {co.invested > 0 ? `€${co.invested}M` : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Companies without board representation */}
          <div className="border-t border-[var(--border-default)] pt-4 mt-4">
            <h4 className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2">No Board Seat</h4>
            <div className="space-y-1">
              {portfolioData.filter(c => (c.boardMembers || []).length === 0).map(c => (
                <div key={c.id} className="flex items-center justify-between text-[11px]">
                  <span className="text-[var(--text-quaternary)]">{c.name}</span>
                  <span className="text-[var(--text-quaternary)]">
                    {c.invested ? `€${c.invested}M` : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Company Modal */}
      <Modal isOpen={!!selectedCompany} onClose={() => setSelectedCompany(null)}>
        {selectedCompany && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">{selectedCompany.name}</h2>
                <p className="text-[13px] text-[var(--text-tertiary)]">{selectedCompany.sector} · {selectedCompany.stage}</p>
              </div>
              <button onClick={() => setSelectedCompany(null)} className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="bg-[var(--bg-tertiary)] rounded-lg p-4 mb-6">
              <div className="flex justify-between">
                <div>
                  <span className="text-[13px] text-[var(--text-tertiary)]">Runway</span>
                  <div className={`${getRunwayColor(selectedCompany.runway).text} text-3xl font-bold`}>
                    {selectedCompany.runway} months
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
                <div className="text-[11px] text-[var(--text-tertiary)]">Cash</div>
                <div className="text-xl font-bold text-[var(--text-primary)]">€{selectedCompany.cashPosition}M</div>
              </div>
              <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
                <div className="text-[11px] text-[var(--text-tertiary)]">Burn</div>
                <div className="text-xl font-bold text-[var(--text-primary)]">€{selectedCompany.burn}M/mo</div>
              </div>
              <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
                <div className="text-[11px] text-[var(--text-tertiary)]">Ownership</div>
                <div className="text-xl font-bold text-[var(--text-primary)]">{selectedCompany.ownership || '—'}%</div>
              </div>
              <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
                <div className="text-[11px] text-[var(--text-tertiary)]">Invested</div>
                <div className="text-xl font-bold text-[var(--text-primary)]">€{selectedCompany.invested || '—'}M</div>
              </div>
            </div>

            {/* Board representation in modal */}
            {(selectedCompany.boardMembers || []).length > 0 && (
              <div className="bg-[var(--bg-tertiary)] rounded-lg p-4 mb-6">
                <div className="text-[11px] text-[var(--text-tertiary)] mb-2">Board Representation</div>
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedCompany.boardMembers.map((bm, i) => (
                    <span
                      key={i}
                      className={`px-2.5 py-1 rounded-lg text-[12px] font-medium ${
                        bm.role === 'board'
                          ? 'bg-[var(--rrw-red-subtle)] text-[var(--rrw-red)]'
                          : 'bg-[var(--bg-primary)] text-[var(--text-tertiary)] border border-[var(--border-default)]'
                      }`}
                    >
                      {bm.name} — {bm.role === 'board' ? 'Board Seat' : 'Observer'}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setSelectedCompany(null)}
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
