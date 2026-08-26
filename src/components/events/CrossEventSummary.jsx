import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useLang } from '@/hooks/useLang';
import { useCrossEventBalance } from '@/hooks/useCrossEventBalance';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function CrossEventSummary({ events }) {
  const { user } = useAuth();
  const { lang } = useLang();
  const { data } = useCrossEventBalance(events, user.id);

  if (!data || data.perEvent.length === 0) return null;

  const formatCurrency = (v, currency) =>
    Math.abs(v).toLocaleString(lang === 'he' ? 'he-IL' : 'en-US', { style: 'currency', currency });

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="flex flex-col gap-3 p-5">
        <h2 className="text-sm font-semibold text-muted-foreground">
          {lang === 'he' ? 'המצב שלך בכל הטיולים הפעילים' : 'Your standing across active trips'}
        </h2>
        <div className="flex flex-wrap gap-4">
          {Object.entries(data.totalsByCurrency).map(([currency, total]) => (
            <div key={currency} className={cn('text-lg font-bold', total > 0 ? 'text-primary' : 'text-destructive')}>
              {total > 0 ? (lang === 'he' ? 'מגיע לך' : 'You are owed') : lang === 'he' ? 'אתם חייבים' : 'You owe'}{' '}
              {formatCurrency(total, currency)}
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1.5 text-sm">
          {data.perEvent.map((e) => (
            <Link key={e.eventId} to={`/events/${e.eventId}`} className="flex flex-col gap-0.5 rounded-xl px-2 py-1 hover:bg-muted">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{e.eventTitle}</span>
                <span className={e.balance > 0 ? 'text-primary' : 'text-destructive'}>
                  {e.balance > 0 ? '+' : '-'}
                  {formatCurrency(e.balance, e.currency)}
                </span>
              </div>
              {e.owedByPeople?.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {e.owedByPeople
                    .map((p) =>
                      lang === 'he'
                        ? `${p.name} חייב/ת ${formatCurrency(p.amount, e.currency)}`
                        : `${p.name} owes ${formatCurrency(p.amount, e.currency)}`
                    )
                    .join(' · ')}
                </p>
              )}
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
