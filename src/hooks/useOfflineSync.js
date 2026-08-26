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

    // `navigator.onLine` and the `online` event are unreliable on Android
    // WebViews — a brief flakiness can queue an expense that never gets
    // flushed if the event never fires. Retry periodically and on every
    // foreground as a self-healing backstop, not just those two signals.
    flush();
    window.addEventListener('online', flush);
    document.addEventListener('visibilitychange', flush);
    const interval = setInterval(flush, 20000);
    return () => {
      window.removeEventListener('online', flush);
      document.removeEventListener('visibilitychange', flush);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
