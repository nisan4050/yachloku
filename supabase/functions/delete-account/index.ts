// Deletes the calling user's own account. Requires a valid user JWT (the
// gateway verifies it before this runs, since this function is deployed
// WITH --verify-jwt, unlike the others in this project).
//
// A user_id shows up all over the schema (events.created_by/manager_user_id,
// expenses/payments/polls.created_by, chat/group_messages.from_user_id, and
// inside every event's `participants` JSONB array) — none of that can just
// cascade-delete, or one person leaving would blow away shared trip history
// for everyone else still in it. So before calling auth.admin.deleteUser:
//   - every event's `participants` entry for this user is turned into a
//     "ghost" participant (user_id set to null, name kept) — same shape as
//     the existing manually-added participants, so expense splits still add
//     up and past messages still show a name instead of breaking
//   - if they managed an event, management transfers to another
//     account-linked participant if one exists; if not (they were the only
//     real user left), the event is deleted outright rather than orphaned
//   - everything else (created_by / from_user_id / to_user_id columns) is
//     covered by the ON DELETE SET NULL migration in
//     supabase/13_account_deletion.sql, so it's left for Postgres
//
// Deploy:
//   npx supabase functions deploy delete-account
//   npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<Project Settings -> API -> service_role>
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// The web/native app calls this directly from the browser (functions.invoke),
// unlike the project's other functions which are only ever called
// server-to-server — so unlike those, this one needs to handle the browser's
// CORS preflight and echo the header on every response.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userError,
  } = await callerClient.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: CORS_HEADERS });
  }
  const userId = user.id;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: events, error: eventsError } = await admin
    .from('events')
    .select('id, manager_user_id, participants')
    .filter('participants', 'cs', JSON.stringify([{ user_id: userId }]));
  if (eventsError) {
    return new Response(JSON.stringify({ error: eventsError.message }), { status: 500, headers: CORS_HEADERS });
  }

  for (const event of events ?? []) {
    const nextParticipants = event.participants.map((p) =>
      p.user_id === userId ? { ...p, user_id: null } : p
    );
    const isManager = event.manager_user_id === userId;
    const nextManager = isManager ? nextParticipants.find((p) => p.user_id) : null;

    if (isManager && !nextManager) {
      // No other account-linked participant left to hand the trip to.
      const { error } = await admin.from('events').delete().eq('id', event.id);
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS_HEADERS });
      continue;
    }

    const patch = { participants: nextParticipants };
    if (isManager) {
      patch.manager_user_id = nextManager.user_id;
      patch.previous_manager_user_id = userId;
      patch.manager_changed_at = new Date().toISOString();
    }
    const { error } = await admin.from('events').update(patch).eq('id', event.id);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS_HEADERS });
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    return new Response(JSON.stringify({ error: deleteError.message }), { status: 500, headers: CORS_HEADERS });
  }

  return new Response(JSON.stringify({ deleted: true }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
});
