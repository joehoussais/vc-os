import { useState, useEffect, useCallback } from 'react';
import { fetchAllLPs, getAttrValue, getAttrValues } from '../services/attioApi';

const CACHE_KEY = 'attio-lps-cache';
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Fund definitions — each fund has its own status and amount fields in Attio
export const FUNDS = [
  { id: 'commit', name: '>Commit', statusSlug: 'status_3', amountSlug: 'amount', currency: 'EUR' },
  { id: 'fund3', name: 'Fund III (RRW3)', statusSlug: 'rrw_3_status', amountSlug: 'amount_rrw', currency: 'USD' },
  { id: 'fund2', name: 'Fund II (Historical)', statusSlug: '_fund2', amountSlug: 'amount', currency: 'EUR' },
];

// >Commit pipeline stages (status_3) — ordered for funnel display
export const COMMIT_STAGES = [
  { id: 'contact_to_initiate', name: 'Contact to Initiate', attioValues: ['Contact to initiate'], weight: 0.05 },
  { id: 'existing_contacts', name: 'Existing Contacts', attioValues: ['Existing contacts'], weight: 0.05 },
  { id: 'fund_ii_lp', name: 'Fund II LP', attioValues: ['Fund II LP'], weight: 0.15 },
  { id: 'cold_outreach', name: 'Cold Email / LinkedIn', attioValues: ['Cold e-mail / linkedIn'], weight: 0.05 },
  { id: 'contact_initiated', name: 'Contact Initiated', attioValues: ['Contact initiated'], weight: 0.10 },
  { id: 'waiting_for_answer', name: 'Waiting for Answer', attioValues: ['Waiting for answer'], weight: 0.10 },
  { id: 'first_meeting', name: 'First Meeting', attioValues: ['First meeting'], weight: 0.20 },
  { id: 'second_meeting', name: 'Second Meeting', attioValues: ['Second meeting'], weight: 0.35 },
  { id: 'pause', name: 'Pause', attioValues: ['Pause'], weight: 0.10 },
  { id: 'in_depth', name: 'In-Depth Discussions', attioValues: ['In depth discussions'], weight: 0.50 },
  { id: 'second_closing', name: 'Second Closing Discussions', attioValues: ['Second closing discussions'], weight: 0.70 },
  { id: 'oral_agreement', name: 'Oral Agreement', attioValues: ['Oral agreement (with amount)'], weight: 0.90 },
  { id: 'second_closing_agreement', name: 'Second Closing Agreement', attioValues: ['Second closing agreement'], weight: 0.95 },
  { id: 'declined', name: 'Declined', attioValues: ['Declined'], weight: 0 },
];

// Fund III (RRW3) pipeline stages (rrw_3_status)
// "Interested" is a virtual stage for LPs with rrw_3_7 (Maybe/Yes) but no rrw_3_status yet
export const FUND3_STAGES = [
  { id: 'interested', name: 'Interested (Pre-Pipeline)', attioValues: ['__interested__'], weight: 0.03 },
  { id: 'to_contact', name: 'To Contact', attioValues: ['To contact'], weight: 0.05 },
  { id: 'contact_to_initiate', name: 'Contact to Initiate', attioValues: ['Contact to initiate'], weight: 0.05 },
  { id: 'waiting_for_answer', name: 'Waiting for Answer', attioValues: ['Waiting for answer'], weight: 0.10 },
  { id: 'first_meeting', name: 'First Meeting', attioValues: ['First Meeting'], weight: 0.20 },
  { id: 'second_meeting', name: 'Second Meeting', attioValues: ['Second meeting'], weight: 0.35 },
  { id: 'in_depth', name: 'In-Depth Discussion', attioValues: ['In depth discussion'], weight: 0.50 },
  { id: 'pause', name: 'Pause', attioValues: ['Pause'], weight: 0.10 },
  { id: 'oral_agreement', name: 'Oral Agreement', attioValues: ['Oral agreement'], weight: 0.90 },
  { id: 'declined', name: 'Declined', attioValues: ['__declined__'], weight: 0 },
];

// Fund II — historical/closed fund. Fund II LPs are tagged as "Fund II LP" stage in >Commit.
// We show them in a single "Invested" stage since Fund II is fully deployed.
export const FUND2_STAGES = [
  { id: 'invested', name: 'Fund II Investors', attioValues: ['Fund II LP'], weight: 1.0 },
];

// Team members (same as DealFunnel)
export const LP_TEAM_MEMBERS = [
  { id: '93d8a2b8-e953-4c1d-bc62-2a57e5e8e481', name: 'Abel' },
  { id: 'fae2196e-dfb6-4edb-a279-adf24b1e151e', name: 'Max' },
  { id: '82cfb7fc-f667-467d-97db-f5459047eeb6', name: 'Olivier' },
  { id: '7acbe6c2-21e1-4346-bcff-0ce4797d6e88', name: 'Joseph' },
  { id: '132dcc71-5c7a-41fa-a94c-aa9858d6cea3', name: 'Chloé' },
  { id: '64d84369-bb20-4b9e-b313-69f423e24438', name: 'Alessandro' },
  { id: '190fc1b3-2b0e-40b9-b1d3-3036ab9b936f', name: 'Thomas' },
  { id: 'e330fcd0-65a3-42ac-9b25-b0035cd175d2', name: 'Antoine' },
  { id: 'e7f8f60f-b83f-45a5-89b7-5650e3c2b4ea', name: 'Alfred' },
  { id: '2f31b424-0e2e-4f97-beb0-8facf25077a3', name: 'Luc-Emmanuel' },
  { id: '58d63f40-928b-49b9-bdca-2336a0b2b6bc', name: 'Bertrand' },
  { id: '673a35f2-c184-48dc-9dc5-0e5114980f7e', name: 'Bettina' },
];

export const LP_TEAM_MAP = {};
LP_TEAM_MEMBERS.forEach(m => { LP_TEAM_MAP[m.id] = m.name; });

function getCachedLPs() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > CACHE_TTL) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function setCachedLPs(lps) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({
      data: lps,
      timestamp: Date.now(),
    }));
  } catch {
    // ignore
  }
}

// Helper to extract currency value from Attio currency attribute
function getCurrencyValue(record, slug) {
  const attr = record?.values?.[slug];
  if (!attr || !attr.length) return null;
  const val = attr[0];
  if (val.currency_value !== undefined) return parseFloat(val.currency_value);
  if (val.value !== undefined) return parseFloat(val.value);
  return null;
}

// Helper to extract rating value
function getRatingValue(record, slug) {
  const attr = record?.values?.[slug];
  if (!attr || !attr.length) return null;
  const val = attr[0];
  if (val.value !== undefined) return val.value;
  return null;
}

export function useAttioLPs() {
  const cached = getCachedLPs();
  const [lps, setLPs] = useState(cached || []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState(null);
  const [isLive, setIsLive] = useState(!!cached);

  const processLPs = useCallback((rawLPs) => {
    return rawLPs.map(lp => {
      const recordId = lp.id?.record_id;
      const name = getAttrValue(lp, 'name') || 'Unknown';

      // Owner (actor-reference multiselect)
      const ownerAttr = lp?.values?.owner;
      const hasOwner = ownerAttr && ownerAttr.length > 0;
      const ownerIds = hasOwner ? ownerAttr.map(o => o.referenced_actor_id).filter(Boolean) : [];

      // Classification
      const lpType = getAttrValue(lp, 'lp_type');
      const country = getAttrValue(lp, 'country');
      const openSource = getAttrValue(lp, 'open_source');

      // >Commit pipeline
      const commitStatus = getAttrValue(lp, 'status_3');
      const commitAmount = getCurrencyValue(lp, 'amount');
      const commitPriority = getRatingValue(lp, 'priority_6');

      // Fund III (RRW3) pipeline
      const fund3StatusRaw = getAttrValue(lp, 'rrw_3_status');
      const fund3Amount = getCurrencyValue(lp, 'amount_rrw');
      const fund3Priority = getRatingValue(lp, 'priority_rrw_3');
      const fund3Interest = getAttrValue(lp, 'rrw_3_7'); // Maybe / Yes / No

      // Derive effective Fund III status:
      // - If LP has a real rrw_3_status, use it
      // - If LP has interest (Maybe/Yes) but no status, route to virtual "Interested" stage
      // - If LP has interest = "No", route to virtual "Declined" stage
      let fund3Status = fund3StatusRaw;
      if (!fund3StatusRaw && fund3Interest) {
        if (fund3Interest === 'No') {
          fund3Status = '__declined__';
        } else {
          fund3Status = '__interested__';
        }
      }

      // Other
      const comment = getAttrValue(lp, 'comment_2');
      const raiseInvite = getAttrValue(lp, 'raise_invite');
      const reminder = getAttrValue(lp, 'reminder');
      const createdAt = getAttrValue(lp, 'created_at');
      const lastModified = getAttrValue(lp, 'last_modified');

      // Fund II — LPs tagged as "Fund II LP" in >Commit pipeline
      const isFund2LP = commitStatus === 'Fund II LP';

      return {
        id: recordId,
        name,
        ownerIds,
        hasOwner,
        lpType,
        country,
        openSource,
        // >Commit
        commitStatus,
        commitAmount,
        commitPriority,
        // Fund III
        fund3Status,
        fund3Amount: fund3Amount || commitAmount || null, // Fall back to >Commit amount for ticket size estimate
        fund3AmountIsEstimate: !fund3Amount && !!commitAmount, // Flag when using >Commit amount as proxy
        fund3Priority,
        fund3Interest,
        // Fund II (derived)
        fund2Status: isFund2LP ? 'Fund II LP' : null,
        fund2Amount: isFund2LP ? commitAmount : null,
        // Meta
        comment,
        raiseInvite,
        reminder,
        createdAt,
        lastModified,
      };
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        if (!cached) setLoading(true);

        const rawLPs = await fetchAllLPs();
        if (cancelled) return;

        const processed = processLPs(rawLPs);

        if (!cancelled && processed.length > 0) {
          setLPs(processed);
          setIsLive(true);
          setError(null);
          setCachedLPs(processed);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('Failed to fetch LPs:', err.message);
          setError(err.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [processLPs]);

  return { lps, loading, error, isLive };
}

export default useAttioLPs;
