// Deep scenario suite against a live API: edge cases, abuse, permissions, concurrency, robustness.
// Creates throw-away users (@yachloku-qa.invalid) and removes everything it made.
import crypto from 'node:crypto';
import { openStream } from './sse.mjs';

const API = process.env.API_URL ?? 'https://yachloku-production-2397.up.railway.app';
const rnd = Math.random().toString(36).slice(2, 8);
console.log('run id', rnd);
const results = [];
let section = '';
const check = (name, ok, extra = '') => {
  results.push({ section, name, ok: Boolean(ok), extra });
  if (!ok) console.log(`FAIL  [${section}] ${name}${extra ? '  -> ' + extra : ''}`);
};
const sec = (s) => { section = s; console.log(`\n== ${s}`); };

async function call(path, { method = 'GET', body, token, headers = {}, rawBody, ctype } = {}) {
  const h = { ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  let b;
  if (rawBody !== undefined) { b = rawBody; if (ctype) h['Content-Type'] = ctype; }
  else if (body !== undefined) { b = JSON.stringify(body); h['Content-Type'] = 'application/json'; }
  const t0 = Date.now();
  let res, text;
  for (let attempt = 0; ; attempt++) {
    try { res = await fetch(API + path, { method, headers: h, body: b }); text = await res.text(); break; }
    catch (err) { if (attempt >= 3) throw err; await new Promise((r) => setTimeout(r, 1500)); }
  }
  let data = {};
  try { data = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, data, text, headers: res.headers, ms: Date.now() - t0 };
}
const is = (r, ...codes) => codes.includes(r.status);
const clean = (r) => r.status < 500; // never a server error
const uuid = () => crypto.randomUUID();
const pw = 'Qa-' + rnd + '-pass1';
const em = (tag) => `qa-${tag}-${rnd}@yachloku-qa.invalid`;
const tokens = [];
async function newUser(tag, name = 'QA ' + tag) {
  const r = await call('/auth/register', { method: 'POST', body: { email: em(tag), password: pw, name } });
  if (r.status === 201) tokens.push(r.data.token);
  return { token: r.data.token, id: r.data.user?.id, status: r.status };
}

const A = await newUser('a', 'QA A');
const B = await newUser('b', 'QA B');
const C = await newUser('c', 'QA C');
const D = await newUser('d', 'QA D');
const Z = await newUser('z', 'QA Z');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

try {
  // ===================================================================== AUTH
  sec('auth: registration validation');
  const reg = (body, extra) => call('/auth/register', { method: 'POST', body, ...extra });
  check('register: 5 base users created', [A, B, C, D, Z].every((u) => u.status === 201));
  for (const [label, body] of [
    ['empty body', {}], ['no email', { password: pw, name: 'x' }], ['no password', { email: em('v1'), name: 'x' }],
    ['no name', { email: em('v2'), password: pw }], ['short password', { email: em('v3'), password: '12345', name: 'x' }],
    ['numeric password', { email: em('v4'), password: 1234567, name: 'x' }], ['null fields', { email: null, password: null, name: null }],
    ['array body', []], ['whitespace name', { email: em('v5'), password: pw, name: '   ' }],
    ['object email', { email: { a: 1 }, password: pw, name: 'x' }],
  ]) {
    const r = await reg(body);
    if (r.status === 201) tokens.push(r.data.token);
    check(`register rejects (${label})`, is(r, 400), `status ${r.status}`);
  }
  for (const [label, email] of [['no @', 'plainaddress'], ['no domain', 'a@'], ['spaces inside', 'a b@c.com'], ['two @', 'a@@b.com'], ['no tld', 'a@b']]) {
    const r = await reg({ email, password: pw, name: 'x' });
    check(`register rejects invalid email (${label})`, is(r, 400), `status ${r.status}`);
    if (r.status === 201) tokens.push(r.data.token);
  }
  const upper = await reg({ email: `  QA-U-${rnd}@YACHLOKU-QA.INVALID  `, password: pw, name: ' Mixed Case ' });
  if (upper.status === 201) tokens.push(upper.data.token);
  check('register normalises email case and whitespace', upper.status === 201 && upper.data.user.email === `qa-u-${rnd}@yachloku-qa.invalid`);
  check('register trims the name', upper.data.user?.name === 'Mixed Case');
  check('duplicate email differing only in case is rejected', is(await reg({ email: em('u').toUpperCase(), password: pw, name: 'x' }), 409));
  const uni = await reg({ email: em('uni'), password: pw, name: 'נסים 🧳 Ωmega' });
  if (uni.status === 201) tokens.push(uni.data.token);
  check('register keeps unicode names', uni.status === 201 && uni.data.user.name === 'נסים 🧳 Ωmega');
  const longName = await reg({ email: em('long'), password: pw, name: 'x'.repeat(5000) });
  if (longName.status === 201) tokens.push(longName.data.token);
  check('register rejects an absurdly long name', is(longName, 400), `status ${longName.status}`);
  const longPw = await reg({ email: em('lpw'), password: 'p'.repeat(100000), name: 'x' });
  if (longPw.status === 201) tokens.push(longPw.data.token);
  check('register rejects a 100KB password (bcrypt DoS)', is(longPw, 400, 413), `status ${longPw.status}`);
  const par = await Promise.all(Array.from({ length: 6 }, () => reg({ email: em('race'), password: pw, name: 'Race' })));
  par.filter((r) => r.status === 201).forEach((r) => tokens.push(r.data.token));
  check('parallel duplicate registrations: exactly one wins', par.filter((r) => r.status === 201).length === 1, par.map((r) => r.status).join(','));
  check('parallel duplicate registrations: none crash', par.every(clean), par.map((r) => r.status).join(','));

  sec('auth: login');
  const login = (body) => call('/auth/login', { method: 'POST', body });
  check('login ok', is(await login({ email: em('a'), password: pw }), 200));
  check('login is case-insensitive on email', is(await login({ email: em('a').toUpperCase(), password: pw }), 200));
  check('login tolerates surrounding spaces', is(await login({ email: ` ${em('a')} `, password: pw }), 200));
  check('login wrong password -> 401', is(await login({ email: em('a'), password: pw + 'x' }), 401));
  check('login unknown user -> 401', is(await login({ email: em('nobody'), password: pw }), 401));
  check('unknown user and wrong password give the same message', (await login({ email: em('nobody'), password: pw })).text === (await login({ email: em('a'), password: 'wrong-pass' })).text);
  for (const [label, body] of [['empty body', {}], ['no password', { email: em('a') }], ['numeric password', { email: em('a'), password: 123456 }], ['object password', { email: em('a'), password: { $ne: 1 } }], ['array email', { email: [em('a')], password: pw }], ['null body', null]]) {
    const r = await login(body);
    check(`login handles malformed input (${label})`, is(r, 400, 401), `status ${r.status}`);
  }
  check('google: missing token -> 400', is(await call('/auth/google', { method: 'POST', body: {} }), 400));
  check('google: garbage token -> 401', is(await call('/auth/google', { method: 'POST', body: { idToken: 'garbage' } }), 401));
  check('google: non-string token handled', clean(await call('/auth/google', { method: 'POST', body: { idToken: { a: 1 } } })));
  check('google: forged token -> 401', is(await call('/auth/google', { method: 'POST', body: { idToken: `${b64({ alg: 'RS256' })}.${b64({ email: 'x@y.z', email_verified: true })}.sig` } }), 401));

  sec('auth: tokens');
  const me = await call('/auth/me', { token: A.token });
  check('me returns the user without a password hash', me.status === 200 && me.data.user.email === em('a') && !('password_hash' in me.data.user) && me.data.user.isAdmin === false);
  check('no header -> 401', is(await call('/auth/me'), 401));
  check('empty bearer -> 401', is(await call('/auth/me', { headers: { Authorization: 'Bearer ' } }), 401));
  check('wrong scheme -> 401', is(await call('/auth/me', { headers: { Authorization: `Basic ${A.token}` } }), 401));
  check('garbage token -> 401', is(await call('/auth/me', { token: 'abc.def.ghi' }), 401));
  const [h, , s] = A.token.split('.');
  check('payload swapped with original signature -> 401', is(await call('/auth/me', { token: `${h}.${b64({ sub: B.id, email: em('b'), iat: 1, exp: 9999999999 })}.${s}` }), 401));
  check('alg=none token -> 401', is(await call('/auth/me', { token: `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: A.id })}.` }), 401));
  const wrongSecret = (payload) => { const hh = b64({ alg: 'HS256', typ: 'JWT' }); const pp = b64(payload); return `${hh}.${pp}.${crypto.createHmac('sha256', 'guess').update(`${hh}.${pp}`).digest('base64url')}`; };
  check('token signed with a guessed secret -> 401', is(await call('/auth/me', { token: wrongSecret({ sub: A.id, exp: 9999999999 }) }), 401));
  check('expired-looking token with bad signature -> 401', is(await call('/auth/me', { token: wrongSecret({ sub: A.id, exp: 1 }) }), 401));
  check('token in query string is not accepted on normal routes', is(await call(`/auth/me?token=${A.token}`), 401));
  check('stream: missing token -> 401', is(await call('/stream'), 401));
  check('stream: bad token -> 401', is(await call('/stream?token=zzz'), 401));
  check('protected routes all demand auth', (await Promise.all(['/events', '/notifications', '/me/profile', '/admin/overview', '/admin/feedback', '/profiles?ids=x'].map((u) => call(u)))).every((r) => r.status === 401));
  check('health is public and reports db', (await call('/health')).data.db === true);
  check('health does not leak secrets', !/secret|password|private/i.test((await call('/health')).text));
  check('unknown route -> 404', is(await call('/does-not-exist'), 404));
  check('unknown route does not leak a stack trace', !/at .*\.js:\d+/.test((await call('/does-not-exist')).text));

  sec('http: robustness');
  const bad = await call('/auth/login', { method: 'POST', rawBody: '{"email": ', ctype: 'application/json' });
  check('malformed JSON -> 400 (not 500)', is(bad, 400), `status ${bad.status}`);
  check('malformed JSON does not leak a stack', !/at .*\.js:\d+/.test(bad.text));
  const big = await call('/auth/login', { method: 'POST', rawBody: JSON.stringify({ email: 'x'.repeat(2_000_000) }), ctype: 'application/json' });
  check('oversized JSON -> 413', is(big, 413), `status ${big.status}`);
  const wrongType = await call('/auth/login', { method: 'POST', rawBody: 'email=a&password=b', ctype: 'application/x-www-form-urlencoded' });
  check('form-encoded body handled', is(wrongType, 400, 401), `status ${wrongType.status}`);
  const pre = await fetch(`${API}/events`, { method: 'OPTIONS', headers: { Origin: 'https://www.yachloku.com', 'Access-Control-Request-Method': 'POST' } });
  check('CORS preflight allows the production site', pre.status === 204 && pre.headers.get('access-control-allow-origin') === 'https://www.yachloku.com');
  const evil = await fetch(`${API}/events`, { method: 'OPTIONS', headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'POST' } });
  check('CORS preflight does not allow a random origin', evil.headers.get('access-control-allow-origin') === null);
  check('CORS allows the Capacitor app origin', (await fetch(`${API}/health`, { headers: { Origin: 'capacitor://localhost' } })).headers.get('access-control-allow-origin') === 'capacitor://localhost');
  check('CORS allows the Android WebView origin', (await fetch(`${API}/health`, { headers: { Origin: 'http://localhost' } })).headers.get('access-control-allow-origin') === 'http://localhost');
  check('CORS rejects a localhost look-alike', (await fetch(`${API}/health`, { headers: { Origin: 'https://localhost.evil.com' } })).headers.get('access-control-allow-origin') === null);
  check('X-Powered-By is not advertised', !(await fetch(`${API}/health`)).headers.has('x-powered-by'));
  check('SQL injection in login is harmless', is(await call('/auth/login', { method: 'POST', body: { email: "' or 1=1 --", password: "' or 1=1 --" } }), 401, 400));
  const perf = await Promise.all(Array.from({ length: 25 }, () => call('/events', { token: A.token })));
  check('25 parallel list requests all succeed', perf.every((r) => r.status === 200));
  check('25 parallel list requests finish quickly (max < 4s)', Math.max(...perf.map((r) => r.ms)) < 4000, `${Math.max(...perf.map((r) => r.ms))}ms`);

  // ===================================================================== EVENTS
  sec('events: creation');
  const mk = (token, body) => call('/events', { method: 'POST', token, body });
  for (const [label, body] of [
    ['no title', { participantName: 'x' }], ['no participantName', { title: 't' }], ['empty title', { title: '', participantName: 'x' }],
    ['whitespace title', { title: '   ', participantName: 'x' }], ['numeric title', { title: 5, participantName: 'x' }],
    ['title over 120 chars', { title: 't'.repeat(121), participantName: 'x' }], ['extra names not an array', { title: 't', participantName: 'x', extraParticipantNames: 'bob' }],
    ['extra names with non-strings', { title: 't', participantName: 'x', extraParticipantNames: [1, null, {}] }],
    ['extra names with blanks', { title: 't', participantName: 'x', extraParticipantNames: ['', '  '] }],
    ['too many participants', { title: 't', participantName: 'x', extraParticipantNames: Array.from({ length: 200 }, (_, i) => 'p' + i) }],
    ['unknown currency', { title: 't', participantName: 'x', currency: 'ZZZZZZZZ' }],
    ['numeric currency', { title: 't', participantName: 'x', currency: 5 }],
  ]) {
    const r = await mk(A.token, body);
    check(`create event rejects (${label})`, is(r, 400), `status ${r.status}`);
  }
  const e1r = await mk(A.token, { title: 'Deep QA trip', icon: '🧪', currency: 'ILS', participantName: 'QA A', extraParticipantNames: ['Ghost', 'Ghost'] });
  const E1 = e1r.data;
  check('create event ok', e1r.status === 201 && /^[A-Z0-9]{4,10}$/.test(E1.invite_code), E1.invite_code);
  check('creator is both created_by and manager', E1.created_by === A.id && E1.manager_user_id === A.id);
  check('participants get unique ids', new Set(E1.participants.map((x) => x.id)).size === E1.participants.length);
  check('default status is active', E1.status === 'active');
  const partA = E1.participants.find((x) => x.user_id === A.id);
  const ghost = E1.participants.filter((x) => !x.user_id);
  const e2r = await mk(A.token, { title: 'שם בעברית 🌴', participantName: 'א' });
  check('hebrew and emoji titles survive', e2r.data.title === 'שם בעברית 🌴');
  check('default currency is ILS', e2r.data.currency === 'ILS');
  const e3 = await mk(A.token, { title: '<script>alert(1)</script>', participantName: '<b>x</b>' });
  check('markup in titles is stored verbatim (escaping is the UI job)', e3.data.title === '<script>alert(1)</script>');
  check('invite codes are distinct', new Set([E1.invite_code, e2r.data.invite_code, e3.data.invite_code]).size === 3);

  sec('events: visibility and join');
  check('non-members cannot read an event', (await Promise.all([B, C, D].map((u) => call(`/events/${E1.id}`, { token: u.token })))).every((r) => r.status === 404));
  check('events list contains only my events', (await call('/events', { token: B.token })).data.length === 0);
  check('lookup by code requires auth', is(await call(`/events/by-code/${E1.invite_code}`), 401));
  check('lookup by code works with spaces and lowercase', is(await call(`/events/by-code/%20${E1.invite_code.toLowerCase()}%20`, { token: B.token }), 200));
  check('lookup of unknown code -> 404', is(await call('/events/by-code/NOPE123', { token: B.token }), 404));
  check('lookup with SQL chars is harmless', is(await call("/events/by-code/'%20or%201=1--", { token: B.token }), 404));
  check('join without a name -> 400', is(await call('/events/join', { method: 'POST', token: B.token, body: { inviteCode: E1.invite_code } }), 400));
  check('join without a code -> 400', is(await call('/events/join', { method: 'POST', token: B.token, body: { name: 'x' } }), 400));
  check('join with numeric code handled', clean(await call('/events/join', { method: 'POST', token: B.token, body: { inviteCode: 123456, name: 'x' } })));
  check('join with array name rejected', is(await call('/events/join', { method: 'POST', token: B.token, body: { inviteCode: E1.invite_code, name: ['a'] } }), 400));
  check('join with very long name rejected', is(await call('/events/join', { method: 'POST', token: B.token, body: { inviteCode: E1.invite_code, name: 'n'.repeat(500) } }), 400));
  check('still not a member after bad joins', is(await call(`/events/${E1.id}`, { token: B.token }), 404));
  const jb = await call('/events/join', { method: 'POST', token: B.token, body: { inviteCode: E1.invite_code.toLowerCase(), name: 'QA B' } });
  check('join with a lowercase code', jb.status === 200 && jb.data.participants.length === 4);
  const partB = jb.data.participants.find((x) => x.user_id === B.id);
  const jc = await call('/events/join', { method: 'POST', token: C.token, body: { inviteCode: ` ${E1.invite_code} `, name: 'QA C' } });
  check('join with padded code', jc.status === 200);
  const partC = jc.data.participants.find((x) => x.user_id === C.id);
  const races = await Promise.all(Array.from({ length: 6 }, () => call('/events/join', { method: 'POST', token: D.token, body: { inviteCode: E1.invite_code, name: 'QA D' } })));
  const afterRace = await call(`/events/${E1.id}`, { token: A.token });
  const dCount = afterRace.data.participants.filter((x) => x.user_id === D.id).length;
  check('parallel joins by one user create one participant', dCount === 1, `count ${dCount}`);
  check('parallel joins do not crash', races.every(clean));
  const partD = afterRace.data.participants.find((x) => x.user_id === D.id);
  check('participant count is right (A, 2 ghosts, B, C, D)', afterRace.data.participants.length === 6, String(afterRace.data.participants.length));
  check('all members now see the event', (await Promise.all([B, C, D].map((u) => call('/events', { token: u.token })))).every((r) => r.data.some((e) => e.id === E1.id)));

  sec('events: editing and permissions');
  const patch = (tok, body, id = E1.id) => call(`/events/${id}`, { method: 'PATCH', token: tok, body });
  check('manager renames', (await patch(A.token, { title: 'Renamed' })).data.title === 'Renamed');
  check('non-manager cannot rename', is(await patch(B.token, { title: 'hax' }), 403));
  check('non-manager cannot change currency', is(await patch(B.token, { currency: 'USD' }), 403));
  check('non-manager cannot change status', is(await patch(B.token, { status: 'archived' }), 403));
  check('outsider gets 404 on patch', is(await patch(Z.token, { title: 'x' }), 404));
  check('empty patch -> 400', is(await patch(A.token, {}), 400));
  check('unknown fields are ignored (400)', is(await patch(A.token, { created_by: B.id, manager_user_id: B.id, invite_code: 'HACKED' }), 400));
  check('invite code unchanged', (await call(`/events/${E1.id}`, { token: A.token })).data.invite_code === E1.invite_code);
  check('invalid status value rejected', is(await patch(A.token, { status: 'bogus' }), 400));
  check('empty title rejected', is(await patch(A.token, { title: '' }), 400));
  check('title over 120 chars rejected', is(await patch(A.token, { title: 't'.repeat(200) }), 400));
  check('participants must be an array', is(await patch(B.token, { participants: 'x' }), 400));
  check('participants must not be emptied', is(await patch(B.token, { participants: [] }), 400));
  check('photos must be an array', is(await patch(B.token, { photos: 'x' }), 400));
  check('member can add a photo', (await patch(B.token, { photos: [{ id: 'p1', url: 'https://x/y.png', type: 'image' }] })).status === 200);
  const mine = (await call(`/events/${E1.id}`, { token: A.token })).data.participants;
  const kick = await patch(B.token, { participants: mine.filter((x) => x.user_id !== A.id) });
  check('a member cannot remove the manager from the participants', is(kick, 400, 403), `status ${kick.status}`);
  const inject = await patch(B.token, { participants: [...mine, { id: uuid(), name: 'Injected', email: null, user_id: Z.id }] });
  check('a member cannot grant access to an arbitrary user id', is(inject, 400, 403), `status ${inject.status}`);
  check('outsider still cannot see the event', is(await call(`/events/${E1.id}`, { token: Z.token }), 404));
  const rename = await patch(B.token, { participants: mine.map((x) => (x.id === partB.id ? { ...x, name: 'Bee' } : x)) });
  check('a member can rename a participant', rename.status === 200 && rename.data.participants.find((x) => x.id === partB.id).name === 'Bee');
  const hijack = await patch(B.token, { participants: mine.map((x) => (x.id === partC.id ? { ...x, user_id: B.id } : x)) });
  check('a member cannot steal another member slot', is(hijack, 400, 403), `status ${hijack.status}`);

  sec('events: manager transfer');
  const xfer = (tok, newManagerId, id = E1.id) => call(`/events/${id}/transfer-manager`, { method: 'POST', token: tok, body: { newManagerId } });
  check('transfer without target -> 400', is(await xfer(A.token, undefined), 400));
  check('non-manager cannot transfer', is(await xfer(B.token, B.id), 403));
  check('transfer to a non-member is rejected', is(await xfer(A.token, Z.id), 400, 403, 404));
  check('transfer to a random uuid is rejected', is(await xfer(A.token, uuid()), 400, 403, 404));
  check('transfer to a malformed id is not a 500', clean(await xfer(A.token, 'not-a-uuid')));
  check('still the manager after bad transfers', (await call(`/events/${E1.id}`, { token: A.token })).data.manager_user_id === A.id);
  const t1 = await xfer(A.token, B.id);
  check('manager transfers to member B', t1.status === 200 && t1.data.manager_user_id === B.id && t1.data.previous_manager_user_id === A.id);
  check('old manager lost manager rights', is(await patch(A.token, { title: 'again' }), 403));
  check('new manager has rights', is(await patch(B.token, { title: 'Renamed by B' }), 200));
  check('transfer back', (await xfer(B.token, A.id)).status === 200);

  // ===================================================================== EXPENSES
  sec('expenses');
  const sp = (people, amt) => people.map((x) => ({ participant_id: x.id, amount: amt, percentage: null }));
  const base = (over = {}) => ({ description: 'Dinner', amount: 120, currency: 'ILS', category: 'food', paid_by: [{ participant_id: partA.id, amount: 120 }], split_type: 'equal', split_between: sp([partA, partB, partC], 40), date: '2026-11-02', ...over });
  const addEx = (tok, over, id = E1.id) => call(`/events/${id}/expenses`, { method: 'POST', token: tok, body: base(over) });
  const x1 = await addEx(A.token);
  check('create expense', x1.status === 201 && x1.data.amount === 120 && x1.data.created_by === A.id);
  check('expense is visible to every member', (await Promise.all([B, C, D].map((u) => call(`/events/${E1.id}/expenses`, { token: u.token })))).every((r) => r.data.length === 1));
  check('outsider cannot add expenses', is(await addEx(Z.token), 404));
  check('outsider cannot list expenses', is(await call(`/events/${E1.id}/expenses`, { token: Z.token }), 404));
  for (const [label, over] of [
    ['negative amount', { amount: -5 }], ['zero amount', { amount: 0 }], ['string amount', { amount: 'abc' }], ['null amount', { amount: null }],
    ['missing amount', { amount: undefined }], ['NaN-like amount', { amount: 'NaN' }], ['infinite amount', { amount: 1e999 }], ['huge amount', { amount: 1e15 }],
    ['empty description', { description: '' }], ['missing description', { description: undefined }], ['description over 200 chars', { description: 'd'.repeat(201) }],
    ['unknown category', { category: 'not_a_category' }], ['unknown split type', { split_type: 'weird' }],
    ['invalid date', { date: 'not-a-date' }], ['impossible date', { date: '2026-02-31' }],
    ['paid_by not an array', { paid_by: 'x' }], ['split_between not an array', { split_between: 'x' }],
    ['empty paid_by', { paid_by: [] }], ['empty split_between', { split_between: [] }],
    ['payer not in the event', { paid_by: [{ participant_id: uuid(), amount: 120 }] }],
    ['split member not in the event', { split_between: sp([{ id: uuid() }], 120) }],
    ['unknown currency', { currency: 'ZZZZZZZZZZ' }],
  ]) {
    const r = await addEx(A.token, over);
    if (r.status === 201) await call(`/expenses/${r.data.id}`, { method: 'DELETE', token: A.token });
    check(`expense rejects (${label})`, is(r, 400), `status ${r.status}`);
  }
  const dec = await addEx(A.token, { amount: 10.555, description: 'Rounding' });
  check('fractional amounts come back as numbers', dec.status === 201 && typeof dec.data.amount === 'number', JSON.stringify(dec.data.amount));
  const sumTest = await addEx(A.token, { amount: 0.1 + 0.2, description: 'float sum' });
  check('0.1+0.2 is stored cleanly', sumTest.status === 201 && sumTest.data.amount === 0.3, JSON.stringify(sumTest.data.amount));
  const mini = await addEx(A.token, { amount: 0.01, description: 'one agora', paid_by: [{ participant_id: partA.id, amount: 0.01 }], split_between: sp([partA, partB], 0) });
  check('smallest amount accepted', mini.status === 201);
  const heb = await addEx(A.token, { description: 'ארוחת ערב 🍝 "מיוחדת"', notes: 'שורה 1\nשורה 2' });
  check('hebrew, quotes and newlines survive', heb.status === 201 && heb.data.description === 'ארוחת ערב 🍝 "מיוחדת"' && heb.data.notes === 'שורה 1\nשורה 2');
  const injection = await addEx(A.token, { description: "'); drop table expenses;--" });
  check('SQL in text is stored literally', injection.status === 201 && injection.data.description.includes('drop table'));
  check('expenses table survived', (await call(`/events/${E1.id}/expenses`, { token: A.token })).status === 200);
  check('percentage split accepted', (await addEx(A.token, { split_type: 'percentage', split_between: [{ participant_id: partA.id, amount: 60, percentage: 50 }, { participant_id: partB.id, amount: 60, percentage: 50 }] })).status === 201);
  check('custom split accepted', (await addEx(A.token, { split_type: 'custom', split_between: [{ participant_id: partA.id, amount: 100 }, { participant_id: partB.id, amount: 20 }] })).status === 201);
  check('a ghost participant can be the payer', (await addEx(A.token, { paid_by: [{ participant_id: ghost[0].id, amount: 120 }] })).status === 201);
  const multi = await addEx(A.token, { paid_by: [{ participant_id: partA.id, amount: 70 }, { participant_id: partB.id, amount: 50 }] });
  check('multiple payers accepted', multi.status === 201 && multi.data.paid_by.length === 2);
  const noDate = await addEx(A.token, { date: undefined });
  check('missing date falls back to a default or is rejected', is(noDate, 201, 400), `status ${noDate.status}`);
  check('far-future date is handled', clean(await addEx(A.token, { date: '2099-01-01' })));
  const cats = await Promise.all(['food', 'transport', 'accommodation', 'activities', 'shopping', 'other'].map((c) => addEx(A.token, { category: c, description: 'cat ' + c })));
  check('known categories accepted', cats.filter((r) => r.status === 201).length >= 1, cats.map((r) => r.status).join(','));
  const list = await call(`/events/${E1.id}/expenses`, { token: A.token });
  check('expenses are ordered newest date first', list.data.every((e, i, a) => i === 0 || a[i - 1].date >= e.date));
  check('every date is a plain YYYY-MM-DD string', list.data.every((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date)));
  const par10 = await Promise.all(Array.from({ length: 10 }, (_, i) => addEx(A.token, { description: 'par' + i })));
  check('10 parallel expense creations all succeed', par10.every((r) => r.status === 201));
  const patchEx = (tok, id, body) => call(`/expenses/${id}`, { method: 'PATCH', token: tok, body });
  check('member edits an expense', (await patchEx(B.token, x1.data.id, { amount: 150, notes: 'edited' })).data.amount === 150);
  check('editing keeps the creator', (await patchEx(B.token, x1.data.id, { notes: 'again' })).data.created_by === A.id);
  check('outsider cannot edit', is(await patchEx(Z.token, x1.data.id, { amount: 1 }), 404));
  check('empty edit -> 400', is(await patchEx(A.token, x1.data.id, {}), 400));
  check('edit cannot move an expense to another event', is(await patchEx(A.token, x1.data.id, { event_id: e2r.data.id }), 400));
  check('edit cannot forge the creator', is(await patchEx(A.token, x1.data.id, { created_by: B.id }), 400));
  check('edit rejects a negative amount', is(await patchEx(A.token, x1.data.id, { amount: -1 }), 400));
  check('edit rejects a bad category', is(await patchEx(A.token, x1.data.id, { category: 'zzz' }), 400));
  check('edit of unknown id -> 404', is(await patchEx(A.token, uuid(), { amount: 1 }), 404));
  check('edit of malformed id is not a 500', clean(await patchEx(A.token, 'xyz', { amount: 1 })));
  const delEx = (tok, id) => call(`/expenses/${id}`, { method: 'DELETE', token: tok });
  check('outsider cannot delete', is(await delEx(Z.token, x1.data.id), 404));
  check('member deletes an expense', is(await delEx(C.token, x1.data.id), 204));
  check('deleting twice -> 404', is(await delEx(C.token, x1.data.id), 404));

  // ===================================================================== PAYMENTS
  sec('payments and settlement confirmations');
  const pay = (tok, over = {}) => call(`/events/${E1.id}/payments`, { method: 'POST', token: tok, body: { from_participant_id: partB.id, to_participant_id: partA.id, amount: 40, currency: 'ILS', ...over } });
  const p1 = await pay(B.token);
  check('create payment', p1.status === 201 && p1.data.amount === 40);
  for (const [label, over] of [['negative', { amount: -3 }], ['zero', { amount: 0 }], ['string', { amount: 'x' }], ['missing from', { from_participant_id: undefined }], ['unknown from', { from_participant_id: uuid() }], ['unknown to', { to_participant_id: uuid() }], ['paying yourself', { to_participant_id: partB.id }], ['bad currency', { currency: 'ZZZZZZZZZ' }]]) {
    const r = await pay(B.token, over);
    if (r.status === 201) await call(`/payments/${r.data.id}`, { method: 'DELETE', token: A.token });
    check(`payment rejects (${label})`, is(r, 400), `status ${r.status}`);
  }
  check('outsider cannot add a payment', is(await pay(Z.token), 404));
  check('outsider cannot list payments', is(await call(`/events/${E1.id}/payments`, { token: Z.token }), 404));
  check('payments list for members', (await call(`/events/${E1.id}/payments`, { token: C.token })).data.length >= 1);
  check('outsider cannot delete a payment', is(await call(`/payments/${p1.data.id}`, { method: 'DELETE', token: Z.token }), 404));
  check('delete payment', is(await call(`/payments/${p1.data.id}`, { method: 'DELETE', token: B.token }), 204));
  check('delete payment twice -> 404', is(await call(`/payments/${p1.data.id}`, { method: 'DELETE', token: B.token }), 404));
  const conf = (tok, from, to) => call(`/events/${E1.id}/confirmations`, { method: 'PUT', token: tok, body: { fromParticipantId: from, toParticipantId: to } });
  check('debtor confirms', (await conf(B.token, partB.id, partA.id)).data.confirmed === true);
  check('confirmation is idempotent', is(await conf(B.token, partB.id, partA.id), 200));
  check('a bystander cannot confirm for others', is(await conf(C.token, partB.id, partA.id), 403));
  check('manager can confirm for anyone', is(await conf(A.token, partC.id, partA.id), 200));
  check('confirm needs both ids', is(await conf(A.token, undefined, partA.id), 400));
  check('confirm with an unknown participant is rejected', is(await conf(A.token, uuid(), uuid()), 400, 404));
  check('outsider cannot confirm', is(await conf(Z.token, partB.id, partA.id), 404));
  check('exactly two confirmations stored', (await call(`/events/${E1.id}/confirmations`, { token: A.token })).data.length === 2);
  check('bystander cannot undo', is(await call(`/events/${E1.id}/confirmations?from=${partB.id}&to=${partA.id}`, { method: 'DELETE', token: C.token }), 403));
  check('undo needs both ids', is(await call(`/events/${E1.id}/confirmations?from=${partB.id}`, { method: 'DELETE', token: B.token }), 400));
  check('debtor undoes', is(await call(`/events/${E1.id}/confirmations?from=${partB.id}&to=${partA.id}`, { method: 'DELETE', token: B.token }), 204));
  check('undo malformed ids is not a 500', clean(await call(`/events/${E1.id}/confirmations?from=a&to=b`, { method: 'DELETE', token: A.token })));

  // ===================================================================== POLLS
  sec('polls');
  const mkPoll = (tok, body, id = E1.id) => call(`/events/${id}/polls`, { method: 'POST', token: tok, body });
  for (const [label, body] of [['no question', { options: ['a', 'b'] }], ['empty question', { question: '', options: ['a', 'b'] }], ['one option', { question: 'q', options: ['a'] }], ['no options', { question: 'q' }], ['options not an array', { question: 'q', options: 'ab' }], ['blank options', { question: 'q', options: ['', ' '] }], ['non-string options', { question: 'q', options: [1, { x: 1 }] }], ['question over 200 chars', { question: 'q'.repeat(201), options: ['a', 'b'] }], ['100 options', { question: 'q', options: Array.from({ length: 100 }, (_, i) => 'o' + i) }]]) {
    const r = await mkPoll(A.token, body);
    check(`poll rejects (${label})`, is(r, 400), `status ${r.status}`);
  }
  check('outsider cannot create a poll', is(await mkPoll(Z.token, { question: 'q', options: ['a', 'b'] }), 404));
  const pl = await mkPoll(B.token, { question: 'Where?', options: ['Beach', 'Hills', 'City'] });
  check('member creates a poll', pl.status === 201 && pl.data.options.length === 3 && pl.data.created_by === B.id);
  const vote = (tok, id, optionId) => call(`/polls/${id}/vote`, { method: 'POST', token: tok, body: { optionId } });
  const o = pl.data.options;
  check('outsider cannot vote', is(await vote(Z.token, pl.data.id, o[0].id), 404));
  check('vote for an unknown option -> 400', is(await vote(A.token, pl.data.id, uuid()), 400));
  check('vote with no option -> 400', is(await vote(A.token, pl.data.id, undefined), 400));
  check('vote on a malformed poll id is not a 500', clean(await vote(A.token, 'xx', o[0].id)));
  check('vote on an unknown poll -> 404', is(await vote(A.token, uuid(), o[0].id), 404));
  await Promise.all([A, B, C, D].map((u, i) => vote(u.token, pl.data.id, o[i % 3].id)));
  const pv = (await call(`/events/${E1.id}/polls`, { token: A.token })).data.find((x) => x.id === pl.data.id);
  check('four members voted, four votes counted', pv.poll_votes.length === 4);
  const sameUser = await Promise.all([o[0], o[1], o[2], o[0], o[1]].map((x) => vote(A.token, pl.data.id, x.id)));
  const pv2 = (await call(`/events/${E1.id}/polls`, { token: A.token })).data.find((x) => x.id === pl.data.id);
  check('rapid re-votes by one user never duplicate', pv2.poll_votes.filter((v) => v.user_id === A.id).length === 1 && sameUser.every(clean));
  check('a plain member cannot edit someone else poll', is(await call(`/polls/${pl.data.id}`, { method: 'PATCH', token: C.token, body: { question: 'x', options: o } }), 403));
  check('a plain member cannot close it', is(await call(`/polls/${pl.data.id}/close`, { method: 'POST', token: C.token }), 403));
  check('a plain member cannot delete it', is(await call(`/polls/${pl.data.id}`, { method: 'DELETE', token: C.token }), 403));
  check('edit with string options is rejected', is(await call(`/polls/${pl.data.id}`, { method: 'PATCH', token: B.token, body: { question: 'x', options: ['a', 'b'] } }), 400));
  check('edit with options lacking ids is rejected', is(await call(`/polls/${pl.data.id}`, { method: 'PATCH', token: B.token, body: { question: 'x', options: [{ label: 'a' }, { label: 'b' }] } }), 400));
  check('votes survive a rejected edit', (await call(`/events/${E1.id}/polls`, { token: A.token })).data.find((x) => x.id === pl.data.id).poll_votes.length === 4);
  const ed = await call(`/polls/${pl.data.id}`, { method: 'PATCH', token: A.token, body: { question: 'Where to?', options: [o[0], o[1]] } });
  check('manager edits a poll and drops one option', ed.status === 200 && ed.data.options.length === 2);
  const pv3 = (await call(`/events/${E1.id}/polls`, { token: A.token })).data.find((x) => x.id === pl.data.id);
  check('only votes for removed options are dropped', pv3.poll_votes.every((v) => [o[0].id, o[1].id].includes(v.option_id)));
  check('creator closes', (await call(`/polls/${pl.data.id}/close`, { method: 'POST', token: B.token })).data.closed === true);
  check('closing twice is harmless', is(await call(`/polls/${pl.data.id}/close`, { method: 'POST', token: B.token }), 200));
  check('closed polls reject votes', is(await vote(C.token, pl.data.id, o[0].id), 409));
  check('editing a closed poll does not crash', clean(await call(`/polls/${pl.data.id}`, { method: 'PATCH', token: B.token, body: { question: 'late', options: [o[0], o[1]] } })));
  check('creator deletes', is(await call(`/polls/${pl.data.id}`, { method: 'DELETE', token: B.token }), 204));
  check('deleting twice -> 404', is(await call(`/polls/${pl.data.id}`, { method: 'DELETE', token: B.token }), 404));
  check('deleted poll is gone from the list', !(await call(`/events/${E1.id}/polls`, { token: A.token })).data.some((x) => x.id === pl.data.id));
  const pl2 = await mkPoll(C.token, { question: 'manager deletes?', options: ['y', 'n'] });
  check('manager can delete someone else poll', is(await call(`/polls/${pl2.data.id}`, { method: 'DELETE', token: A.token }), 204));

  // ===================================================================== CHAT
  sec('chat: group');
  const sendG = (tok, body, id = E1.id) => call(`/events/${id}/group-messages`, { method: 'POST', token: tok, body });
  check('outsider cannot read group chat', is(await call(`/events/${E1.id}/group-messages`, { token: Z.token }), 404));
  check('outsider cannot post to group chat', is(await sendG(Z.token, { content: 'hi' }), 404));
  for (const [label, body] of [['empty', {}], ['blank', { content: '' }], ['null', { content: null }], ['numeric content', { content: 123 }], ['object content', { content: { a: 1 } }], ['content over 5000 chars', { content: 'x'.repeat(20000) }]]) {
    const r = await sendG(A.token, body);
    check(`group message rejects (${label})`, is(r, 400), `status ${r.status}`);
  }
  const g1 = await sendG(A.token, { content: 'שלום לכולם 👋' });
  check('hebrew group message', g1.status === 201 && g1.data.content === 'שלום לכולם 👋' && g1.data.from_participant_id === partA.id);
  const g2 = await sendG(B.token, { content: 'reply', reply_to_id: g1.data.id });
  check('reply links to the parent', g2.data.reply_to_id === g1.data.id);
  check('reply to an unknown message is rejected', is(await sendG(B.token, { content: 'x', reply_to_id: uuid() }), 400, 404));
  check('reply with a malformed id is not a 500', clean(await sendG(B.token, { content: 'x', reply_to_id: 'abc' })));
  const other = await mk(A.token, { title: 'other trip', participantName: 'A' });
  const gOther = await sendG(A.token, { content: 'in other' }, other.data.id);
  check('reply across trips is rejected', is(await sendG(A.token, { content: 'x', reply_to_id: gOther.data.id }), 400, 404), 'a reply must stay inside its trip');
  const loc = await sendG(A.token, { location: { lat: 32.08, lng: 34.78, label: 'Tel Aviv' } });
  check('location message', loc.status === 201 && loc.data.location.lat === 32.08);
  const med = await sendG(A.token, { media_url: 'https://example.com/a.png', media_meta: { type: 'image', name: 'a.png' } });
  check('media message', med.status === 201 && med.data.media_meta.type === 'image');
  const mk2 = await Promise.all(Array.from({ length: 15 }, (_, i) => sendG([A, B, C, D][i % 4].token, { content: 'burst ' + i })));
  check('15 parallel messages from 4 users all stored', mk2.every((r) => r.status === 201));
  const all = (await call(`/events/${E1.id}/group-messages`, { token: D.token })).data;
  check('group history is chronological', all.every((m, i, a) => i === 0 || new Date(a[i - 1].created_at) <= new Date(m.created_at)));
  check('group history contains everything', all.length >= 19, String(all.length));
  const editG = (tok, id, content) => call(`/group-messages/${id}`, { method: 'PATCH', token: tok, body: { content } });
  check('author edits', (await editG(A.token, g1.data.id, 'edited')).data.edited_at !== null);
  check('another member cannot edit', is(await editG(B.token, g1.data.id, 'x'), 403));
  check('the manager cannot edit someone else text either', is(await editG(A.token, g2.data.id, 'x'), 403));
  check('outsider cannot edit', is(await editG(Z.token, g1.data.id, 'x'), 404));
  check('edit to empty text -> 400', is(await editG(A.token, g1.data.id, ''), 400));
  check('edit to non-string -> 400', is(await call(`/group-messages/${g1.data.id}`, { method: 'PATCH', token: A.token, body: { content: 5 } }), 400));
  check('edit of unknown message -> 404', is(await editG(A.token, uuid(), 'x'), 404));
  check('edit of malformed id is not a 500', clean(await editG(A.token, 'zzz', 'x')));
  const react = (tok, id, emoji, path = 'group-messages') => call(`/${path}/${id}/react`, { method: 'POST', token: tok, body: { emoji } });
  check('react', (await react(B.token, g1.data.id, '👍')).data.reactions['👍'].includes(B.id));
  check('two users on one emoji', (await react(C.token, g1.data.id, '👍')).data.reactions['👍'].length === 2);
  check('different emoji alongside', Object.keys((await react(C.token, g1.data.id, '❤️')).data.reactions).length === 2);
  check('react rejects an empty emoji', is(await react(B.token, g1.data.id, ''), 400));
  check('react rejects a non-string emoji', is(await react(B.token, g1.data.id, 5), 400));
  check('react rejects a very long emoji', is(await react(B.token, g1.data.id, 'x'.repeat(50)), 400));
  check('outsider cannot react', is(await react(Z.token, g1.data.id, '👍'), 404));
  const rr = await Promise.all(Array.from({ length: 6 }, () => react(D.token, g2.data.id, '🔥')));
  const afterR = (await call(`/events/${E1.id}/group-messages`, { token: A.token })).data.find((m) => m.id === g2.data.id);
  check('6 simultaneous toggles by one user cancel out exactly', !afterR.reactions?.['🔥'] && rr.every(clean), JSON.stringify(afterR.reactions));
  const rr2 = await Promise.all([B, C, D, A].map((u) => react(u.token, g2.data.id, '🎉')));
  const afterR2 = (await call(`/events/${E1.id}/group-messages`, { token: A.token })).data.find((m) => m.id === g2.data.id);
  check('4 users reacting at once are all recorded', afterR2.reactions['🎉'].length === 4 && rr2.every(clean));
  const pinG = (tok, id) => call(`/group-messages/${id}/pin`, { method: 'POST', token: tok });
  check('pin sets pinned_at', (await pinG(B.token, g1.data.id)).data.pinned_at !== null);
  check('pin toggles off', (await pinG(C.token, g1.data.id)).data.pinned_at === null);
  check('outsider cannot pin', is(await pinG(Z.token, g1.data.id), 404));
  const rd = await call(`/events/${E1.id}/group-messages/read`, { method: 'POST', token: B.token });
  check('mark read updates others messages only', rd.status === 200 && rd.data.updated >= 1);
  check('mark read twice is a no-op', (await call(`/events/${E1.id}/group-messages/read`, { method: 'POST', token: B.token })).data.updated === 0);
  check('outsider cannot mark read', is(await call(`/events/${E1.id}/group-messages/read`, { method: 'POST', token: Z.token }), 404));
  const delG = (tok, id) => call(`/group-messages/${id}`, { method: 'DELETE', token: tok });
  check('another member cannot delete', is(await delG(C.token, g2.data.id), 403));
  const d1 = await delG(B.token, g2.data.id);
  check('author soft-deletes and content is wiped', d1.status === 200 && d1.data.content === null && d1.data.deleted_at);
  check('a deleted message cannot be edited', is(await editG(B.token, g2.data.id, 'zombie'), 409));
  check('deleting again is harmless', clean(await delG(B.token, g2.data.id)));
  check('manager deletes anyone', is(await delG(A.token, mk2[1].data.id), 200));
  check('deleted messages stay in history as tombstones', (await call(`/events/${E1.id}/group-messages`, { token: A.token })).data.some((m) => m.id === g2.data.id && m.deleted_at));
  check('media count counts the media message', (await call(`/events/${E1.id}/media-count`, { token: A.token })).data.count >= 1);
  check('outsider cannot read media count', is(await call(`/events/${E1.id}/media-count`, { token: Z.token }), 404));

  sec('chat: private');
  const sendP = (tok, to, body = {}, id = E1.id) => call(`/events/${id}/private-messages`, { method: 'POST', token: tok, body: { to_participant_id: to, content: 'dm', ...body } });
  const thread = (tok, withId, id = E1.id) => call(`/events/${id}/private-messages?with=${encodeURIComponent(withId)}`, { token: tok });
  const dm1 = await sendP(A.token, partB.id, { content: 'סוד בין A ל-B' });
  check('send DM', dm1.status === 201 && dm1.data.to_user_id === B.id && dm1.data.from_user_id === A.id);
  check('C cannot see the A-B thread from either side', (await thread(C.token, partB.id)).data.length === 0 && (await thread(C.token, partA.id)).data.length === 0);
  check('D cannot see it either', (await thread(D.token, partA.id)).data.length === 0);
  check('outsider cannot read threads', is(await thread(Z.token, partA.id), 404));
  check('thread requires with=', is(await call(`/events/${E1.id}/private-messages`, { token: A.token }), 400));
  check('with=<malformed> is not a 500', clean(await thread(A.token, 'not-a-uuid')));
  const inj = await thread(A.token, "' or '1'='1");
  check("with=' or 1=1 returns nothing", (Array.isArray(inj.data) && inj.data.length === 0) || is(inj, 400, 404), `status ${inj.status}`);
  check('C cannot edit an A-B message', is(await call(`/private-messages/${dm1.data.id}`, { method: 'PATCH', token: C.token, body: { content: 'x' } }), 404));
  check('C cannot delete an A-B message', is(await call(`/private-messages/${dm1.data.id}`, { method: 'DELETE', token: C.token }), 404));
  check('C cannot react to an A-B message', is(await react(C.token, dm1.data.id, '👍', 'private-messages'), 404));
  check('C cannot pin an A-B message', is(await call(`/private-messages/${dm1.data.id}/pin`, { method: 'POST', token: C.token }), 404));
  check('even the manager cannot read others DMs', (await thread(A.token, partC.id)).data.length === 0);
  check('recipient B reacts', (await react(B.token, dm1.data.id, '👍', 'private-messages')).data.reactions['👍'].includes(B.id));
  check('recipient B cannot edit', is(await call(`/private-messages/${dm1.data.id}`, { method: 'PATCH', token: B.token, body: { content: 'x' } }), 403));
  check('recipient B cannot delete A message (not manager)', is(await call(`/private-messages/${dm1.data.id}`, { method: 'DELETE', token: B.token }), 403));
  const dmEd = await call(`/private-messages/${dm1.data.id}`, { method: 'PATCH', token: A.token, body: { content: 'edited dm' } });
  check('author edits DM', dmEd.status === 200 && dmEd.data.content === 'edited dm');
  check('unknown recipient rejected', is(await sendP(A.token, uuid()), 400));
  check('recipient in another trip rejected', is(await sendP(A.token, other.data.participants[0].id), 400));
  check('empty DM rejected', is(await sendP(A.token, partB.id, { content: '' }), 400));
  check('DM over 5000 chars rejected', is(await sendP(A.token, partB.id, { content: 'x'.repeat(20000) }), 400));
  check('DM to a participant without an account is rejected or stored safely', is(await sendP(A.token, ghost[0].id, { content: 'to a ghost' }), 400, 201));
  check('DM to yourself is rejected or harmless', is(await sendP(A.token, partA.id, { content: 'note to self' }), 400, 201));
  check('unread counter for B', (await call(`/events/${E1.id}/private-unread`, { token: B.token })).data[partA.id] === 1);
  check('unread counter is private to the recipient', Object.keys((await call(`/events/${E1.id}/private-unread`, { token: C.token })).data).length === 0);
  check('read without a sender id -> 400', is(await call(`/events/${E1.id}/private-messages/read`, { method: 'POST', token: B.token, body: {} }), 400));
  check('read of a malformed sender id is not a 500', clean(await call(`/events/${E1.id}/private-messages/read`, { method: 'POST', token: B.token, body: { fromParticipantId: 'nope' } })));
  check('C marking the A-B thread read changes nothing', (await call(`/events/${E1.id}/private-messages/read`, { method: 'POST', token: C.token, body: { fromParticipantId: partA.id } })).data.updated === 0);
  check('B marks it read', (await call(`/events/${E1.id}/private-messages/read`, { method: 'POST', token: B.token, body: { fromParticipantId: partA.id } })).data.updated === 1);
  const dmDel = await call(`/private-messages/${dm1.data.id}`, { method: 'DELETE', token: A.token });
  check('author deletes DM and the text is wiped', dmDel.status === 200 && dmDel.data.content === null);
  const bToC = await sendP(B.token, partC.id, { content: 'B to C' });
  check('the manager cannot delete a DM they are not part of', is(await call(`/private-messages/${bToC.data.id}`, { method: 'DELETE', token: A.token }), 403, 404), 'the manager is not a party to this conversation');

  sec('chat: settlement system messages');
  const sync = (tok, messages, id = E1.id) => call(`/events/${id}/settlement-messages/sync`, { method: 'POST', token: tok, body: { messages } });
  const msg = (a, b, content, k) => ({ key: k ?? `settlement:${a.id}:${b.id}`, fromParticipantId: a.id, toParticipantId: b.id, content });
  check('sync with no body array is harmless', is(await call(`/events/${E1.id}/settlement-messages/sync`, { method: 'POST', token: A.token, body: {} }), 200));
  check('sync rejects keys without the settlement prefix', (await sync(A.token, [msg(partB, partA, 'x', 'evil:key')])).data.changed === 0);
  check('sync ignores messages for unknown participants', (await sync(A.token, [{ key: 'settlement:x:y', fromParticipantId: uuid(), toParticipantId: uuid(), content: 'x' }])).data.changed === 0);
  check('sync ignores ghost participants', (await sync(A.token, [msg(ghost[0], partA, 'x')])).data.changed === 0);
  check('sync rejects non-array messages', clean(await call(`/events/${E1.id}/settlement-messages/sync`, { method: 'POST', token: A.token, body: { messages: 'x' } })));
  check('outsider cannot sync', is(await sync(Z.token, []), 404));
  check('sync inserts', (await sync(A.token, [msg(partB, partA, 'You owe 40')])).data.changed === 1);
  check('sync is idempotent', (await sync(A.token, [msg(partB, partA, 'You owe 40')])).data.changed === 0);
  check('sync updates in place', (await sync(A.token, [msg(partB, partA, 'You owe 55')])).data.changed === 1);
  check('both sides see exactly one live system message', (await thread(B.token, partA.id)).data.filter((m) => m.is_system && !m.deleted_at).length === 1 && (await thread(A.token, partB.id)).data.filter((m) => m.is_system && !m.deleted_at).length === 1);
  check('C cannot see the system message in their own threads', (await thread(C.token, partA.id)).data.filter((m) => m.is_system).length === 0);
  await sync(C.token, [msg(partB, partA, 'Spoofed by C: B owes 9999')]);
  const seenText = (await thread(B.token, partA.id)).data.find((m) => m.is_system && !m.deleted_at)?.content;
  check('a bystander cannot overwrite a settlement message between two other people', seenText !== 'Spoofed by C: B owes 9999', `thread now says: "${seenText}"`);
  check('removing a debt retires the message', (await sync(A.token, [])).data.changed >= 1);
  check('no live system messages remain', (await thread(B.token, partA.id)).data.filter((m) => m.is_system && !m.deleted_at).length === 0);
  const sPar = await Promise.all(Array.from({ length: 6 }, () => sync(A.token, [msg(partB, partA, 'parallel')])));
  check('parallel syncs do not duplicate the message', (await thread(B.token, partA.id)).data.filter((m) => m.is_system && !m.deleted_at).length === 1 && sPar.every(clean));
  await sync(A.token, []);

  sec('typing and notifications');
  check('typing for outsider -> 404', is(await call(`/events/${E1.id}/typing`, { method: 'POST', token: Z.token, body: { scope: 'group', isTyping: true } }), 404));
  check('typing accepts garbage bodies', clean(await call(`/events/${E1.id}/typing`, { method: 'POST', token: A.token, body: { scope: 5 } })));
  check('typing returns 204', is(await call(`/events/${E1.id}/typing`, { method: 'POST', token: A.token, body: { scope: 'group', isTyping: false } }), 204));
  const notify = (tok, body, id = E1.id) => call(`/events/${id}/notify`, { method: 'POST', token: tok, body });
  check('notify needs type and title', is(await notify(A.token, { type: 'chat' }), 400) && is(await notify(A.token, { title: 'x' }), 400));
  check('outsider cannot notify a trip', is(await notify(Z.token, { type: 'chat', title: 'spam' }), 404));
  const n1 = await notify(A.token, { type: 'chat', title: 'hello', body: 'x', data: { tab: 'group' } });
  check('notify reaches the other three members, not the sender', n1.data.sent === 3);
  check('sender gets nothing', (await call('/notifications', { token: A.token })).data.length === 0);
  check('each recipient got exactly one', (await Promise.all([B, C, D].map((u) => call('/notifications', { token: u.token })))).every((r) => r.data.length === 1));
  check('onlyUserIds narrows delivery', (await notify(A.token, { type: 'chat', title: 'only B', onlyUserIds: [B.id] })).data.sent === 1);
  check('onlyUserIds cannot reach a non-member', (await notify(A.token, { type: 'chat', title: 'x', onlyUserIds: [Z.id] })).data.sent === 0);
  check('onlyUserIds with garbage is not a 500', clean(await notify(A.token, { type: 'chat', title: 'x', onlyUserIds: 'B' })));
  check('unknown notification types do not crash', clean(await notify(A.token, { type: 'weird', title: 'x' })));
  check('very long notification text is bounded', is(await notify(A.token, { type: 'chat', title: 't'.repeat(100000) }), 400, 413));
  check('notifications are capped at 50 per fetch', (await call('/notifications', { token: B.token })).data.length <= 50);
  const bn = (await call('/notifications', { token: B.token })).data;
  await call(`/notifications/${bn[0].id}/read`, { method: 'POST', token: C.token });
  check("cannot mark someone else's notification read", (await call('/notifications', { token: B.token })).data.find((n) => n.id === bn[0].id).read === false);
  check('mark one read', is(await call(`/notifications/${bn[0].id}/read`, { method: 'POST', token: B.token }), 204));
  check('mark read with malformed id is not a 500', clean(await call('/notifications/xyz/read', { method: 'POST', token: B.token })));
  check('read-all', is(await call('/notifications/read-all', { method: 'POST', token: B.token }), 204) && (await call('/notifications', { token: B.token })).data.every((n) => n.read));

  sec('profile and privacy');
  const prof = (tok, body) => call('/me/profile', { method: 'PATCH', token: tok, body });
  check('profile exists after sign-up', is(await call('/me/profile', { token: A.token }), 200));
  check('empty profile patch -> 400', is(await prof(A.token, {}), 400));
  check('phone saved', (await prof(A.token, { phone: '0501234567' })).data.phone === '0501234567');
  check('phone must be a string', is(await prof(A.token, { phone: { a: 1 } }), 400));
  check('phone length is bounded', is(await prof(A.token, { phone: '9'.repeat(500) }), 400));
  check('prefs must be an object', is(await prof(A.token, { notification_prefs: 'yes' }), 400));
  check('prefs saved', (await prof(A.token, { notification_prefs: { chat: false, expenses: true, balance_changes: true, daily_digest: false } })).data.notification_prefs.chat === false);
  check('chat pref off suppresses chat notifications', (await notify(B.token, { type: 'chat', title: 'x', onlyUserIds: [A.id] })).data.sent === 0);
  check('poll notifications follow the chat preference', (await notify(B.token, { type: 'poll', title: 'x', onlyUserIds: [A.id] })).data.sent === 0);
  check('expense notifications still arrive when on', (await notify(B.token, { type: 'expense', title: 'x', onlyUserIds: [A.id] })).data.sent === 1);
  check('profile cannot change id or email', is(await prof(A.token, { id: B.id, email: 'x@y.z' }), 400));
  check('co-members can see each other phone', (await call(`/profiles?ids=${A.id}`, { token: B.token })).data[0]?.phone === '0501234567');
  check('strangers cannot see a phone', (await call(`/profiles?ids=${A.id}`, { token: Z.token })).data.length === 0);
  check('profiles with no ids -> empty list', (await call('/profiles', { token: A.token })).data.length === 0);
  check('profiles with malformed ids is not a 500', clean(await call('/profiles?ids=a,b,%27', { token: A.token })));
  check('profiles response never includes email', !('email' in ((await call(`/profiles?ids=${A.id}`, { token: B.token })).data[0] ?? {})));
  check('profiles with 500 ids is bounded', clean(await call(`/profiles?ids=${Array.from({ length: 500 }, uuid).join(',')}`, { token: A.token })));

  sec('push registration');
  const ep = 'https://push.example/' + rnd;
  check('web push needs fields', is(await call('/push/web', { method: 'POST', token: A.token, body: {} }), 400));
  check('web push subscribe', is(await call('/push/web', { method: 'POST', token: A.token, body: { endpoint: ep, p256dh: 'k', auth: 'a' } }), 204));
  check('web push subscribe twice is idempotent', is(await call('/push/web', { method: 'POST', token: A.token, body: { endpoint: ep, p256dh: 'k2', auth: 'a2' } }), 204));
  check('web push rejects non-http endpoints', is(await call('/push/web', { method: 'POST', token: A.token, body: { endpoint: 'javascript:alert(1)', p256dh: 'k', auth: 'a' } }), 400));
  check('web push unsubscribe', is(await call(`/push/web?endpoint=${encodeURIComponent(ep)}`, { method: 'DELETE', token: A.token }), 204));
  check('fcm needs a token', is(await call('/push/fcm', { method: 'POST', token: A.token, body: {} }), 400));
  check('fcm register', is(await call('/push/fcm', { method: 'POST', token: A.token, body: { token: 'fake-token-' + rnd } }), 204));
  check('fcm register twice', is(await call('/push/fcm', { method: 'POST', token: A.token, body: { token: 'fake-token-' + rnd } }), 204));
  const delivered = await notify(B.token, { type: 'expense', title: 'push path', onlyUserIds: [A.id] });
  check('a failing fcm token never breaks the notify call', delivered.status === 200 && delivered.data.sent === 1);
  check('fcm unregister', is(await call('/push/fcm', { method: 'DELETE', token: A.token }), 204));
  check('push routes need auth', is(await call('/push/fcm', { method: 'POST', body: { token: 'x' } }), 401));

  // ===================================================================== UPLOADS
  sec('uploads and files');
  const up = (tok, bucket, path, body = 'hello', ctype = 'image/png') => call(`/uploads/${bucket}?path=${encodeURIComponent(path)}`, { method: 'POST', token: tok, rawBody: body, ctype });
  const f = () => `${E1.id}/${uuid()}.png`;
  const okUp = await up(A.token, 'receipts', f(), 'PNGDATA');
  check('upload to an event bucket', okUp.status === 201 && /\/files\/receipts\//.test(okUp.data.url), okUp.text.slice(0, 80));
  const url = okUp.data.url?.replace(/^https?:\/\/[^/]+/, '');
  const got = await call(url ?? '/files/none');
  check('uploaded file is served back byte for byte', got.status === 200 && got.text === 'PNGDATA');
  check('served with the original content type', got.headers.get('content-type') === 'image/png');
  check('served with nosniff', got.headers.get('x-content-type-options') === 'nosniff');
  check('images are shown inline', got.headers.get('content-disposition') === 'inline');
  check('files are cacheable for a long time', /max-age=31536000/.test(got.headers.get('cache-control') ?? ''));
  check('upload needs auth', is(await call(`/uploads/receipts?path=${f()}`, { method: 'POST', rawBody: 'x', ctype: 'image/png' }), 401));
  check('upload to a trip you are not in -> 404', is(await up(Z.token, 'receipts', f()), 404));
  check('any member may upload to the trip', is(await up(C.token, 'chat-media', f()), 201));
  check('unknown bucket -> 400', is(await up(A.token, 'secrets', f()), 400));
  for (const [label, p] of [['path traversal', `${E1.id}/../../../etc/passwd`], ['non-uuid name', `${E1.id}/evil.png`], ['missing file part', E1.id], ['empty path', ''], ['double extension', `${E1.id}/${uuid()}.png.exe`], ['long extension', `${E1.id}/${uuid()}.abcdefghijk`], ['backslashes', `${E1.id}\\${uuid()}.png`], ['url-encoded traversal', `${E1.id}/%2e%2e/${uuid()}.png`]]) {
    check(`upload rejects (${label})`, is(await up(A.token, 'receipts', p), 400, 404));
  }
  const dupPath = f(); await up(A.token, 'receipts', dupPath);
  check('uploading to an existing path -> 409', is(await up(A.token, 'receipts', dupPath), 409));
  check('empty upload -> 400', is(await up(A.token, 'receipts', f(), ''), 400));
  check('feedback bucket accepts own folder', is(await up(A.token, 'feedback', `${A.id}/${uuid()}.jpg`, 'x', 'image/jpeg'), 201));
  check('feedback bucket refuses another user folder', is(await up(B.token, 'feedback', `${A.id}/${uuid()}.jpg`, 'x', 'image/jpeg'), 403));
  check('avatars bucket accepts own folder', is(await up(A.token, 'avatars', `${A.id}/${uuid()}.png`, 'x'), 201));
  const html = await up(A.token, 'chat-media', f().replace('.png', '.html'), '<script>alert(1)</script>', 'text/html');
  const htmlGot = html.data.url ? await call(html.data.url.replace(/^https?:\/\/[^/]+/, '')) : { headers: new Headers() };
  check('uploaded HTML is forced to download', htmlGot.headers.get('content-disposition') === 'attachment');
  const svg = await up(A.token, 'chat-media', f().replace('.png', '.svg'), '<svg onload="alert(1)"/>', 'image/svg+xml');
  const svgGot = svg.data.url ? await call(svg.data.url.replace(/^https?:\/\/[^/]+/, '')) : { headers: new Headers() };
  check('uploaded SVG is forced to download', svgGot.headers.get('content-disposition') === 'attachment');
  check('file read: unknown file -> 404', is(await call(`/files/receipts/${E1.id}/${uuid()}.png`), 404));
  check('file read: traversal -> 404', is(await call('/files/receipts/..%2f..%2fetc/passwd'), 404));
  check('file read: unknown bucket -> 404', is(await call(`/files/secrets/${E1.id}/${uuid()}.png`), 404));
  check('file read: sidecar type files are not exposed', is(await call(`${url}.type`), 404));
  check('file read: no directory listing', is(await call(`/files/receipts/${E1.id}/`), 404));
  const bigUp = await up(A.token, 'receipts', f(), Buffer.alloc(26 * 1024 * 1024, 1), 'application/octet-stream');
  check('26MB upload is refused', is(bigUp, 413), `status ${bigUp.status}`);
  const parallelUp = await Promise.all(Array.from({ length: 8 }, () => up(B.token, 'chat-media', f(), 'data')));
  check('8 parallel uploads succeed', parallelUp.every((r) => r.status === 201));
  const sameName = `${E1.id}/${uuid()}.png`;
  const raceUp = await Promise.all([1, 2, 3, 4].map(() => up(A.token, 'receipts', sameName)));
  check('parallel uploads to one path: exactly one wins', raceUp.filter((r) => r.status === 201).length === 1 && raceUp.every(clean), raceUp.map((r) => r.status).join(','));

  // ===================================================================== FEEDBACK / ADMIN
  sec('feedback and admin');
  check('feedback needs auth', is(await call('/feedback', { method: 'POST', body: { message: 'x' } }), 401));
  check('empty feedback -> 400', is(await call('/feedback', { method: 'POST', token: A.token, body: { message: '   ' } }), 400));
  check('feedback over 4000 chars -> 400', is(await call('/feedback', { method: 'POST', token: A.token, body: { message: 'x'.repeat(4001) } }), 400));
  check('feedback with non-string message handled', clean(await call('/feedback', { method: 'POST', token: A.token, body: { message: { a: 1 } } })));
  check('feedback attachment must be an http(s) link', is(await call('/feedback', { method: 'POST', token: A.token, body: { message: 'bad link', attachmentUrl: 'javascript:alert(1)' } }), 400));
  check('feedback attachment must be a string', is(await call('/feedback', { method: 'POST', token: A.token, body: { message: 'bad link', attachmentUrl: { a: 1 } } }), 400));
  check('regular users cannot open the admin overview', is(await call('/admin/overview', { token: A.token }), 403));
  check('regular users cannot read feedback', is(await call('/admin/feedback', { token: A.token }), 403));
  const adm = await newUser('adm', 'nisan4050@gmail.com');
  check('admin email in the name field does not grant admin', is(await call('/admin/overview', { token: adm.token }), 403));
  const forgedAdmin = await call('/auth/register', { method: 'POST', body: { email: 'NISAN4050@gmail.com', password: pw, name: 'x' } });
  check('the admin address cannot be claimed by a stranger', is(forgedAdmin, 409), `status ${forgedAdmin.status}`);
  if (forgedAdmin.status === 201) { tokens.push(forgedAdmin.data.token); await call('/me', { method: 'DELETE', token: forgedAdmin.data.token }); }

  // ===================================================================== PASSWORD RESET
  sec('password reset');
  const forgot = (body) => call('/auth/forgot', { method: 'POST', body });
  check('forgot: known and unknown look identical', JSON.stringify((await forgot({ email: em('a') })).data) === JSON.stringify((await forgot({ email: em('ghost') })).data));
  for (const [label, body] of [['empty', {}], ['non-string email', { email: { a: 1 } }], ['array email', { email: ['a@b.c'] }], ['null', null]]) {
    check(`forgot handles (${label})`, clean(await forgot(body)));
  }
  const burst = await Promise.all(Array.from({ length: 6 }, () => forgot({ email: em('b') })));
  check('forgot burst is accepted without errors', burst.every((r) => r.status === 200));
  const reset = (body) => call('/auth/reset', { method: 'POST', body });
  for (const [label, body] of [['no token', { password: 'abcdef1' }], ['no password', { token: 'x' }], ['short password', { token: 'x', password: '123' }], ['object token', { token: { a: 1 }, password: 'abcdef1' }], ['array password', { token: 'x', password: ['abcdefg'] }], ['unknown token', { token: 'x'.repeat(43), password: 'abcdef1' }], ['huge password', { token: 'x', password: 'p'.repeat(100000) }]]) {
    const r = await reset(body);
    check(`reset rejects (${label})`, is(r, 400, 413), `status ${r.status}`);
  }
  check('login still works after failed resets', is(await login({ email: em('a'), password: pw }), 200));

  // ===================================================================== REALTIME
  sec('realtime');
  const wait = async (fn, ms = 4000) => { const t = Date.now(); while (Date.now() - t < ms) { if (fn()) return true; await new Promise((r) => setTimeout(r, 100)); } return fn(); };
  const sA = openStream(API, `/events/${E1.id}/stream`, A.token);
  const sB = openStream(API, `/events/${E1.id}/stream`, B.token);
  const sC = openStream(API, `/events/${E1.id}/stream`, C.token);
  const sC2 = openStream(API, `/events/${E1.id}/stream`, C.token);
  const uA = openStream(API, '/stream', A.token);
  await new Promise((r) => setTimeout(r, 1500));
  const seen = (st, name, pred = () => true) => st.events.some((e) => e.name === name && pred(e.data));
  const live = await sendG(A.token, { content: 'live ' + rnd });
  check('all members get a group message live', await wait(() => seen(sB, 'group_message', (d) => d.row.id === live.data.id) && seen(sC, 'group_message', (d) => d.row.id === live.data.id)));
  check('two tabs of one user both receive it', await wait(() => seen(sC2, 'group_message', (d) => d.row.id === live.data.id)));
  const dmLive = await sendP(A.token, partB.id, { content: 'live dm' });
  check('the recipient gets a DM live', await wait(() => seen(sB, 'private_message', (d) => d.row.id === dmLive.data.id)));
  check('a third member never receives a DM', !seen(sC, 'private_message', (d) => d.row.id === dmLive.data.id));
  await react(B.token, live.data.id, '🚀');
  check('reaction updates stream to others', await wait(() => seen(sA, 'group_message', (d) => d.eventType === 'UPDATE' && d.row.id === live.data.id)));
  check('outsider cannot open the event stream', (await fetch(`${API}/events/${E1.id}/stream?token=${Z.token}`)).status === 404);
  sC2.close();
  const live2 = await sendG(A.token, { content: 'after one tab closed' });
  check('closing one tab does not break the other', await wait(() => seen(sC, 'group_message', (d) => d.row.id === live2.data.id)));
  await notify(B.token, { type: 'expense', title: 'ping', onlyUserIds: [A.id] });
  check('user stream gets notifications', await wait(() => seen(uA, 'notification')));
  const ping = await fetch(`${API}/events/${E1.id}/stream?token=${A.token}`);
  check('stream replies with the SSE content type', /text\/event-stream/.test(ping.headers.get('content-type') ?? ''));
  await ping.body.cancel();
  [sA, sB, sC, uA].forEach((st) => st.close());

  // ===================================================================== ACCOUNT LIFECYCLE
  sec('account deletion lifecycle');
  const evZ = (await mk(Z.token, { title: 'Z solo trip', participantName: 'Z', extraParticipantNames: ['Friend'] })).data;
  await call('/events/join', { method: 'POST', token: D.token, body: { inviteCode: evZ.invite_code, name: 'QA D' } });
  await sendG(Z.token, { content: 'before leaving' }, evZ.id);
  await up(Z.token, 'receipts', `${evZ.id}/${uuid()}.png`);
  await up(Z.token, 'feedback', `${Z.id}/${uuid()}.png`);
  await call('/push/fcm', { method: 'POST', token: Z.token, body: { token: 'z-token-' + rnd } });
  const delZ = await call('/me', { method: 'DELETE', token: Z.token });
  check('manager deletes their account', delZ.status === 200 && delZ.data.deleted === true);
  const evAfter = await call(`/events/${evZ.id}`, { token: D.token });
  check('the trip survives and D becomes manager', evAfter.status === 200 && evAfter.data.manager_user_id === D.id && !evAfter.data.participants.some((x) => x.user_id === Z.id));
  check('the deleted member remains as a participant without an account', evAfter.data.participants.some((x) => x.name === 'Z' && !x.user_id));
  check('their message stays but is detached', (await call(`/events/${evZ.id}/group-messages`, { token: D.token })).data.some((m) => m.content === 'before leaving' && m.from_user_id === null));
  check('their token is rejected after deletion', is(await call('/auth/me', { token: Z.token }), 401, 404));
  const zombie = await call('/events', { method: 'POST', token: Z.token, body: { title: 'zombie', participantName: 'z' } });
  check('a deleted user token cannot create data', is(zombie, 401, 403, 404), `status ${zombie.status}`);
  if (zombie.status === 201) await call(`/events/${zombie.data.id}`, { method: 'DELETE', token: Z.token });
  check('a deleted user cannot send feedback', is(await call('/feedback', { method: 'POST', token: Z.token, body: { message: 'zombie feedback' } }), 401, 403, 404));
  check('deleting twice does not crash', clean(await call('/me', { method: 'DELETE', token: Z.token })));
  check('login fails after deletion', is(await login({ email: em('z'), password: pw }), 401));
  const reuse = await reg({ email: em('z'), password: pw, name: 'Z again' });
  if (reuse.status === 201) tokens.push(reuse.data.token);
  check('the same email can register again', reuse.status === 201);
  check('and starts with a clean slate', reuse.status === 201 && (await call('/events', { token: reuse.data.token })).data.length === 0);
  check('new manager deletes the trip', is(await call(`/events/${evZ.id}`, { method: 'DELETE', token: D.token }), 204));
  check('trip is gone for everyone', is(await call(`/events/${evZ.id}`, { token: D.token }), 404));

  // ===================================================================== INVALID IDS
  sec('malformed ids never produce a 500');
  const bads = ['not-a-uuid', '123', "'"];
  const routes = [['GET', '/events/X'], ['PATCH', '/events/X', { title: 'x' }], ['DELETE', '/events/X'], ['POST', '/events/X/transfer-manager', { newManagerId: 'x' }],
    ['GET', '/events/X/expenses'], ['POST', '/events/X/expenses', base()], ['GET', '/events/X/payments'], ['POST', '/events/X/payments', {}], ['GET', '/events/X/confirmations'],
    ['GET', '/events/X/polls'], ['POST', '/events/X/polls', { question: 'q', options: ['a', 'b'] }], ['GET', '/events/X/group-messages'], ['POST', '/events/X/group-messages', { content: 'x' }],
    ['GET', '/events/X/private-messages?with=y'], ['GET', '/events/X/private-unread'], ['GET', '/events/X/media-count'], ['POST', '/events/X/notify', { type: 'chat', title: 'x' }],
    ['POST', '/events/X/typing', {}], ['POST', '/events/X/settlement-messages/sync', { messages: [] }], ['GET', '/events/X/stream'],
    ['PATCH', '/expenses/X', { amount: 1 }], ['DELETE', '/expenses/X'], ['DELETE', '/payments/X'], ['POST', '/polls/X/vote', { optionId: 'x' }], ['PATCH', '/polls/X', { question: 'q', options: [] }],
    ['POST', '/polls/X/close'], ['DELETE', '/polls/X'], ['PATCH', '/group-messages/X', { content: 'x' }], ['DELETE', '/group-messages/X'], ['POST', '/group-messages/X/pin'],
    ['POST', '/group-messages/X/react', { emoji: 'a' }], ['PATCH', '/private-messages/X', { content: 'x' }], ['DELETE', '/private-messages/X'], ['POST', '/notifications/X/read']];
  for (const [method, tpl, body] of routes) {
    const fails = [];
    for (const bid of bads) {
      const r = await call(tpl.replace('X', encodeURIComponent(bid)), { method, token: A.token, body });
      if (r.status >= 500) fails.push(`${bid}->${r.status}`);
    }
    check(`${method} ${tpl} survives odd ids`, fails.length === 0, fails.join(' '));
  }
  check('zero uuid is a clean 404', (await call('/events/00000000-0000-0000-0000-000000000000', { token: A.token })).status === 404);
} finally {
  // ---- cleanup: remove everything this run created ----
  for (const t of tokens) await call('/me', { method: 'DELETE', token: t }).catch(() => {});
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.log('\nFAILED:');
  for (const r of failed) console.log(` - [${r.section}] ${r.name}${r.extra ? ' -> ' + r.extra : ''}`);
}
process.exit(failed.length ? 1 : 0);
