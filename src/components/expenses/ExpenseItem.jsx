import { useRef } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { Trash2, Edit2 } from 'lucide-react';
import { getCategory } from '@/lib/categories';
import { formatDate } from '@/lib/dateUtils';
import { useLang } from '@/hooks/useLang';
import { Button } from '@/components/ui/button';

const SWIPE_REVEAL = 136;

export function ExpenseItem({ expense, participantsById, onDelete, onEdit, canManage }) {
  const { lang, dir } = useLang();
  const controls = useAnimation();
  const openRef = useRef(false);
  const category = getCategory(expense.category);
  const Icon = category.icon;
  const payerNames = (expense.paid_by ?? [])
    .map((p) => participantsById[p.participant_id]?.name)
    .filter(Boolean)
    .join(', ');

  const sign = dir === 'rtl' ? 1 : -1;

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

  const handleDelete = () => {
    controls.start({ x: 0 });
    openRef.current = false;
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
          <button type="button" onClick={handleDelete} className="flex flex-1 items-center justify-center bg-destructive text-destructive-foreground">
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
        className="relative flex items-center gap-3 border border-border bg-card p-4"
      >
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `${category.color}20`, color: category.color }}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-card-foreground">{expense.description}</p>
          <p className="truncate text-xs text-muted-foreground">
            {formatDate(expense.date, lang)}
            {payerNames && ` · ${lang === 'he' ? 'שילם/ה' : 'paid by'} ${payerNames}`}
          </p>
        </div>
        <div className="text-end">
          <p className="font-semibold text-card-foreground">
            {expense.amount.toLocaleString(lang === 'he' ? 'he-IL' : 'en-US', { style: 'currency', currency: expense.currency })}
          </p>
        </div>
        {canManage && (
          <div className="hidden shrink-0 items-center gap-1 md:flex">
            <Button variant="ghost" size="icon" onClick={() => onEdit(expense)}>
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(expense.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
