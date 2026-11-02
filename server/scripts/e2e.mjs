import { openStream } from './sse.mjs';
const API = process.env.API_URL ?? 'https://yachloku-production-2397.up.railway.app';
const rnd = Math.random().toString(36).slice(2, 8);
const results = [];
const check = (name, ok, extra = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); };

async function call(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

const pw = 'Qa-' + rnd + '-pass1';
const a = (await call('/auth/register', { method: 'POST', body: { email: `qa-a-${rnd}@yachloku-qa.invalid`, password: pw, name: 'QA A' } }));
const b = (await call('/auth/register', { method: 'POST', body: { email: `qa-b-${rnd}@yachloku-qa.invalid`, password: pw, name: 'QA B' } }));
check('register A and B', a.status === 201 && b.status === 201);
const ta = a.data.token, tb = b.data.token;
const idA = a.data.user.id, idB = b.data.user.id;

try {
  const meA = await call('/auth/me', { token: ta });
  check('regular users are not admins', meA.data.user.isAdmin === false && (await call('/admin/overview', { token: ta })).status === 403 && (await call('/admin/feedback', { token: ta })).status === 403);
  check('forgot-password answers identically for known and unknown emails', JSON.stringify((await call('/auth/forgot', { method: 'POST', body: { email: `qa-a-${rnd}@yachloku-qa.invalid` } })).data) === JSON.stringify((await call('/auth/forgot', { method: 'POST', body: { email: 'nobody-' + rnd + '@yachloku-qa.invalid' } })).data));
  check('reset rejects a bad token and a weak password', (await call('/auth/reset', { method: 'POST', body: { token: 'nope', password: 'whatever123' } })).status === 400 && (await call('/auth/reset', { method: 'POST', body: { token: 'nope', password: '1' } })).status === 400);
  const login = await call('/auth/login', { method: 'POST', body: { email: `qa-a-${rnd}@yachloku-qa.invalid`, password: pw } });
  check('login', login.status === 200 && !!login.data.token);

  const ev = await call('/events', { method: 'POST', token: ta, body: { title: 'QA trip', icon: '🧪', currency: 'ILS', participantName: 'QA A', extraParticipantNames: ['Ghost'] } });
  check('create event', ev.status === 201 && ev.data.invite_code, `code=${ev.data.invite_code}`);
  const eid = ev.data.id;
  const partA = ev.data.participants.find((p) => p.user_id === idA);
  const ghost = ev.data.participants.find((p) => !p.user_id);

  check('B cannot read event', (await call(`/events/${eid}`, { token: tb })).status === 404);
  check('B cannot list expenses', (await call(`/events/${eid}/expenses`, { token: tb })).status === 404);

  const byCode = await call(`/events/by-code/${ev.data.invite_code.toLowerCase()}`, { token: tb });
  check('lookup by code (case-insensitive)', byCode.status === 200 && byCode.data.id === eid);
  const join = await call('/events/join', { method: 'POST', token: tb, body: { inviteCode: ev.data.invite_code, name: 'QA B' } });
  check('B joins', join.status === 200 && join.data.participants.length === 3);
  const join2 = await call('/events/join', { method: 'POST', token: tb, body: { inviteCode: ev.data.invite_code, name: 'QA B' } });
  check('join is idempotent', join2.status === 200 && join2.data.participants.length === 3);
  check('bad invite code', (await call('/events/join', { method: 'POST', token: tb, body: { inviteCode: 'ZZZZZZ', name: 'x' } })).status === 404);
  const partB = join.data.participants.find((p) => p.user_id === idB);

  check('B sees event', (await call('/events', { token: tb })).data.some((e) => e.id === eid));
  check('B (non-manager) cannot rename', (await call(`/events/${eid}`, { method: 'PATCH', token: tb, body: { title: 'x' } })).status === 403);
  const photos = await call(`/events/${eid}`, { method: 'PATCH', token: tb, body: { photos: [{ id: 'p1', url: 'u', type: 'image' }] } });
  check('member can update photos', photos.status === 200 && photos.data.photos.length === 1);

  const ex = await call(`/events/${eid}/expenses`, { method: 'POST', token: ta, body: {
    description: 'Dinner', amount: 120, currency: 'ILS', category: 'food',
    paid_by: [{ participant_id: partA.id, amount: 120 }],
    split_type: 'equal', split_between: [partA, partB, ghost].map((p) => ({ participant_id: p.id, amount: 40, percentage: null })),
    date: '2026-11-02', notes: 'qa' } });
  check('create expense (jsonb + enum)', ex.status === 201 && ex.data.created_by === idA && Array.isArray(ex.data.paid_by), JSON.stringify(ex.data).slice(0, 80));
  const exs = await call(`/events/${eid}/expenses`, { token: tb });
  check('amounts are numbers and dates are plain YYYY-MM-DD', typeof exs.data[0]?.amount === 'number' && exs.data[0]?.date === '2026-11-02');
  check('B lists expenses', exs.status === 200 && exs.data.length === 1);
  const upd = await call(`/expenses/${ex.data.id}`, { method: 'PATCH', token: tb, body: { amount: 150, notes: 'edited' } });
  check('member edits expense', upd.status === 200 && Number(upd.data.amount) === 150);

  const pay = await call(`/events/${eid}/payments`, { method: 'POST', token: tb, body: { from_participant_id: partB.id, to_participant_id: partA.id, amount: 40, currency: 'ILS' } });
  check('create payment', pay.status === 201);
  check('list payments', (await call(`/events/${eid}/payments`, { token: ta })).data.length === 1);

  const bad = await call(`/events/${eid}/confirmations`, { method: 'PUT', token: tb, body: { fromParticipantId: partA.id, toParticipantId: partB.id } });
  check('non-debtor cannot confirm', bad.status === 403);
  const conf = await call(`/events/${eid}/confirmations`, { method: 'PUT', token: tb, body: { fromParticipantId: partB.id, toParticipantId: partA.id } });
  check('debtor confirms', conf.status === 200 && conf.data.confirmed === true);
  const conf2 = await call(`/events/${eid}/confirmations`, { method: 'PUT', token: ta, body: { fromParticipantId: partB.id, toParticipantId: partA.id } });
  check('manager re-confirms (upsert)', conf2.status === 200);
  check('one confirmation row', (await call(`/events/${eid}/confirmations`, { token: ta })).data.length === 1);
  check('unconfirm', (await call(`/events/${eid}/confirmations?from=${partB.id}&to=${partA.id}`, { method: 'DELETE', token: tb })).status === 204);

  const poll = await call(`/events/${eid}/polls`, { method: 'POST', token: ta, body: { question: 'Where?', options: ['Beach', 'Hills'] } });
  check('create poll', poll.status === 201 && poll.data.options.length === 2);
  const opt = poll.data.options[0].id;
  check('B votes', (await call(`/polls/${poll.data.id}/vote`, { method: 'POST', token: tb, body: { optionId: opt } })).status === 200);
  check('B changes vote (upsert)', (await call(`/polls/${poll.data.id}/vote`, { method: 'POST', token: tb, body: { optionId: poll.data.options[1].id } })).status === 200);
  const polls = await call(`/events/${eid}/polls`, { token: ta });
  check('poll list embeds votes', polls.data[0].poll_votes.length === 1 && polls.data[0].poll_votes[0].user_id === idB);
  check('B cannot close poll', (await call(`/polls/${poll.data.id}/close`, { method: 'POST', token: tb })).status === 403);
  const edited = await call(`/polls/${poll.data.id}`, { method: 'PATCH', token: ta, body: { question: 'Where to?', options: [poll.data.options[0]] .concat([{ id: crypto.randomUUID(), label: 'City' }]) } });
  check('edit poll prunes removed-option votes', edited.status === 200 && (await call(`/events/${eid}/polls`, { token: ta })).data[0].poll_votes.length === 0);
  check('close poll', (await call(`/polls/${poll.data.id}/close`, { method: 'POST', token: ta })).data.closed === true);
  check('closed poll rejects votes', (await call(`/polls/${poll.data.id}/vote`, { method: 'POST', token: tb, body: { optionId: opt } })).status === 409);

  const prof = await call('/me/profile', { token: ta });
  check('profile exists', prof.status === 200 && prof.data.id === idA);
  const phone = await call('/me/profile', { method: 'PATCH', token: ta, body: { phone: '0500000000', notification_prefs: { chat: true, expenses: false, balance_changes: true, daily_digest: false } } });
  check('update profile', phone.status === 200 && phone.data.phone === '0500000000' && phone.data.notification_prefs.expenses === false);
  const phones = await call(`/profiles?ids=${idA},${idB}`, { token: tb });
  check('co-member phones visible', phones.status === 200 && phones.data.length === 2);

  const n1 = await call(`/events/${eid}/notify`, { method: 'POST', token: tb, body: { type: 'expense', title: 'New expense', body: 'x', data: { expense: ex.data.id } } });
  check('notify respects prefs (A disabled expenses)', n1.status === 200 && n1.data.sent === 0);
  const n2 = await call(`/events/${eid}/notify`, { method: 'POST', token: tb, body: { type: 'chat', title: 'Hi', body: 'x', data: { tab: 'group-chat' } } });
  check('notify delivers chat', n2.status === 200 && n2.data.sent === 1);
  const list = await call('/notifications', { token: ta });
  check('A receives notification', list.data.length === 1 && list.data[0].read === false);
  await call(`/notifications/${list.data[0].id}/read`, { method: 'POST', token: ta });
  check('mark read', (await call('/notifications', { token: ta })).data[0].read === true);

  // ---- chat + realtime ----
  const sa = openStream(API, `/events/${eid}/stream`, ta);
  const sb = openStream(API, `/events/${eid}/stream`, tb);
  const su = openStream(API, '/stream', ta);
  await new Promise((r) => setTimeout(r, 1500));
  const seen = (s, name, pred = () => true) => s.events.some((e) => e.name === name && pred(e.data));
  const wait = async (fn, ms = 4000) => { const t = Date.now(); while (Date.now() - t < ms) { if (fn()) return true; await new Promise((r) => setTimeout(r, 100)); } return fn(); };

  const g1 = await call(`/events/${eid}/group-messages`, { method: 'POST', token: ta, body: { content: 'hello group' } });
  check('send group message', g1.status === 201 && g1.data.from_user_id === idA && g1.data.from_participant_id === partA.id);
  check('B receives group INSERT in realtime', await wait(() => seen(sb, 'group_message', (d) => d.eventType === 'INSERT' && d.row.id === g1.data.id)));
  check('empty message rejected', (await call(`/events/${eid}/group-messages`, { method: 'POST', token: ta, body: {} })).status === 400);
  check('B cannot edit A message', (await call(`/group-messages/${g1.data.id}`, { method: 'PATCH', token: tb, body: { content: 'hack' } })).status === 403);
  const ed = await call(`/group-messages/${g1.data.id}`, { method: 'PATCH', token: ta, body: { content: 'hello edited' } });
  check('author edits', ed.status === 200 && ed.data.content === 'hello edited' && !!ed.data.edited_at);
  const r1 = await call(`/group-messages/${g1.data.id}/react`, { method: 'POST', token: tb, body: { emoji: '👍' } });
  check('react adds', r1.status === 200 && r1.data.reactions['👍']?.includes(idB));
  check('A receives reaction UPDATE', await wait(() => seen(sa, 'group_message', (d) => d.eventType === 'UPDATE' && d.row.reactions?.['👍']?.includes(idB))));
  const r2 = await call(`/group-messages/${g1.data.id}/react`, { method: 'POST', token: tb, body: { emoji: '👍' } });
  check('react toggles off', r2.status === 200 && !r2.data.reactions['👍']);
  const pin = await call(`/group-messages/${g1.data.id}/pin`, { method: 'POST', token: tb });
  check('member pins', pin.status === 200 && !!pin.data.pinned_at);
  const rd = await call(`/events/${eid}/group-messages/read`, { method: 'POST', token: tb });
  check('mark group read', rd.status === 200 && rd.data.updated === 1);
  check('read_by contains B', (await call(`/events/${eid}/group-messages`, { token: ta })).data[0].read_by.includes(idB));
  check('B cannot delete A message', (await call(`/group-messages/${g1.data.id}`, { method: 'DELETE', token: tb })).status === 403);
  const g2 = await call(`/events/${eid}/group-messages`, { method: 'POST', token: tb, body: { content: 'from B', reply_to_id: g1.data.id } });
  check('reply to message', g2.status === 201 && g2.data.reply_to_id === g1.data.id);
  const del = await call(`/group-messages/${g2.data.id}`, { method: 'DELETE', token: ta });
  check('manager deletes (soft)', del.status === 200 && !!del.data.deleted_at && del.data.content === null);

  await call(`/events/${eid}/typing`, { method: 'POST', token: ta, body: { scope: 'group', isTyping: true } });
  check('typing relayed to B', await wait(() => seen(sb, 'typing', (d) => d.user_id === idA && d.is_typing === true)));

  const d1 = await call(`/events/${eid}/private-messages`, { method: 'POST', token: ta, body: { to_participant_id: partB.id, content: 'secret hi' } });
  check('send private message', d1.status === 201 && d1.data.to_user_id === idB);
  check('B receives DM in realtime', await wait(() => seen(sb, 'private_message', (d) => d.eventType === 'INSERT' && d.row.id === d1.data.id)));
  check('DM thread (A side)', (await call(`/events/${eid}/private-messages?with=${partB.id}`, { token: ta })).data.length === 1);
  check('DM thread (B side)', (await call(`/events/${eid}/private-messages?with=${partA.id}`, { token: tb })).data.length === 1);
  check('B unread count', (await call(`/events/${eid}/private-unread`, { token: tb })).data[partA.id] === 1);
  check('unknown recipient rejected', (await call(`/events/${eid}/private-messages`, { method: 'POST', token: ta, body: { to_participant_id: 'nope', content: 'x' } })).status === 400);
  check('B marks DM read', (await call(`/events/${eid}/private-messages/read`, { method: 'POST', token: tb, body: { fromParticipantId: partA.id } })).data.updated === 1);
  check('unread cleared', Object.keys((await call(`/events/${eid}/private-unread`, { token: tb })).data).length === 0);
  await call(`/events/${eid}/typing`, { method: 'POST', token: ta, body: { scope: 'dm', with: partB.id, isTyping: true } });
  check('DM typing relayed to B only', await wait(() => seen(sb, 'typing', (d) => d.scope === 'dm' && d.user_id === idA)));
  check('DM typing not echoed to A', !seen(sa, 'typing', (d) => d.scope === 'dm'));

  const msg = (content) => ({ messages: [{ key: `settlement:${partB.id}:${partA.id}`, fromParticipantId: partB.id, toParticipantId: partA.id, content }] });
  const s1 = await call(`/events/${eid}/settlement-messages/sync`, { method: 'POST', token: ta, body: msg('You owe 40') });
  check('settlement message inserted', s1.status === 200 && s1.data.changed === 1);
  const s1b = await call(`/events/${eid}/settlement-messages/sync`, { method: 'POST', token: ta, body: msg('You owe 40') });
  check('settlement sync is idempotent', s1b.data.changed === 0);
  const s2 = await call(`/events/${eid}/settlement-messages/sync`, { method: 'POST', token: ta, body: msg('You owe 55') });
  check('settlement message updated in place', s2.data.changed === 1);
  const thread = (await call(`/events/${eid}/private-messages?with=${partA.id}`, { token: tb })).data.filter((m) => m.is_system && !m.deleted_at);
  check('exactly one live system message', thread.length === 1 && thread[0].content === 'You owe 55');
  const s3 = await call(`/events/${eid}/settlement-messages/sync`, { method: 'POST', token: ta, body: { messages: [] } });
  check('settled debts remove the message', s3.data.changed === 1);
  check('media count', (await call(`/events/${eid}/media-count`, { token: ta })).data.count === 0);

  const nf = await call(`/events/${eid}/notify`, { method: 'POST', token: tb, body: { type: 'chat', title: 'ping', body: 'x', data: {} } });
  check('notification pushed over user stream', nf.data.sent === 1 && (await wait(() => seen(su, 'notification', (d) => d.eventType === 'INSERT'))));
  const stranger = await call('/auth/register', { method: 'POST', body: { email: `qa-c-${rnd}@yachloku-qa.invalid`, password: pw, name: 'QA C' } });
  const denied = await fetch(`${API}/events/${eid}/stream?token=${stranger.data.token}`);
  check('stranger cannot open the event stream', denied.status === 404);
  await call('/me', { method: 'DELETE', token: stranger.data.token });
  sa.close(); sb.close(); su.close();

  check('delete expense', (await call(`/expenses/${ex.data.id}`, { method: 'DELETE', token: tb })).status === 204);
  check('delete payment', (await call(`/payments/${pay.data.id}`, { method: 'DELETE', token: tb })).status === 204);
  const tr = await call(`/events/${eid}/transfer-manager`, { method: 'POST', token: ta, body: { newManagerId: idB } });
  check('transfer manager', tr.status === 200 && tr.data.manager_user_id === idB);

  const delB = await call('/me', { method: 'DELETE', token: tb });
  check('manager B deletes account -> event survives with A as manager', delB.status === 200);
  const after = await call(`/events/${eid}`, { token: ta });
  check('event reassigned to A', after.status === 200 && after.data.manager_user_id === idA && !after.data.participants.some((p) => p.user_id === idB));
} finally {
  const delA = await call('/me', { method: 'DELETE', token: ta });
  check('cleanup: A deletes account (empty event removed)', delA.status === 200);
  await call('/me', { method: 'DELETE', token: tb });
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
