import { useState } from 'react';
import { toast } from 'sonner';
import { Settings2, UserPlus, X } from 'lucide-react';
import { useLang } from '@/hooks/useLang';
import { useUpdateEvent } from '@/hooks/useEvents';
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
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const CURRENCIES = ['ILS', 'USD', 'EUR', 'GBP'];

export function EditEventModal({ event }) {
  const { lang, t } = useLang();
  const updateEvent = useUpdateEvent(event.id);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description ?? '');
  const [currency, setCurrency] = useState(event.currency);
  const [status, setStatus] = useState(event.status);
  const [newParticipantName, setNewParticipantName] = useState('');
  const [addingParticipant, setAddingParticipant] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await updateEvent.mutateAsync({ title, description, currency, status });
      toast.success(lang === 'he' ? 'עודכן בהצלחה' : 'Updated');
      setOpen(false);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleAddParticipant = async () => {
    const name = newParticipantName.trim();
    if (!name) return;
    setAddingParticipant(true);
    try {
      const participant = { id: crypto.randomUUID(), name, email: null, user_id: null };
      await updateEvent.mutateAsync({ participants: [...event.participants, participant] });
      setNewParticipantName('');
      toast.success(lang === 'he' ? 'המשתתף/ת נוסף/ה' : 'Participant added');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAddingParticipant(false);
    }
  };

  const handleRemoveParticipant = async (participantId) => {
    try {
      await updateEvent.mutateAsync({ participants: event.participants.filter((p) => p.id !== participantId) });
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <Settings2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('action_edit')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>{lang === 'he' ? 'כותרת' : 'Title'}</Label>
            <Input required value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{lang === 'he' ? 'תיאור' : 'Description'}</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>{lang === 'he' ? 'מטבע' : 'Currency'}</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{lang === 'he' ? 'סטטוס' : 'Status'}</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{lang === 'he' ? 'פעיל' : 'Active'}</SelectItem>
                  <SelectItem value="settled">{lang === 'he' ? 'נסגר' : 'Settled'}</SelectItem>
                  <SelectItem value="archived">{lang === 'he' ? 'בארכיון' : 'Archived'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{lang === 'he' ? 'משתתפים' : 'Participants'}</Label>
            <div className="flex flex-col gap-1.5 rounded-xl border border-border p-2">
              {event.participants.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5">
                  <span className="min-w-0 truncate text-sm text-foreground">{p.name}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    {!p.user_id && (
                      <span className="text-xs text-muted-foreground">{lang === 'he' ? 'בלי חשבון' : 'No account'}</span>
                    )}
                    {!p.user_id && (
                      <button
                        type="button"
                        onClick={() => handleRemoveParticipant(p.id)}
                        aria-label={lang === 'he' ? 'הסרה' : 'Remove'}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder={lang === 'he' ? 'שם המשתתף/ת' : "Participant's name"}
                value={newParticipantName}
                onChange={(e) => setNewParticipantName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddParticipant();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={handleAddParticipant} disabled={addingParticipant || !newParticipantName.trim()}>
                <UserPlus className="h-4 w-4" />
                {lang === 'he' ? 'הוספה' : 'Add'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {lang === 'he'
                ? 'מוסיפים אדם בלי טלפון או חשבון — ההוצאות יתחלקו איתו/ה כרגיל, אבל לא יוכל/תוכל להתחבר לאפליקציה.'
                : "Add someone without a phone or account — expenses still split with them, but they can't log into the app."}
            </p>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={updateEvent.isPending}>
              {t('action_save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
