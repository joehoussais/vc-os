export default function LPPipeline() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">LP Fundraising Pipeline</h2>
          <p className="text-sm text-gray-500">Weighted pipeline for Fund III</p>
        </div>
        <span className="px-3 py-1 rounded-md bg-amber-100 text-amber-700 text-sm font-medium">Coming Soon</span>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-5 cursor-pointer hover:border-[#E63424] hover:shadow-md transition-all">
          <div className="text-sm text-gray-500">Pipeline Total</div>
          <div className="text-2xl font-bold text-gray-900">€120M</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5 cursor-pointer hover:border-[#E63424] hover:shadow-md transition-all">
          <div className="text-sm text-gray-500">Weighted Pipeline</div>
          <div className="text-2xl font-bold text-[#E63424]">€45M</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5 cursor-pointer hover:border-[#E63424] hover:shadow-md transition-all">
          <div className="text-sm text-gray-500">Committed</div>
          <div className="text-2xl font-bold text-emerald-600">€28M</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5 cursor-pointer hover:border-[#E63424] hover:shadow-md transition-all">
          <div className="text-sm text-gray-500">Target</div>
          <div className="text-2xl font-bold text-gray-900">€100M</div>
        </div>
      </div>

      <div className="text-center py-12 text-gray-400">
        <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
        <p className="text-lg font-medium">LP Pipeline integration coming soon</p>
        <p className="text-sm mt-2">Connect to Attio CRM for weighted pipeline tracking</p>
      </div>
    </div>
  );
}
