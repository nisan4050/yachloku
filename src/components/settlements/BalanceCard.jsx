import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useLang } from '@/hooks/useLang';
import { cn } from '@/lib/utils';

export function BalanceCard({ participant, balance, currency }) {
  const { lang } = useLang();
  const isPositive = balance > 0.005;
  const isNegative = balance < -0.005;
  const formatted = Math.abs(balance).toLocaleString(lang === 'he' ? 'he-IL' : 'en-US', {
    style: 'currency',
    currency,
  });

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
      <Avatar>
        <AvatarFallback>{participant.name[0]?.toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-card-foreground">{participant.name}</p>
        <p
          className={cn(
            'text-xs',
            isPositive && 'text-primary',
            isNegative && 'text-destructive',
            !isPositive && !isNegative && 'text-muted-foreground'
          )}
        >
          {isPositive && (lang === 'he' ? 'מגיע לו/ה' : 'is owed')}
          {isNegative && (lang === 'he' ? 'חייב/ת' : 'owes')}
          {!isPositive && !isNegative && (lang === 'he' ? 'מאוזן/ת' : 'settled')}
        </p>
      </div>
      {(isPositive || isNegative) && (
        <p className={cn('font-semibold', isPositive ? 'text-primary' : 'text-destructive')}>{formatted}</p>
      )}
    </div>
  );
}
