import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Sparkles, Download, Share2, ArrowRight, ArrowLeft } from 'lucide-react';
import { useLang } from '@/hooks/useLang';
import { getCategory } from '@/lib/categories';
import { usePayments, getEventBalances } from '@/hooks/useExpenses';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export function TripRecapModal({ event, expenses }) {
  const { lang, dir } = useLang();
  const [open, setOpen] = useState(false);
  const cardRef = useRef(null);
  const { data: payments } = usePayments(event.id);

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const average = event.participants.length > 0 ? total / event.participants.length : 0;
  const { settlements } = getEventBalances(event.participants, expenses, payments ?? []);
  const ArrowIcon = dir === 'rtl' ? ArrowLeft : ArrowRight;
  const byCategory = Object.values(
    expenses.reduce((acc, e) => {
      const cat = getCategory(e.category);
      acc[e.category] ??= { name: cat.label[lang], color: cat.color, value: 0 };
      acc[e.category].value += e.amount;
      return acc;
    }, {})
  ).sort((a, b) => b.value - a.value);
  const topCategory = byCategory[0];

  const participantsById = Object.fromEntries(event.participants.map((p) => [p.id, p]));
  const byPayer = Object.values(
    expenses.reduce((acc, e) => {
      for (const paid of e.paid_by ?? []) {
        const name = participantsById[paid.participant_id]?.name ?? '?';
        acc[paid.participant_id] ??= { name, value: 0 };
        acc[paid.participant_id].value += paid.amount;
      }
      return acc;
    }, {})
  ).sort((a, b) => b.value - a.value);
  const topPayer = byPayer[0];

  const formatCurrency = (v) =>
    v.toLocaleString(lang === 'he' ? 'he-IL' : 'en-US', { style: 'currency', currency: event.currency, maximumFractionDigits: 0 });

  const handleDownload = async () => {
    const html2canvas = (await import('html2canvas')).default;
    const canvas = await html2canvas(cardRef.current, { backgroundColor: null, scale: 2 });
    const link = document.createElement('a');
    link.download = `${event.title}-recap.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleShare = async () => {
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, { backgroundColor: null, scale: 2 });
      canvas.toBlob(async (blob) => {
        const file = new File([blob], 'recap.png', { type: 'image/png' });
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: event.title });
        } else {
          handleDownload();
        }
      });
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (expenses.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Sparkles className="h-4 w-4" />
          {lang === 'he' ? 'סיכום טיול' : 'Trip recap'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <div
          ref={cardRef}
          className="flex flex-col gap-4 rounded-3xl bg-gradient-to-br from-primary to-secondary p-6 text-primary-foreground"
        >
          <div className="text-center">
            <div className="text-3xl">{event.icon}</div>
            <h3 className="mt-1 text-xl font-bold">{event.title}</h3>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/15 p-4 text-center backdrop-blur">
              <p className="text-xs opacity-80">{lang === 'he' ? 'סה״כ הוצאות' : 'Total spent'}</p>
              <p className="text-2xl font-extrabold">{formatCurrency(total)}</p>
            </div>
            <div className="rounded-2xl bg-white/15 p-4 text-center backdrop-blur">
              <p className="text-xs opacity-80">{lang === 'he' ? 'ממוצע לאדם' : 'Average per person'}</p>
              <p className="text-2xl font-extrabold">{formatCurrency(average)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {topCategory && (
              <div className="rounded-2xl bg-white/15 p-3 text-center backdrop-blur">
                <p className="text-xs opacity-80">{lang === 'he' ? 'קטגוריה מובילה' : 'Top category'}</p>
                <p className="font-semibold">{topCategory.name}</p>
                <p className="text-xs opacity-80">{formatCurrency(topCategory.value)}</p>
              </div>
            )}
            {topPayer && (
              <div className="rounded-2xl bg-white/15 p-3 text-center backdrop-blur">
                <p className="text-xs opacity-80">{lang === 'he' ? 'שילם/ה הכי הרבה' : 'Biggest spender'}</p>
                <p className="font-semibold">{topPayer.name}</p>
                <p className="text-xs opacity-80">{formatCurrency(topPayer.value)}</p>
              </div>
            )}
          </div>

          {settlements.length > 0 && (
            <div className="rounded-2xl bg-white/15 p-3 backdrop-blur">
              <p className="mb-2 text-xs opacity-80">{lang === 'he' ? 'מי חייב למי' : 'Who owes whom'}</p>
              <div className="flex flex-col gap-1.5">
                {settlements.map((s, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate font-medium">{participantsById[s.from]?.name}</span>
                      <ArrowIcon className="h-3.5 w-3.5 shrink-0 opacity-70" />
                      <span className="truncate font-medium">{participantsById[s.to]?.name}</span>
                    </span>
                    <span className="shrink-0 font-semibold">{formatCurrency(s.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-center text-xs opacity-70">
            {expenses.length} {lang === 'he' ? 'הוצאות' : 'expenses'} · {event.participants.length}{' '}
            {lang === 'he' ? 'משתתפים' : 'participants'} · יחלוקו
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={handleDownload}>
            <Download className="h-4 w-4" />
            {lang === 'he' ? 'הורדה' : 'Download'}
          </Button>
          <Button className="flex-1" onClick={handleShare}>
            <Share2 className="h-4 w-4" />
            {lang === 'he' ? 'שיתוף' : 'Share'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
