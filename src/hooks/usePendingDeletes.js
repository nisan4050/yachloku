import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';

const UNDO_WINDOW_MS = 5000;

/**
 * Optimistic "soft delete with undo" pattern: an item disappears from the UI
 * immediately, a toast offers to undo for a few seconds, and only after that
 * window elapses does the real (irreversible) delete actually run.
 */
export function usePendingDeletes() {
  const [pendingIds, setPendingIds] = useState(() => new Set());
  const timers = useRef(new Map());

  const scheduleDelete = useCallback((id, commit, { label, undoLabel, undoneLabel } = {}) => {
    setPendingIds((prev) => new Set(prev).add(id));

    const timeoutId = setTimeout(() => {
      timers.current.delete(id);
      commit(id);
    }, UNDO_WINDOW_MS);
    timers.current.set(id, timeoutId);

    toast(label ?? 'נמחק', {
      duration: UNDO_WINDOW_MS,
      action: {
        label: undoLabel ?? 'ביטול',
        onClick: () => {
          const t = timers.current.get(id);
          if (t) {
            clearTimeout(t);
            timers.current.delete(id);
          }
          setPendingIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          if (undoneLabel) toast.success(undoneLabel);
        },
      },
    });
  }, []);

  return { pendingIds, scheduleDelete };
}
