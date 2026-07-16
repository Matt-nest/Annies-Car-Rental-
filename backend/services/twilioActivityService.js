import { supabase } from '../db/supabase.js';

const TWILIO_API_BASE = 'https://api.twilio.com/2010-04-01';

function twilioCredentials() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return { sid, token };
}

function twilioAuthHeader({ sid, token }) {
  return `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`;
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : '';
}

function customerName(customer) {
  if (!customer) return '';
  return `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
}

async function loadCustomerPhoneMap() {
  const { data, error } = await supabase
    .from('customers')
    .select('id, first_name, last_name, email, phone')
    .not('phone', 'is', null);

  if (error) {
    console.warn('[TwilioActivity] Customer phone lookup failed:', error.message);
    return new Map();
  }

  const map = new Map();
  for (const customer of data || []) {
    const last10 = normalizePhone(customer.phone);
    if (last10) map.set(last10, customer);
  }
  return map;
}

function matchCustomer(phoneMap, ...phones) {
  for (const phone of phones) {
    const last10 = normalizePhone(phone);
    if (last10 && phoneMap.has(last10)) return phoneMap.get(last10);
  }
  return null;
}

async function fetchTwilioCollection(credentials, resource, limit) {
  const pageSize = Math.min(Math.max(Number(limit) || 30, 1), 100);
  const url = `${TWILIO_API_BASE}/Accounts/${credentials.sid}/${resource}.json?${new URLSearchParams({ PageSize: String(pageSize) })}`;
  const res = await fetch(url, {
    headers: { Authorization: twilioAuthHeader(credentials) },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message || `Twilio ${resource} request failed (${res.status})`);
  }

  return res.json();
}

async function getLocalSmsMessages(phoneMap) {
  const { data, error } = await supabase
    .from('messages')
    .select('id, customer_id, direction, channel, body, status, external_id, metadata, created_at')
    .eq('channel', 'sms')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.warn('[TwilioActivity] Local SMS lookup failed:', error.message);
    return [];
  }

  const customerIds = [...new Set((data || []).map(message => message.customer_id).filter(Boolean))];
  let customersById = new Map();
  if (customerIds.length > 0) {
    const { data: customers, error: customerError } = await supabase
      .from('customers')
      .select('id, first_name, last_name, email, phone')
      .in('id', customerIds);
    if (!customerError) customersById = new Map((customers || []).map(customer => [customer.id, customer]));
  }

  return (data || []).map(message => {
    const customer = customersById.get(message.customer_id) || matchCustomer(phoneMap, message.metadata?.from, message.metadata?.to);
    return {
      id: message.external_id || message.id,
      source: 'local',
      direction: message.direction || 'outbound',
      status: message.status || 'stored',
      from: message.metadata?.from || null,
      to: message.metadata?.to || null,
      body: message.body || '',
      sentAt: message.created_at,
      customerId: message.customer_id,
      customerName: customerName(customer),
      customerPhone: customer?.phone || message.metadata?.from || message.metadata?.to || null,
      externalId: message.external_id || null,
    };
  });
}

async function getLocalCallLogs(phoneMap) {
  const { data, error } = await supabase
    .from('twilio_call_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(75);

  if (error) {
    console.warn('[TwilioActivity] Local call log lookup failed:', error.message);
    return [];
  }

  return (data || []).map(call => {
    const customer = call.customer_id
      ? { id: call.customer_id, first_name: call.customer_name, phone: null }
      : matchCustomer(phoneMap, call.from_number, call.to_number);
    const direction = call.direction || 'inbound';
    return {
      id: call.call_sid || call.id,
      source: 'local_call_log',
      direction,
      status: call.status || 'logged',
      from: call.from_number || null,
      to: call.to_number || null,
      startedAt: call.started_at || call.created_at,
      endedAt: call.ended_at || null,
      durationSeconds: Number(call.duration_seconds || call.recording_duration_seconds || 0),
      recordingUrl: call.recording_url || null,
      transcriptionText: call.transcription_text || null,
      customerId: call.customer_id || customer?.id || null,
      customerName: call.customer_name || customerName(customer),
      customerPhone: customer?.phone || (direction === 'inbound' ? call.from_number : call.to_number) || null,
      summary: call.transcription_text
        ? `Voicemail transcript: ${call.transcription_text}`
        : call.recording_url
          ? 'Voicemail recording received'
          : `${direction === 'inbound' ? 'Inbound' : 'Outbound'} call logged`,
      externalId: call.call_sid || null,
    };
  });
}

function normalizeCall(call, phoneMap) {
  const customer = matchCustomer(phoneMap, call.from, call.to);
  const direction = String(call.direction || '').includes('inbound') ? 'inbound' : 'outbound';
  return {
    id: call.sid,
    source: 'twilio',
    direction,
    status: call.status || 'unknown',
    from: call.from_formatted || call.from || null,
    to: call.to_formatted || call.to || null,
    startedAt: call.start_time || call.date_created || call.date_updated,
    endedAt: call.end_time || null,
    durationSeconds: Number(call.duration || 0),
    price: call.price || null,
    customerId: customer?.id || null,
    customerName: customerName(customer),
    customerPhone: customer?.phone || (direction === 'inbound' ? call.from : call.to) || null,
    summary: call.status === 'completed'
      ? `Completed ${direction} call`
      : `${direction === 'inbound' ? 'Inbound' : 'Outbound'} call marked ${call.status || 'unknown'}`,
  };
}

function normalizeTwilioMessage(message, phoneMap) {
  const customer = matchCustomer(phoneMap, message.from, message.to);
  const direction = String(message.direction || '').includes('inbound') ? 'inbound' : 'outbound';
  return {
    id: message.sid,
    source: 'twilio',
    direction,
    status: message.status || 'unknown',
    from: message.from || null,
    to: message.to || null,
    body: message.body || '',
    sentAt: message.date_sent || message.date_created || message.date_updated,
    customerId: customer?.id || null,
    customerName: customerName(customer),
    customerPhone: customer?.phone || (direction === 'inbound' ? message.from : message.to) || null,
    errorCode: message.error_code || null,
    externalId: message.sid,
  };
}

function mergeCalls(twilioCalls, localCalls) {
  const merged = new Map();
  for (const call of localCalls) merged.set(call.externalId || call.id, call);
  for (const call of twilioCalls) {
    const key = call.id;
    const local = merged.get(key);
    merged.set(key, local ? { ...call, ...local, source: 'twilio+local' } : call);
  }
  return [...merged.values()]
    .sort((a, b) => new Date(b.startedAt || 0).getTime() - new Date(a.startedAt || 0).getTime())
    .slice(0, 75);
}

function mergeMessages(twilioMessages, localMessages) {
  const merged = new Map();
  for (const message of twilioMessages) merged.set(message.externalId || message.id, message);
  for (const message of localMessages) {
    const key = message.externalId || message.id;
    if (!merged.has(key)) merged.set(key, message);
  }
  return [...merged.values()]
    .sort((a, b) => new Date(b.sentAt || 0).getTime() - new Date(a.sentAt || 0).getTime())
    .slice(0, 75);
}

async function findCustomerForPhones(...phones) {
  const phoneMap = await loadCustomerPhoneMap();
  return matchCustomer(phoneMap, ...phones);
}

export async function safeRecordTwilioCallLog({
  callSid,
  parentCallSid,
  direction = 'inbound',
  status,
  from,
  to,
  startedAt,
  endedAt,
  durationSeconds,
  recordingUrl,
  recordingDurationSeconds,
  transcriptionText,
  transcriptionStatus,
  metadata = {},
} = {}) {
  if (!callSid) return null;

  try {
    const customer = await findCustomerForPhones(from, to);
    const row = {
      call_sid: callSid,
      direction,
      updated_at: new Date().toISOString(),
    };
    if (parentCallSid) row.parent_call_sid = parentCallSid;
    if (status) row.status = status;
    if (from) row.from_number = from;
    if (to) row.to_number = to;
    if (customer?.id) row.customer_id = customer.id;
    if (customerName(customer)) row.customer_name = customerName(customer);
    if (startedAt) row.started_at = startedAt;
    if (endedAt) row.ended_at = endedAt;
    if (durationSeconds != null) row.duration_seconds = durationSeconds;
    if (recordingUrl) row.recording_url = recordingUrl;
    if (recordingDurationSeconds != null) row.recording_duration_seconds = recordingDurationSeconds;
    if (transcriptionText) row.transcription_text = transcriptionText;
    if (transcriptionStatus) row.transcription_status = transcriptionStatus;
    if (metadata && Object.keys(metadata).length > 0) row.metadata = metadata;

    const { data, error } = await supabase
      .from('twilio_call_logs')
      .upsert(row, { onConflict: 'call_sid' })
      .select()
      .single();

    if (error) {
      console.warn('[TwilioActivity] Call log persist failed:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('[TwilioActivity] Call log persist failed:', err.message);
    return null;
  }
}

export async function getTwilioActivity({ limit = 30 } = {}) {
  const phoneMap = await loadCustomerPhoneMap();
  const localCalls = await getLocalCallLogs(phoneMap);
  const localMessages = await getLocalSmsMessages(phoneMap);
  const credentials = twilioCredentials();

  if (!credentials) {
    return {
      configured: false,
      source: 'local_records',
      warning: 'Twilio credentials are not configured. Showing locally stored call and SMS records only.',
      calls: localCalls,
      messages: localMessages,
      generatedAt: new Date().toISOString(),
    };
  }

  try {
    const [callsResult, messagesResult] = await Promise.all([
      fetchTwilioCollection(credentials, 'Calls', limit),
      fetchTwilioCollection(credentials, 'Messages', limit),
    ]);

    const twilioCalls = (callsResult.calls || []).map(call => normalizeCall(call, phoneMap));
    const twilioMessages = (messagesResult.messages || []).map(message => normalizeTwilioMessage(message, phoneMap));

    return {
      configured: true,
      source: 'twilio',
      calls: mergeCalls(twilioCalls, localCalls),
      messages: mergeMessages(twilioMessages, localMessages),
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.warn('[TwilioActivity] Twilio API unavailable:', err.message);
    return {
      configured: true,
      source: 'local_records',
      warning: `Twilio API unavailable: ${err.message}. Showing locally stored call and SMS records only.`,
      calls: localCalls,
      messages: localMessages,
      generatedAt: new Date().toISOString(),
    };
  }
}
