import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Trash2, AlertCircle } from 'lucide-react';
import { useLang } from '@/hooks/useLang';
import { useDeleteEvent } from '@/hooks/useEvents';
import { getMediaCount } from '@/api/messages';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

/** Standalone delete-trip flow, extracted out of the edit modal so it lives
 * somewhere more visible/deliberate on the trip page instead of buried
 * inside "edit". Counts media in the trip so users are warned before losing
 * photos/files that only exist in this app. */
export function DeleteEventDialog({ event, open, onOpenChange }) {
  const { lang, t } = useLang();
  const navigate = useNavigate();
  const deleteEvent = useDeleteEvent();
  const [mediaCount, setMediaCount] = useState(0);

  useEffect(() => {
    if (!open) return;
    getMediaCount(event.id)
      .then(({ count }) => setMediaCount(count))
      .catch(() => setMediaCount(0));
  }, [open, event.id]);

  const handleDeleteEvent = async () => {
    try {
      await deleteEvent.mutateAsync(event.id);
      toast.success(lang === 'he' ? 'הטיול נמחק' : 'Trip deleted');
      navigate('/home');
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{lang === 'he' ? `למחוק את "${event.title}"?` : `Delete "${event.title}"?`}</DialogTitle>
          <DialogDescription>
            {lang === 'he'
              ? 'הפעולה מוחקת לצמיתות את כל ההוצאות, ההודעות, הסקרים והתמונות של הטיול עבור כל המשתתפים. לא ניתן לבטל.'
              : 'This permanently deletes all expenses, messages, polls, and photos in this trip for every participant. This cannot be undone.'}
          </DialogDescription>
        </DialogHeader>
        {mediaCount > 0 && (
          <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/30 dark:bg-amber-900/20 dark:text-amber-200">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">{lang === 'he' ? '⚠️ התמונות והקבצים' : '⚠️ Media files'}</p>
              <p className="text-xs opacity-90">
                {lang === 'he'
                  ? `${mediaCount} תמונה/קובץ בטיול. שקול להעתיק אותם לGoogle Drive לפני המחיקה.`
                  : `${mediaCount} photo/file in this trip. Consider backing them up to Google Drive before deleting.`}
              </p>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {lang === 'he' ? 'ביטול' : 'Cancel'}
          </Button>
          <Button variant="destructive" onClick={handleDeleteEvent} disabled={deleteEvent.isPending}>
            <Trash2 className="h-4 w-4" />
            {t('action_delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
