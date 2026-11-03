import { useState } from 'react';
import { toast } from 'sonner';
import { Pencil, X } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useLang } from '@/hooks/useLang';
import { useUpdateEvent } from '@/hooks/useEvents';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AddFriendsDialog } from '@/components/events/AddFriendsDialog';

const CURRENCIES = ['ILS', 'USD', 'EUR', 'GBP'];

export function EditEventModal({ event }) {
  const { user } = useAuth();
  const { lang, t } = useLang();
  const updateEvent = useUpdateEvent(event.id);
  const [open, setOpen] = useState(false);
  const isCreator = event.created_by === user.id;
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description ?? '');
  const [currency, setCurrency] = useState(event.currency);
  const [status, setStatus] = useState(event.status);
  const [addFriendsOpen, setAddFriendsOpen] = useState(false);
  const [addingParticipant, setAddingParticipant] = useState(false);

  // Only the trip's creator can edit it — everyone else never sees the entry point at all.
  if (!isCreator) return null;

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

  const handleAddFriends = async (names) => {
    setAddingParticipant(true);
    try {
      const newParticipants = names.map((name) => ({ id: crypto.randomUUID(), name, email: null, user_id: null }));
      await updateEvent.mutateAsync({ participants: [...event.participants, ...newParticipants] });
      setAddFriendsOpen(false);
      toast.success(
        lang === 'he'
          ? `${names.length} משתתפים נוספו`
          : `${names.length} participant${names.length > 1 ? 's' : ''} added`
      );
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
        <button
          type="button"
          aria-label={t('action_edit')}
          className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Pencil className="h-4 w-4" />
        </button>
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
            <div className="flex items-center justify-between">
              <Label>{lang === 'he' ? 'משתתפים' : 'Participants'}</Label>
              <span className="text-xs text-muted-foreground">
                {event.participants.length} {lang === 'he' ? 'סה״כ' : 'total'}
              </span>
            </div>
            <div className="flex max-h-52 flex-col gap-1 overflow-y-auto rounded-xl border border-border p-1.5">
              {event.participants.map((p) => (
                <div key={p.id} className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 hover:bg-muted/60">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="text-xs">{p.name[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">{p.name}</span>
                  {!p.user_id && (
                    <Badge variant="secondary" className="shrink-0 text-[10px] font-normal">
                      {lang === 'he' ? 'בלי חשבון' : 'No account'}
                    </Badge>
                  )}
                  {!p.user_id && (
                    <button
                      type="button"
                      onClick={() => handleRemoveParticipant(p.id)}
                      aria-label={lang === 'he' ? 'הסרה' : 'Remove'}
                      className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <Button type="button" variant="outline" className="self-start" onClick={() => setAddFriendsOpen(true)}>
              {lang === 'he' ? 'הוספת חברים' : 'Add friends'}
            </Button>
            <AddFriendsDialog
              open={addFriendsOpen}
              onOpenChange={setAddFriendsOpen}
              onConfirm={handleAddFriends}
              adding={addingParticipant}
            />
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
