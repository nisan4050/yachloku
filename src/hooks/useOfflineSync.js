import { useEffect } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { getQueue, removeFromQueue } from '@/lib/offlineQueue';
import { createExpense } from '@/api/expenses';
import { useLang } from '@/hooks/useLang';

/** Flushes any queued offline expenses once the browser is back online. */
export function useOfflineSync() {
  const queryClient = useQueryClient();
  const { lang } = useLang();

  useEffect(() => {
    const flush = async () => {
      const queue = await getQueue();
      if (queue.length === 0) return;

      let synced = 0;
      for (const entry of queue) {
        try {
          await createExpense(entry.expense);
          await removeFromQueue(entry.id);
          synced += 1;
        } catch (err) {
          console.error('Failed to sync offline expense', err);
        }
      }

      if (synced > 0) {
        toast.success(
          lang === 'he' ? `${synced} הוצאות שנוספו לא מקוון סונכרנו` : `${synced} offline expenses synced`
        );
        queryClient.invalidateQueries({ queryKey: ['expenses'] });
      }
    };

    if (navigator.onLine) flush();
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
