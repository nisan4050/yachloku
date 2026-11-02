import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useLang } from '@/hooks/useLang';
import { getAdminOverview, getAdminFeedback } from '@/api/admin';
import { formatBytes } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const DAY = 24 * 60 * 60 * 1000;

function statusOf(user) {
  if (!user.last_seen_at) return 'never';
  return Date.now() - new Date(user.last_seen_at).getTime() <= 7 * DAY ? 'active' : 'inactive';
}

const STATUS_STYLE = {
  active: 'bg-primary/15 text-primary',
  inactive: 'bg-muted text-muted-foreground',
  never: 'bg-secondary/15 text-secondary',
};

export default function Admin() {
  const { user } = useAuth();
  const { lang } = useLang();
  const [tab, setTab] = useState('users');
  const he = lang === 'he';
  const locale = he ? 'he-IL' : 'en-GB';

  const overview = useQuery({ queryKey: ['admin-overview'], queryFn: getAdminOverview, enabled: Boolean(user?.isAdmin) });
  const feedback = useQuery({ queryKey: ['admin-feedback'], queryFn: getAdminFeedback, enabled: Boolean(user?.isAdmin) });

  if (!user?.isAdmin) return <Navigate to="/home" replace />;

  const fmt = (value) => (value ? new Date(value).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' }) : '—');
  const statusLabel = { active: he ? 'פעיל' : 'Active', inactive: he ? 'לא פעיל' : 'Inactive', never: he ? 'טרם נצפה' : 'Not seen yet' };

  const totals = overview.data?.totals;
  const stats = totals
    ? [
        [he ? 'משתמשים' : 'Users', totals.users],
        [he ? 'פעילים ב-7 ימים' : 'Active (7d)', totals.active_7d],
        [he ? 'פעילים ב-30 יום' : 'Active (30d)', totals.active_30d],
        [he ? 'חדשים ב-7 ימים' : 'New (7d)', totals.new_7d],
        [he ? 'טיולים' : 'Trips', `${totals.events} (${totals.active_events} ${he ? 'פעילים' : 'active'})`],
        [he ? 'הוצאות' : 'Expenses', totals.expenses],
        [he ? 'הודעות' : 'Messages', totals.messages],
        [he ? 'קבצים' : 'Files', `${totals.storage_files} · ${formatBytes(totals.storage_bytes)}`],
        [he ? 'הערות' : 'Feedback', totals.feedback],
      ]
    : [];

  const tabs = [
    ['users', he ? 'משתמשים' : 'Users'],
    ['feedback', he ? 'הערות' : 'Feedback'],
  ];
  const headers = [
    he ? 'משתמש' : 'User',
    he ? 'סטטוס' : 'Status',
    he ? 'נרשם' : 'Joined',
    he ? 'נראה לאחרונה' : 'Last seen',
    he ? 'התחברות' : 'Sign-in',
    he ? 'טיולים' : 'Trips',
    he ? 'הוצאות' : 'Expenses',
    he ? 'הודעות' : 'Messages',
  ];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <h1 className="text-2xl font-bold text-foreground">{he ? 'ניהול' : 'Admin'}</h1>

      {overview.isLoading && <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />}
      {overview.isError && <p className="text-sm text-destructive">{overview.error.message}</p>}

      {totals && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {stats.map(([label, value]) => (
            <Card key={label}>
              <CardContent className="flex flex-col gap-1 p-4">
                <span className="text-xs text-muted-foreground">{label}</span>
                <span className="text-xl font-bold text-foreground">{value}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'users' && overview.data && (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  {headers.map((h) => (
                    <th key={h} className="px-3 py-2.5 text-start font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {overview.data.users.map((u) => {
                  const status = statusOf(u);
                  const signIn =
                    [u.has_password && (he ? 'סיסמה' : 'Password'), u.has_google && 'Google'].filter(Boolean).join(' · ') ||
                    (he ? 'גוגל / אחר' : 'Google / other');
                  return (
                    <tr key={u.id} className="border-b border-border/60 last:border-0">
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-foreground">{u.name}</div>
                        <div className="text-xs text-muted-foreground" dir="ltr">
                          {u.email}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}>{statusLabel[status]}</span>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{fmt(u.created_at)}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{fmt(u.last_seen_at)}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{signIn}</td>
                      <td className="px-3 py-2.5">{u.events}</td>
                      <td className="px-3 py-2.5">{u.expenses}</td>
                      <td className="px-3 py-2.5">{u.messages}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {tab === 'feedback' && (
        <div className="flex flex-col gap-3">
          {feedback.isLoading && <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />}
          {feedback.data?.length === 0 && <p className="text-sm text-muted-foreground">{he ? 'עדיין אין הערות' : 'No feedback yet'}</p>}
          {feedback.data?.map((f) => (
            <Card key={f.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex flex-wrap items-baseline justify-between gap-2 text-base">
                  <span>{f.sender_name || f.sender_email}</span>
                  <span className="text-xs font-normal text-muted-foreground">{fmt(f.created_at)}</span>
                </CardTitle>
                <p className="text-xs text-muted-foreground" dir="ltr">
                  {f.sender_email}
                </p>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <p className="whitespace-pre-wrap text-sm text-foreground">{f.message}</p>
                {f.attachment_url && (
                  <a href={f.attachment_url} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary hover:underline">
                    {he ? 'קובץ מצורף' : 'Attachment'}
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
