import { useState } from 'react';
import { granolaMeetings } from '../data/mockData';
import Modal from '../components/Modal';

// No 5s allowed in ratings
const ratingOptions = [1, 2, 3, 4, 6, 7, 8, 9, 10];

export default function DealAnalysis({ meetingRatings, setMeetingRatings, showToast }) {
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [assessmentForm, setAssessmentForm] = useState({
    initialResponse: '',
    typicalReply: '',
    camePrepared: '',
    curveball: '',
    tenYears: '',
    gutScore: null
  });

  const rateMeeting = (id, rating) => {
    setMeetingRatings({ ...meetingRatings, [id]: rating });
    showToast(`Rated ${rating}/10`);
  };

  const handleRefresh = () => {
    showToast('Syncing with Granola...');
    setTimeout(() => showToast('Meetings synced!'), 1000);
  };

  return (
    <div className="animate-in">
      {/* Recent Calls from Granola */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-900">Recent Calls</h3>
            <p className="text-sm text-gray-500">Rate your meetings from Granola (1-10, no 5s allowed)</p>
          </div>
          <button
            onClick={handleRefresh}
            className="bg-white text-gray-700 px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            Refresh from Granola
          </button>
        </div>
        <div className="border rounded-lg overflow-hidden">
          {granolaMeetings.map(meeting => {
            const savedRating = meetingRatings[meeting.id] || meeting.rating;
            return (
              <div
                key={meeting.id}
                className="flex items-center p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => setSelectedMeeting(meeting)}
              >
                <div className="flex-1">
                  <div className="font-medium">{meeting.title}</div>
                  <div className="text-sm text-gray-500">
                    {meeting.attendees.slice(0, 2).join(', ')} · {meeting.date}
                  </div>
                </div>
                {meeting.company && (
                  <span className="px-3 py-1 rounded-md bg-blue-50 text-blue-700 text-sm font-medium mr-4">
                    {meeting.company}
                  </span>
                )}
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  {ratingOptions.map(n => (
                    <button
                      key={n}
                      onClick={() => rateMeeting(meeting.id, n)}
                      className={`w-8 h-8 rounded-md border text-xs font-semibold transition-all ${
                        savedRating === n
                          ? 'bg-[#E63424] border-[#E63424] text-white'
                          : 'border-gray-200 hover:border-[#E63424] hover:text-[#E63424]'
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

      {/* Active Assessments */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Active Assessments</h3>
          <button className="bg-[#E63424] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#C42A1D] transition-colors">
            + New Assessment
          </button>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 border-2 border-blue-500 rounded-xl bg-blue-50 cursor-pointer hover:shadow-lg transition">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold">Quiet.app</span>
              <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">Tier 2</span>
            </div>
            <div className="text-sm text-gray-600">AI Publishing Platform</div>
            <div className="flex items-center justify-between mt-3">
              <div className="text-xs text-gray-500">65% complete</div>
              <div className="text-lg font-bold text-blue-600">7/10</div>
            </div>
          </div>
          <div className="p-4 border rounded-xl hover:border-gray-300 cursor-pointer hover:shadow-lg transition">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold">Upciti</span>
              <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">Tier 3</span>
            </div>
            <div className="text-sm text-gray-600">Smart City IoT</div>
            <div className="flex items-center justify-between mt-3">
              <div className="text-xs text-gray-500">40% complete</div>
              <div className="text-lg font-bold text-amber-600">6/10</div>
            </div>
          </div>
          <div className="p-4 border rounded-xl hover:border-gray-300 cursor-pointer hover:shadow-lg transition">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold">RMG Minerals</span>
              <span className="bg-gray-300 text-white text-xs px-2 py-0.5 rounded-full">Pending</span>
            </div>
            <div className="text-sm text-gray-600">Mining Analytics</div>
            <div className="flex items-center justify-between mt-3">
              <div className="text-xs text-gray-500">10% complete</div>
              <div className="text-lg font-bold text-gray-400">—</div>
            </div>
          </div>
        </div>
      </div>

      {/* Founder Assessment Cards */}
      <div className="grid grid-cols-3 gap-4">
        {/* Response Speed */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Response Speed</h4>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Initial response</label>
              <select
                value={assessmentForm.initialResponse}
                onChange={(e) => setAssessmentForm({ ...assessmentForm, initialResponse: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#E63424]"
              >
                <option value="">Select...</option>
                <option value="<1hour">&lt; 1 hour</option>
                <option value="<24hours">&lt; 24 hours</option>
                <option value="2-3days">2-3 days</option>
                <option value=">3days">&gt; 3 days</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Typical reply</label>
              <select
                value={assessmentForm.typicalReply}
                onChange={(e) => setAssessmentForm({ ...assessmentForm, typicalReply: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#E63424]"
              >
                <option value="">Select...</option>
                <option value="<1hour">&lt; 1 hour</option>
                <option value="<24hours">&lt; 24 hours</option>
                <option value="2-3days">2-3 days</option>
                <option value=">3days">&gt; 3 days</option>
              </select>
            </div>
          </div>
        </div>

        {/* First Call */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h4 className="font-semibold text-gray-900 mb-4">First Call</h4>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Came prepared?</label>
              <select
                value={assessmentForm.camePrepared}
                onChange={(e) => setAssessmentForm({ ...assessmentForm, camePrepared: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#E63424]"
              >
                <option value="">Select...</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Curveball handling</label>
              <select
                value={assessmentForm.curveball}
                onChange={(e) => setAssessmentForm({ ...assessmentForm, curveball: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#E63424]"
              >
                <option value="">Select...</option>
                <option value="exceptional">Exceptional</option>
                <option value="good">Good</option>
                <option value="mediocre">Mediocre</option>
                <option value="poor">Poor</option>
              </select>
            </div>
          </div>
        </div>

        {/* Gut Check */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Gut Check</h4>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Work with them 10 years?</label>
              <select
                value={assessmentForm.tenYears}
                onChange={(e) => setAssessmentForm({ ...assessmentForm, tenYears: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#E63424]"
              >
                <option value="">Select...</option>
                <option value="yes">Yes</option>
                <option value="unsure">Unsure</option>
                <option value="no">No</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-2">Gut score (1-10, no 5)</label>
              <div className="flex gap-1 flex-wrap">
                {ratingOptions.map(n => (
                  <button
                    key={n}
                    onClick={() => setAssessmentForm({ ...assessmentForm, gutScore: n })}
                    className={`w-8 h-8 rounded-full border text-xs font-semibold transition-all ${
                      assessmentForm.gutScore === n
                        ? 'bg-[#E63424] border-[#E63424] text-white'
                        : 'border-gray-200 hover:border-[#E63424] hover:text-[#E63424]'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Meeting Modal */}
      <Modal isOpen={!!selectedMeeting} onClose={() => setSelectedMeeting(null)}>
        {selectedMeeting && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">{selectedMeeting.title}</h2>
              <button onClick={() => setSelectedMeeting(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="space-y-4 mb-6">
              <div className="flex gap-4">
                <span className="text-gray-500 w-24">Date</span>
                <span className="font-medium">{selectedMeeting.date}</span>
              </div>
              <div className="flex gap-4">
                <span className="text-gray-500 w-24">Attendees</span>
                <span>{selectedMeeting.attendees.join(', ')}</span>
              </div>
              {selectedMeeting.company && (
                <div className="flex gap-4">
                  <span className="text-gray-500 w-24">Company</span>
                  <span className="px-3 py-1 rounded-md bg-blue-50 text-blue-700 text-sm font-medium">
                    {selectedMeeting.company}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={() => setSelectedMeeting(null)}
              className="w-full bg-[#E63424] text-white py-3 rounded-lg font-medium hover:bg-[#C42A1D] transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
