import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useLang } from '@/hooks/useLang';
import { useCreateEvent } from '@/hooks/useEvents';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AddFriendsDialog } from '@/components/events/AddFriendsDialog';

const ICONS = ['🧳', '🏖️', '⛰️', '🏕️', '🎉', '🚐', '✈️', '🚢', '🍽️', '🏙️'];
const CURRENCIES = ['ILS', 'USD', 'EUR', 'GBP'];

export default function CreateEvent() {
  const { user } = useAuth();
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const createEvent = useCreateEvent();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState(ICONS[0]);
  const [currency, setCurrency] = useState('ILS');
  const [friendNames, setFriendNames] = useState([]);
  const [addFriendsOpen, setAddFriendsOpen] = useState(false);

  const handleAddFriends = (names) => {
    setFriendNames((prev) => [...new Set([...prev, ...names])]);
    setAddFriendsOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const event = await createEvent.mutateAsync({
        title,
        description,
        icon,
        currency,
        userId: user.id,
        participantName: user.user_metadata?.full_name || user.email,
        extraParticipantNames: friendNames,
      });
      toast.success(lang === 'he' ? 'האירוע נוצר!' : 'Event created!');
      navigate(`/events/${event.id}`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>{t('action_create_event')}</CardTitle>
          <Button variant="ghost" size="icon" asChild>
            <Link to="/home" aria-label={lang === 'he' ? 'סגירה' : 'Close'}>
              <X className="h-5 w-5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label>{lang === 'he' ? 'אייקון' : 'Icon'}</Label>
              <div className="flex flex-wrap gap-2">
                {ICONS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setIcon(ic)}
                    className={`flex h-11 w-11 items-center justify-center rounded-2xl text-xl transition-colors ${
                      icon === ic ? 'bg-primary/15 ring-2 ring-primary' : 'bg-muted hover:bg-muted/70'
                    }`}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="title">{lang === 'he' ? 'כותרת' : 'Title'}</Label>
              <Input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">{lang === 'he' ? 'תיאור (לא חובה)' : 'Description (optional)'}</Label>
              <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

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
              <Label>{lang === 'he' ? 'חברים (לא חובה)' : 'Friends (optional)'}</Label>
              {friendNames.length > 0 && (
                <div className="flex flex-wrap gap-1.5 rounded-xl border border-border p-2">
                  {friendNames.map((name) => (
                    <Badge key={name} variant="secondary" className="gap-1 py-1 ps-2.5 pe-1.5 text-xs font-normal">
                      {name}
                      <button
                        type="button"
                        onClick={() => setFriendNames((prev) => prev.filter((n) => n !== name))}
                        aria-label={lang === 'he' ? 'הסרה' : 'Remove'}
                        className="rounded-full p-0.5 hover:bg-destructive/10 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <Button type="button" variant="outline" className="self-start" onClick={() => setAddFriendsOpen(true)}>
                {lang === 'he' ? 'הוספת חברים' : 'Add friends'}
              </Button>
              <AddFriendsDialog open={addFriendsOpen} onOpenChange={setAddFriendsOpen} onConfirm={handleAddFriends} />
            </div>

            <Button type="submit" disabled={createEvent.isPending}>
              {t('action_save')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
