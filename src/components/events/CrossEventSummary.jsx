import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useLang } from '@/hooks/useLang';
import { useCrossEventBalance } from '@/hooks/useCrossEventBalance';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function CrossEventSummary({ events }) {
  const { user } = useAuth();
  const { lang } = useLang();
  const { data } = useCrossEventBalance(events, user.id);
  const [expanded, setExpanded] = useState(false);

  if (!data || data.perEvent.length === 0) return null;

  const formatCurrency = (v, currency) => v.toLocaleString(lang === 'he' ? 'he-IL' : 'en-US', { style: 'currency', currency });

  const owedByMeEntries = Object.entries(data.owedByMeTotals);
  const owedToMeEntries = Object.entries(data.owedToMeTotals);

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="flex flex-col gap-3 p-5">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center justify-between gap-2 text-start"
        >
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-muted-foreground">
              {lang === 'he' ? 'המצב שלך בכל הטיולים הפעילים' : 'Your standing across active trips'}
            </h2>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {owedToMeEntries.map(([currency, total]) => (
                <div key={`to-${currency}`} className="text-lg font-bold text-primary">
                  {lang === 'he' ? 'מגיע לך סה״כ' : 'You are owed'} {formatCurrency(total, currency)}
                </div>
              ))}
              {owedByMeEntries.map(([currency, total]) => (
                <div key={`by-${currency}`} className="text-lg font-bold text-destructive">
                  {lang === 'he' ? 'אתה חייב סה״כ' : 'You owe'} {formatCurrency(total, currency)}
                </div>
              ))}
            </div>
          </div>
          <ChevronDown className={cn('h-5 w-5 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
        </button>

        {expanded && (
          <div className="flex flex-col gap-1.5 border-t border-border pt-3 text-sm">
            {data.perEvent.map((e) => (
              <Link key={e.eventId} to={`/events/${e.eventId}`} className="flex flex-col gap-0.5 rounded-xl px-2 py-1 hover:bg-muted">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{e.eventTitle}</span>
                  <span className={e.balance > 0 ? 'text-primary' : 'text-destructive'}>
                    {e.balance > 0 ? '+' : '-'}
                    {formatCurrency(Math.abs(e.balance), e.currency)}
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
        )}
      </CardContent>
    </Card>
  );
}
