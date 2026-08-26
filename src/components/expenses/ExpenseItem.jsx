import { useEffect, useRef, useState } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { Trash2, Edit2 } from 'lucide-react';
import { getCategory } from '@/lib/categories';
import { formatDate } from '@/lib/dateUtils';
import { convertToBase } from '@/lib/exchangeRates';
import { useLang } from '@/hooks/useLang';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const SWIPE_REVEAL = 136;
const SWIPE_HINT_SEEN_KEY = 'yachloku:swipe-hint-seen';

export function ExpenseItem({ expense, participantsById, onDelete, onEdit, canManage, baseCurrency, rates }) {
  const { lang, dir } = useLang();
  const controls = useAnimation();
  const openRef = useRef(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const category = getCategory(expense.category);
  const Icon = category.icon;
  const payerNames = (expense.paid_by ?? [])
    .map((p) => participantsById[p.participant_id]?.name)
    .filter(Boolean)
    .join(', ');

  // When this expense was entered in a different currency than the trip's
  // base one, show the converted amount alongside the original so the split
  // is understandable at a glance without opening the expense.
  const isForeignCurrency = baseCurrency && expense.currency && expense.currency !== baseCurrency;
  const convertedAmount = isForeignCurrency && rates ? convertToBase(expense.amount, expense.currency, rates) : null;

  const sign = dir === 'rtl' ? 1 : -1;

  // Teach the swipe-to-edit/delete gesture once, ever, with a tiny nudge —
  // only the very first ExpenseItem instance mounted plays it (localStorage
  // flag flips immediately so any siblings mounting in the same render skip
  // it too).
  useEffect(() => {
    if (!canManage || localStorage.getItem(SWIPE_HINT_SEEN_KEY)) return;
    localStorage.setItem(SWIPE_HINT_SEEN_KEY, '1');
    const nudge = sign * -28;
    const timer = setTimeout(() => {
      controls.start({ x: nudge, transition: { duration: 0.35 } }).then(() => {
        controls.start({ x: 0, transition: { duration: 0.35 } });
      });
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDragEnd = (_e, info) => {
    const pastThreshold = sign * info.offset.x > SWIPE_REVEAL / 2;
    if (canManage && pastThreshold) {
      controls.start({ x: sign * -SWIPE_REVEAL });
      openRef.current = true;
    } else {
      controls.start({ x: 0 });
      openRef.current = false;
    }
  };

  const handleDeleteRequest = () => {
    controls.start({ x: 0 });
    openRef.current = false;
    setConfirmDeleteOpen(true);
  };

  const handleConfirmDelete = () => {
    setConfirmDeleteOpen(false);
    onDelete(expense.id);
  };

  const handleEdit = () => {
    controls.start({ x: 0 });
    openRef.current = false;
    onEdit(expense);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {canManage && (
        <div className="absolute inset-y-0 end-0 flex w-[136px] items-stretch">
          <button type="button" onClick={handleEdit} className="flex flex-1 items-center justify-center bg-secondary text-secondary-foreground">
            <Edit2 className="h-5 w-5" />
          </button>
          <button type="button" onClick={handleDeleteRequest} className="flex flex-1 items-center justify-center bg-destructive text-destructive-foreground">
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      )}
      <motion.div
        drag={canManage ? 'x' : false}
        dragConstraints={{ left: dir === 'rtl' ? -SWIPE_REVEAL : 0, right: dir === 'rtl' ? 0 : SWIPE_REVEAL }}
        dragElastic={0.05}
        animate={controls}
        onDragEnd={handleDragEnd}
        className="relative flex items-start gap-3 border border-border bg-card p-4"
      >
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `${category.color}20`, color: category.color }}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="break-words font-medium text-card-foreground">{expense.description}</p>
          <p className="break-words text-xs text-muted-foreground">
            {formatDate(expense.date, lang)}
            {payerNames && ` · ${lang === 'he' ? 'שילם/ה' : 'paid by'} ${payerNames}`}
          </p>
        </div>
        <div className="shrink-0 text-end">
          <p className="font-semibold text-card-foreground">
            {expense.amount.toLocaleString(lang === 'he' ? 'he-IL' : 'en-US', { style: 'currency', currency: expense.currency })}
            {convertedAmount != null && (
              <span className="font-semibold">
                {' '}
                (
                {convertedAmount.toLocaleString(lang === 'he' ? 'he-IL' : 'en-US', {
                  style: 'currency',
                  currency: baseCurrency,
                })}
                )
              </span>
            )}
          </p>
        </div>
        {canManage && (
          <div className="hidden shrink-0 items-center gap-1 md:flex">
            <Button variant="ghost" size="icon" onClick={() => onEdit(expense)}>
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleDeleteRequest}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        )}
      </motion.div>

      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{lang === 'he' ? 'למחוק את ההוצאה?' : 'Delete this expense?'}</DialogTitle>
            <DialogDescription>
              {lang === 'he'
                ? `"${expense.description}" תימחק. ניתן יהיה לבטל מיד אחרי המחיקה.`
                : `"${expense.description}" will be deleted. You can undo right after.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              {lang === 'he' ? 'מחיקה' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
