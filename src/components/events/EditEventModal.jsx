import { useState } from 'react';
import { toast } from 'sonner';
import { Settings2 } from 'lucide-react';
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
