import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { getCategory } from '@/lib/categories';
import { useLang } from '@/hooks/useLang';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

export function EventStats({ event, expenses }) {
  const { lang } = useLang();

  if (!expenses || expenses.length === 0) {
    return <EmptyState icon="📊" title={lang === 'he' ? 'אין עדיין נתונים להצגה' : 'No data to show yet'} />;
  }

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  const byCategory = Object.values(
    expenses.reduce((acc, e) => {
      const cat = getCategory(e.category);
      acc[e.category] ??= { key: e.category, name: cat.label[lang], color: cat.color, value: 0 };
      acc[e.category].value += e.amount;
      return acc;
    }, {})
  ).sort((a, b) => b.value - a.value);

  const participantsById = Object.fromEntries(event.participants.map((p) => [p.id, p]));
  const byParticipant = Object.values(
    expenses.reduce((acc, e) => {
      for (const paid of e.paid_by ?? []) {
        const name = participantsById[paid.participant_id]?.name ?? '?';
        acc[paid.participant_id] ??= { name, value: 0 };
        acc[paid.participant_id].value += paid.amount;
      }
      return acc;
    }, {})
  ).sort((a, b) => b.value - a.value);

  const formatCurrency = (v) =>
    v.toLocaleString(lang === 'he' ? 'he-IL' : 'en-US', { style: 'currency', currency: event.currency, maximumFractionDigits: 0 });

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{lang === 'he' ? 'סה״כ הוצאות' : 'Total spent'}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-primary">{formatCurrency(total)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{lang === 'he' ? 'לפי קטגוריה' : 'By category'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {byCategory.map((entry) => (
                    <Cell key={entry.key} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {byCategory.map((c) => (
              <div key={c.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                {c.name} · {formatCurrency(c.value)}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{lang === 'he' ? 'לפי משתתף' : 'By participant'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byParticipant} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={80} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Bar dataKey="value" fill="#1e9e6e" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
