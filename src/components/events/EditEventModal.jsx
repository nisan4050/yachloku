import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Pencil, UserPlus, X, Trash2, AlertCircle, Info } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useLang } from '@/hooks/useLang';
import { useUpdateEvent, useDeleteEvent } from '@/hooks/useEvents';
import { supabase } from '@/api/supabaseClient';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const CURRENCIES = ['ILS', 'USD', 'EUR', 'GBP'];

export function EditEventModal({ event }) {
  const { user } = useAuth();
  const { lang, t } = useLang();
  const navigate = useNavigate();
  const updateEvent = useUpdateEvent(event.id);
  const deleteEvent = useDeleteEvent();
  const [open, setOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const canDelete = event.created_by === user.id || event.manager_user_id === user.id;
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description ?? '');
  const [currency, setCurrency] = useState(event.currency);
  const [status, setStatus] = useState(event.status);
  const [addFriendsOpen, setAddFriendsOpen] = useState(false);
  const [bulkNamesInput, setBulkNamesInput] = useState('');
  const [addingParticipant, setAddingParticipant] = useState(false);
  const [mediaCount, setMediaCount] = useState(0);

  useEffect(() => {
    if (!deleteOpen) return;
    const countMedia = async () => {
      const [groupMsgs, chatMsgs] = await Promise.all([
        supabase.from('group_messages').select('media_url', { count: 'exact' }).eq('event_id', event.id).not('media_url', 'is', null),
        supabase.from('chat_messages').select('media_url', { count: 'exact' }).eq('event_id', event.id).not('media_url', 'is', null),
      ]);
      const total = (groupMsgs.count ?? 0) + (chatMsgs.count ?? 0);
      setMediaCount(total);
    };
    countMedia();
  }, [deleteOpen, event.id]);

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

  const handleAddFriends = async () => {
    const names = [...new Set(
      bulkNamesInput
        .split('\n')
        .map((n) => n.trim())
        .filter(Boolean)
    )];
    if (names.length === 0) return;
    setAddingParticipant(true);
    try {
      const newParticipants = names.map((name) => ({ id: crypto.randomUUID(), name, email: null, user_id: null }));
      await updateEvent.mutateAsync({ participants: [...event.participants, ...newParticipants] });
      setBulkNamesInput('');
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

  const handleDeleteEvent = async () => {
    try {
      await deleteEvent.mutateAsync(event.id);
      toast.success(lang === 'he' ? 'האירוע נמחק' : 'Event deleted');
      navigate('/home');
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
          className="text-muted-foreground transition-colors hover:text-foreground"
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

            <Dialog open={addFriendsOpen} onOpenChange={setAddFriendsOpen}>
              <DialogTrigger asChild>
                <Button type="button" variant="outline" className="self-start">
                  <UserPlus className="h-4 w-4" />
                  {lang === 'he' ? 'הוספת חברים' : 'Add friends'}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{lang === 'he' ? 'הוספת חברים ללא חשבון' : 'Add friends without an account'}</DialogTitle>
                </DialogHeader>
                <div className="flex gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900/30 dark:bg-blue-900/20 dark:text-blue-200">
                  <Info className="h-5 w-5 shrink-0" />
                  <p className="text-xs">
                    {lang === 'he'
                      ? 'זה מיועד רק למי שאין לו/לה טלפון או חשבון. אם החבר/ה מתכוון/ת להתחבר בעצמו/ה מהטלפון שלו/ה, עדיף שיצטרף/תצטרף עם קוד ההזמנה — כך הוא/היא יוכל/תוכל לראות את הטיול ולשוחח בצ׳אט.'
                      : "This is only for someone without a phone or account. If they plan to log in themselves from their own phone, it's better to have them join with the invite code instead — that way they can see the trip and chat."}
                  </p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>{lang === 'he' ? 'שמות (שם אחד בכל שורה)' : 'Names (one per line)'}</Label>
                  <Textarea
                    autoFocus
                    rows={5}
                    value={bulkNamesInput}
                    onChange={(e) => setBulkNamesInput(e.target.value)}
                    placeholder={lang === 'he' ? 'דנה כהן\nאבי לוי\nמיכל ברק' : 'Dana Cohen\nAvi Levi\nMichal Barak'}
                    className="placeholder:text-foreground/50"
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setAddFriendsOpen(false)}>
                    {lang === 'he' ? 'ביטול' : 'Cancel'}
                  </Button>
                  <Button
                    type="button"
                    onClick={handleAddFriends}
                    disabled={addingParticipant || !bulkNamesInput.trim()}
                  >
                    <UserPlus className="h-4 w-4" />
                    {lang === 'he' ? 'הוספה' : 'Add'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {canDelete && (
            <div className="flex flex-col gap-1.5 border-t border-border pt-4">
              <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogTrigger asChild>
                  <Button type="button" variant="destructive" className="self-start">
                    <Trash2 className="h-4 w-4" />
                    {lang === 'he' ? 'מחיקת האירוע' : 'Delete event'}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{lang === 'he' ? `למחוק את "${event.title}"?` : `Delete "${event.title}"?`}</DialogTitle>
                    <DialogDescription>
                      {lang === 'he'
                        ? 'הפעולה מוחקת לצמיתות את כל ההוצאות, ההודעות, הסקרים והתמונות של האירוע עבור כל המשתתפים. לא ניתן לבטל.'
                        : 'This permanently deletes all expenses, messages, polls, and photos in this event for every participant. This cannot be undone.'}
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
                    <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                      {lang === 'he' ? 'ביטול' : 'Cancel'}
                    </Button>
                    <Button variant="destructive" onClick={handleDeleteEvent} disabled={deleteEvent.isPending}>
                      {t('action_delete')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}

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
