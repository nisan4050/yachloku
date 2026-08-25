// Emails a developer_feedback row (with its attachment link, if any) to
// nisan4050@gmail.com via Resend (https://resend.com — free tier: 100
// emails/day, 3,000/month, no credit card required).
//
// Deploy:
//   npx supabase functions deploy send-feedback-email --no-verify-jwt
//   npx supabase secrets set RESEND_API_KEY=<from resend.com/api-keys>
//   npx supabase secrets set WEBHOOK_SECRET=<same value as in supabase/05_push_notifications.sql>
//   npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<Project Settings -> API -> service_role>
//
// Resend also requires verifying a sending domain (or use their shared
// onboarding@resend.dev sender for testing) before it will actually deliver —
// see resend.com/domains.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.4';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const DEVELOPER_EMAIL = 'nisan4050@gmail.com';

Deno.serve(async (req) => {
  if (req.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
    return new Response('unauthorized', { status: 401 });
  }

  const { feedback_id } = await req.json();
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: feedback, error } = await supabase
    .from('developer_feedback')
    .select('*')
    .eq('id', feedback_id)
    .single();
  if (error || !feedback) {
    return new Response(JSON.stringify({ error: error?.message ?? 'feedback not found' }), { status: 404 });
  }

  const html = `
    <p><strong>From:</strong> ${feedback.sender_name ?? ''} (${feedback.sender_email ?? 'unknown'})</p>
    <p><strong>User ID:</strong> ${feedback.user_id}</p>
    <p><strong>Sent at:</strong> ${feedback.created_at}</p>
    <p><strong>Message:</strong></p>
    <p>${feedback.message.replace(/\n/g, '<br>')}</p>
    ${feedback.attachment_url ? `<p><a href="${feedback.attachment_url}">View attachment</a></p>` : ''}
  `;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Yachloku Feedback <onboarding@resend.dev>',
      to: DEVELOPER_EMAIL,
      reply_to: feedback.sender_email || undefined,
      subject: `Yachloku feedback from ${feedback.sender_name || feedback.sender_email || 'a user'}`,
      html,
    }),
  });

  if (!res.ok) {
    return new Response(JSON.stringify({ error: await res.text() }), { status: 502 });
  }
  return new Response(JSON.stringify({ sent: true }), { headers: { 'Content-Type': 'application/json' } });
});
