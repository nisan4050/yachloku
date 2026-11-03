import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Sparkles, Download, Share2, ArrowRight, ArrowLeft, Lock, LockOpen } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useLang } from '@/hooks/useLang';
import { getCategory } from '@/lib/categories';
import { usePayments, getEventBalances } from '@/hooks/useExpenses';
import { useUpdateEvent } from '@/hooks/useEvents';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export function TripRecapModal({ event, expenses, triggerClassName }) {
  const { user } = useAuth();
  const { lang, dir } = useLang();
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const cardRef = useRef(null);
  const { data: payments } = usePayments(event.id);
  const updateEvent = useUpdateEvent(event.id);
  const isManager = event.manager_user_id === user.id;
  const isClosed = event.status === 'settled';

  const handleToggleClosed = async () => {
    try {
      await updateEvent.mutateAsync({ status: isClosed ? 'active' : 'settled' });
      toast.success(
        isClosed
          ? lang === 'he' ? 'הטיול נפתח מחדש לעריכה' : 'Trip reopened for editing'
          : lang === 'he' ? 'הטיול נסגר לעריכה' : 'Trip closed for editing'
      );
      setConfirmOpen(false);
    } catch (err) {
      toast.error(err.message);
    }
  };

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
        <Button variant="outline" className={triggerClassName}>
          <Sparkles className="h-4 w-4 shrink-0" />
          <span className="truncate">{lang === 'he' ? 'סיכום טיול' : 'Trip recap'}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm p-3 sm:p-6">
        <div
          ref={cardRef}
          className="flex min-w-0 flex-col gap-3 rounded-3xl bg-gradient-to-br from-primary to-secondary p-4 text-primary-foreground"
        >
          <div className="text-center">
            <div className="text-3xl">{event.icon}</div>
            <h3 className="mt-1 text-xl font-bold">{event.title}</h3>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="min-w-0 rounded-2xl bg-white/15 p-3 text-center backdrop-blur">
              <p className="text-xs opacity-80">{lang === 'he' ? 'סה״כ הוצאות' : 'Total spent'}</p>
              <p className="text-xl font-extrabold">{formatCurrency(total)}</p>
            </div>
            <div className="min-w-0 rounded-2xl bg-white/15 p-3 text-center backdrop-blur">
              <p className="text-xs opacity-80">{lang === 'he' ? 'ממוצע לאדם' : 'Average per person'}</p>
              <p className="text-xl font-extrabold">{formatCurrency(average)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {topCategory && (
              <div className="min-w-0 rounded-2xl bg-white/15 p-2.5 text-center backdrop-blur">
                <p className="text-xs opacity-80">{lang === 'he' ? 'קטגוריה מובילה' : 'Top category'}</p>
                <p className="truncate font-semibold">{topCategory.name}</p>
                <p className="text-xs opacity-80">{formatCurrency(topCategory.value)}</p>
              </div>
            )}
            {topPayer && (
              <div className="min-w-0 rounded-2xl bg-white/15 p-2.5 text-center backdrop-blur">
                <p className="text-xs opacity-80">{lang === 'he' ? 'שילם/ה הכי הרבה' : 'Biggest spender'}</p>
                <p className="truncate font-semibold">{topPayer.name}</p>
                <p className="text-xs opacity-80">{formatCurrency(topPayer.value)}</p>
              </div>
            )}
          </div>

          {settlements.length > 0 && (
            <div className="min-w-0 rounded-2xl bg-white/15 p-2.5 backdrop-blur">
              <p className="mb-2 text-xs opacity-80">{lang === 'he' ? 'מי חייב למי' : 'Who owes whom'}</p>
              <div className="flex flex-col gap-1.5">
                {settlements.map((s, i) => (
                  <div key={i} className="flex min-w-0 items-center justify-between gap-2 text-sm">
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

        {isManager && (
          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full">
                {isClosed ? <LockOpen className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                {isClosed
                  ? lang === 'he' ? 'פתיחת הטיול מחדש' : 'Reopen trip'
                  : lang === 'he' ? 'סיום הטיול' : 'End trip'}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {isClosed
                    ? lang === 'he' ? 'לפתוח את הטיול מחדש?' : 'Reopen this trip?'
                    : lang === 'he' ? 'לסיים את הטיול?' : 'End this trip?'}
                </DialogTitle>
                <DialogDescription>
                  {isClosed
                    ? lang === 'he'
                      ? 'הטיול ייפתח שוב לעריכה — אפשר יהיה להוסיף ולשנות הוצאות.'
                      : 'The trip becomes editable again — expenses can be added and changed.'
                    : lang === 'he'
                      ? 'הטיול ייסגר לעריכה ויעבור לתחתית הרשימה. אפשר לפתוח אותו מחדש בכל עת.'
                      : 'The trip closes for editing and moves to the bottom of the list. You can reopen it anytime.'}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={handleToggleClosed} disabled={updateEvent.isPending}>
                  {isClosed
                    ? lang === 'he' ? 'פתיחה מחדש' : 'Reopen'
                    : lang === 'he' ? 'סיום הטיול' : 'End trip'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
