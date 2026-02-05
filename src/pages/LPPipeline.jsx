export default function LPPipeline() {
  return (
    <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">LP Fundraising Pipeline</h2>
          <p className="text-sm text-[var(--text-tertiary)]">Weighted pipeline for Fund III</p>
        </div>
        <span className="px-3 py-1 rounded-md bg-amber-500/10 text-amber-500 text-sm font-medium">Coming Soon</span>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5 cursor-pointer hover:border-[var(--rrw-red)] hover:shadow-[var(--shadow-md)] transition-all">
          <div className="text-sm text-[var(--text-tertiary)]">Pipeline Total</div>
          <div className="text-2xl font-bold text-[var(--text-primary)]">€120M</div>
        </div>
        <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5 cursor-pointer hover:border-[var(--rrw-red)] hover:shadow-[var(--shadow-md)] transition-all">
          <div className="text-sm text-[var(--text-tertiary)]">Weighted Pipeline</div>
          <div className="text-2xl font-bold text-[var(--rrw-red)]">€45M</div>
        </div>
        <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5 cursor-pointer hover:border-[var(--rrw-red)] hover:shadow-[var(--shadow-md)] transition-all">
          <div className="text-sm text-[var(--text-tertiary)]">Committed</div>
          <div className="text-2xl font-bold text-emerald-500">€28M</div>
        </div>
        <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5 cursor-pointer hover:border-[var(--rrw-red)] hover:shadow-[var(--shadow-md)] transition-all">
          <div className="text-sm text-[var(--text-tertiary)]">Target</div>
          <div className="text-2xl font-bold text-[var(--text-primary)]">€100M</div>
        </div>
      </div>

      <div className="text-center py-12 text-[var(--text-quaternary)]">
        <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
        <p className="text-lg font-medium text-[var(--text-tertiary)]">LP Pipeline integration coming soon</p>
        <p className="text-sm mt-2">Connect to Attio CRM for weighted pipeline tracking</p>
      </div>
    </div>
  );
}
