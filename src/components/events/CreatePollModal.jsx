import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ListPlus, Plus, X, Edit2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useLang } from '@/hooks/useLang';
import { useCreatePoll, useUpdatePoll } from '@/hooks/usePolls';
import { notifyEventMembers } from '@/api/notifications';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function CreatePollModal({ eventId, event, poll, trigger }) {
  const { user } = useAuth();
  const { lang } = useLang();
  const createPoll = useCreatePoll(eventId);
  const updatePoll = useUpdatePoll(eventId);
  const isEdit = Boolean(poll);
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);

  useEffect(() => {
    if (!open) return;
    if (isEdit) {
      setQuestion(poll.question);
      setOptions(poll.options.map((o) => o.label));
    } else {
      setQuestion('');
      setOptions(['', '']);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const updateOption = (idx, value) => setOptions((prev) => prev.map((o, i) => (i === idx ? value : o)));
  const addOption = () => setOptions((prev) => [...prev, '']);
  const removeOption = (idx) => setOptions((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (cleanOptions.length < 2) {
      toast.error(lang === 'he' ? 'צריך לפחות שתי אפשרויות' : 'Need at least two options');
      return;
    }
    try {
      if (isEdit) {
        // Keep existing option ids where the label matches an unchanged slot, so existing votes survive edits.
        const nextOptions = cleanOptions.map((label, idx) => {
          const existing = poll.options[idx];
          return { id: existing?.label === label ? existing.id : crypto.randomUUID(), label };
        });
        await updatePoll.mutateAsync({ pollId: poll.id, question, options: nextOptions });
        toast.success(lang === 'he' ? 'הסקר עודכן' : 'Poll updated');
      } else {
        const newPoll = await createPoll.mutateAsync({ eventId, question, options: cleanOptions, userId: user.id });
        if (event) {
          const me = event.participants.find((p) => p.user_id === user.id);
          notifyEventMembers({
            event,
            excludeUserId: user.id,
            type: 'poll',
            title: lang === 'he' ? `סקר חדש · ${event.title}` : `New poll · ${event.title}`,
            body: `${me?.name ?? ''}: ${question}`,
            data: { tab: 'group-chat', poll: newPoll.id },
          });
        }
      }
      setOpen(false);
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <ListPlus className="h-4 w-4" />
            {lang === 'he' ? 'סקר חדש' : 'New poll'}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? (lang === 'he' ? 'עריכת סקר' : 'Edit poll') : lang === 'he' ? 'סקר חדש' : 'New poll'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>{lang === 'he' ? 'שאלה' : 'Question'}</Label>
            <Input required value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={lang === 'he' ? 'איפה אוכלים הערב?' : 'Where should we eat tonight?'} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{lang === 'he' ? 'אפשרויות' : 'Options'}</Label>
            {options.map((opt, idx) => (
              <div key={idx} className="flex gap-2">
                <Input value={opt} onChange={(e) => updateOption(idx, e.target.value)} placeholder={`${lang === 'he' ? 'אפשרות' : 'Option'} ${idx + 1}`} />
                {options.length > 2 && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeOption(idx)}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" className="self-start" onClick={addOption}>
              <Plus className="h-4 w-4" />
              {lang === 'he' ? 'הוספת אפשרות' : 'Add option'}
            </Button>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createPoll.isPending || updatePoll.isPending}>
              {isEdit ? (
                <>
                  <Edit2 className="h-4 w-4" />
                  {lang === 'he' ? 'שמירת שינויים' : 'Save changes'}
                </>
              ) : lang === 'he' ? (
                'יצירת סקר'
              ) : (
                'Create poll'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
