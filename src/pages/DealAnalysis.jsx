import { useState } from 'react';
import { granolaMeetings } from '../data/mockData';
import Modal from '../components/Modal';

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
    <div>
      {/* Recent Calls from Granola */}
      <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-[var(--text-primary)]">Recent Calls</h3>
            <p className="text-xs text-[var(--text-tertiary)]">Rate your meetings from Granola (1-10, no 5s allowed)</p>
          </div>
          <button
            onClick={handleRefresh}
            className="h-9 px-3 flex items-center gap-2 text-[13px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] bg-[var(--bg-primary)] border border-[var(--border-default)] hover:bg-[var(--bg-hover)] rounded-lg transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            Refresh from Granola
          </button>
        </div>
        <div className="border border-[var(--border-default)] rounded-lg overflow-hidden">
          {granolaMeetings.map(meeting => {
            const savedRating = meetingRatings[meeting.id] || meeting.rating;
            return (
              <div
                key={meeting.id}
                className="flex items-center p-3 border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] cursor-pointer transition-colors"
                onClick={() => setSelectedMeeting(meeting)}
              >
                <div className="flex-1">
                  <div className="font-medium text-[var(--text-primary)]">{meeting.title}</div>
                  <div className="text-[11px] text-[var(--text-tertiary)]">
                    {meeting.attendees.slice(0, 2).join(', ')} · {meeting.date}
                  </div>
                </div>
                {meeting.company && (
                  <span className="px-2 py-1 rounded-md bg-blue-500/10 text-blue-500 text-[11px] font-medium mr-4">
                    {meeting.company}
                  </span>
                )}
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  {ratingOptions.map(n => (
                    <button
                      key={n}
                      onClick={() => rateMeeting(meeting.id, n)}
                      className={`rating-btn ${savedRating === n ? 'selected' : ''}`}
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
      <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-[var(--text-primary)]">Active Assessments</h3>
          <button className="h-9 px-3 bg-[var(--rrw-red)] text-white rounded-lg text-[13px] font-medium hover:bg-[var(--rrw-red-hover)] transition-colors">
            + New Assessment
          </button>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 border-2 border-blue-500/50 rounded-lg bg-blue-500/10 cursor-pointer hover:shadow-[var(--shadow-md)] transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-[var(--text-primary)]">Quiet.app</span>
              <span className="bg-blue-500 text-white text-[11px] px-2 py-0.5 rounded">Tier 2</span>
            </div>
            <div className="text-[13px] text-[var(--text-secondary)]">AI Publishing Platform</div>
            <div className="flex items-center justify-between mt-3">
              <div className="text-[11px] text-[var(--text-tertiary)]">65% complete</div>
              <div className="text-lg font-bold text-blue-500">7/10</div>
            </div>
          </div>
          <div className="p-4 border border-[var(--border-default)] rounded-lg hover:border-[var(--border-strong)] cursor-pointer hover:shadow-[var(--shadow-md)] transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-[var(--text-primary)]">Upciti</span>
              <span className="bg-amber-500 text-white text-[11px] px-2 py-0.5 rounded">Tier 3</span>
            </div>
            <div className="text-[13px] text-[var(--text-secondary)]">Smart City IoT</div>
            <div className="flex items-center justify-between mt-3">
              <div className="text-[11px] text-[var(--text-tertiary)]">40% complete</div>
              <div className="text-lg font-bold text-amber-500">6/10</div>
            </div>
          </div>
          <div className="p-4 border border-[var(--border-default)] rounded-lg hover:border-[var(--border-strong)] cursor-pointer hover:shadow-[var(--shadow-md)] transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-[var(--text-primary)]">RMG Minerals</span>
              <span className="bg-[var(--text-quaternary)] text-white text-[11px] px-2 py-0.5 rounded">Pending</span>
            </div>
            <div className="text-[13px] text-[var(--text-secondary)]">Mining Analytics</div>
            <div className="flex items-center justify-between mt-3">
              <div className="text-[11px] text-[var(--text-tertiary)]">10% complete</div>
              <div className="text-lg font-bold text-[var(--text-quaternary)]">—</div>
            </div>
          </div>
        </div>
      </div>

      {/* Founder Assessment Cards */}
      <div className="grid grid-cols-3 gap-4">
        {/* Response Speed */}
        <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5">
          <h4 className="font-semibold text-[var(--text-primary)] mb-4">Response Speed</h4>
          <div className="space-y-4">
            <div>
              <label className="text-[11px] font-medium text-[var(--text-tertiary)] block mb-1">Initial response</label>
              <select
                value={assessmentForm.initialResponse}
                onChange={(e) => setAssessmentForm({ ...assessmentForm, initialResponse: e.target.value })}
                className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--rrw-red)]"
              >
                <option value="">Select...</option>
                <option value="<1hour">&lt; 1 hour</option>
                <option value="<24hours">&lt; 24 hours</option>
                <option value="2-3days">2-3 days</option>
                <option value=">3days">&gt; 3 days</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-[var(--text-tertiary)] block mb-1">Typical reply</label>
              <select
                value={assessmentForm.typicalReply}
                onChange={(e) => setAssessmentForm({ ...assessmentForm, typicalReply: e.target.value })}
                className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--rrw-red)]"
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
        <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5">
          <h4 className="font-semibold text-[var(--text-primary)] mb-4">First Call</h4>
          <div className="space-y-4">
            <div>
              <label className="text-[11px] font-medium text-[var(--text-tertiary)] block mb-1">Came prepared?</label>
              <select
                value={assessmentForm.camePrepared}
                onChange={(e) => setAssessmentForm({ ...assessmentForm, camePrepared: e.target.value })}
                className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--rrw-red)]"
              >
                <option value="">Select...</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-[var(--text-tertiary)] block mb-1">Curveball handling</label>
              <select
                value={assessmentForm.curveball}
                onChange={(e) => setAssessmentForm({ ...assessmentForm, curveball: e.target.value })}
                className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--rrw-red)]"
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
        <div className="bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-5">
          <h4 className="font-semibold text-[var(--text-primary)] mb-4">Gut Check</h4>
          <div className="space-y-4">
            <div>
              <label className="text-[11px] font-medium text-[var(--text-tertiary)] block mb-1">Work with them 10 years?</label>
              <select
                value={assessmentForm.tenYears}
                onChange={(e) => setAssessmentForm({ ...assessmentForm, tenYears: e.target.value })}
                className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--rrw-red)]"
              >
                <option value="">Select...</option>
                <option value="yes">Yes</option>
                <option value="unsure">Unsure</option>
                <option value="no">No</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-[var(--text-tertiary)] block mb-2">Gut score (1-10, no 5)</label>
              <div className="flex gap-1 flex-wrap">
                {ratingOptions.map(n => (
                  <button
                    key={n}
                    onClick={() => setAssessmentForm({ ...assessmentForm, gutScore: n })}
                    className={`rating-btn ${assessmentForm.gutScore === n ? 'selected' : ''}`}
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
