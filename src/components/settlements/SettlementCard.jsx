import confetti from 'canvas-confetti';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Check, Undo2, Copy, Smartphone } from 'lucide-react';
import { useLang } from '@/hooks/useLang';
import { canAttemptOpenBit, copyForBit, tryOpenBit } from '@/lib/bitLink';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function SettlementCard({ settlement, participantsById, currency, confirmed, canManage, toPhone, onConfirm, onUnconfirm }) {
  const { lang, dir } = useLang();
  const ArrowIcon = dir === 'rtl' ? ArrowLeft : ArrowRight;

  const from = participantsById[settlement.from];
  const to = participantsById[settlement.to];

  const handleConfirm = async () => {
    await onConfirm(settlement);
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.7 } });
  };

  const handleCopyForBit = () => {
    copyForBit({ amount: settlement.amount, currency, phone: toPhone });
    toast.success(lang === 'he' ? 'הועתק — פתחו את ביט והדביקו' : 'Copied — open Bit and paste');
  };

  const handleOpenBit = () => {
    handleCopyForBit();
    tryOpenBit();
  };

  return (
    <Card className={confirmed ? 'border-border bg-muted/50 opacity-70' : undefined}>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-center gap-3">
          <span className="min-w-0 truncate font-medium text-card-foreground">{from?.name}</span>
          <ArrowIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 truncate font-medium text-card-foreground">{to?.name}</span>
          <span className="ms-auto shrink-0 font-semibold text-accent">
            {settlement.amount.toLocaleString(lang === 'he' ? 'he-IL' : 'en-US', { style: 'currency', currency })}
          </span>
          {confirmed ? (
            canManage ? (
              <Button size="sm" variant="ghost" onClick={() => onUnconfirm(settlement)}>
                <Undo2 className="h-4 w-4" />
                {lang === 'he' ? 'ביטול' : 'Undo'}
              </Button>
            ) : (
              <span className="shrink-0 text-xs text-muted-foreground">{lang === 'he' ? 'סוכם' : 'Settled'}</span>
            )
          ) : canManage ? (
            <Button size="sm" onClick={handleConfirm}>
              <Check className="h-4 w-4" />
              {lang === 'he' ? 'סימון כשולם' : 'Mark paid'}
            </Button>
          ) : (
            <span className="shrink-0 text-xs text-muted-foreground">
              {lang === 'he' ? `רק ${from?.name} יכול/ה לסמן` : `Only ${from?.name} can mark this`}
            </span>
          )}
        </div>

        {!confirmed && canManage && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={handleCopyForBit}>
              <Copy className="h-3.5 w-3.5" />
              {lang === 'he' ? 'העתקה לביט' : 'Copy for Bit'}
            </Button>
            {canAttemptOpenBit() && (
              <Button size="sm" variant="outline" onClick={handleOpenBit}>
                <Smartphone className="h-3.5 w-3.5" />
                {lang === 'he' ? 'פתיחת ביט' : 'Open Bit'}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
