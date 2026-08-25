import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import { Home, Plus, KeyRound, Settings, Sparkles } from 'lucide-react';
import { useMyEvents } from '@/hooks/useEvents';
import { useLang } from '@/hooks/useLang';
import { Dialog, DialogContent } from '@/components/ui/dialog';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { lang } = useLang();
  const { data: events } = useMyEvents();

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const go = (path) => {
    navigate(path);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg gap-0 p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
        <Command
          className="flex flex-col overflow-hidden rounded-3xl bg-transparent"
          label={lang === 'he' ? 'פעולה מהירה' : 'Quick actions'}
        >
          <Command.Input
            autoFocus
            placeholder={lang === 'he' ? 'חפשו אירוע או פעולה...' : 'Search an event or action...'}
            className="border-b border-border bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground"
          />
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
              {lang === 'he' ? 'לא נמצאו תוצאות' : 'No results found'}
            </Command.Empty>

            <Command.Group heading={lang === 'he' ? 'פעולות' : 'Actions'} className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              <Item icon={Home} label={lang === 'he' ? 'דף הבית' : 'Home'} onSelect={() => go('/home')} />
              <Item icon={Plus} label={lang === 'he' ? 'אירוע חדש' : 'New event'} onSelect={() => go('/events/new')} />
              <Item icon={KeyRound} label={lang === 'he' ? 'הצטרפות עם קוד' : 'Join with code'} onSelect={() => go('/events/join')} />
              <Item icon={Settings} label={lang === 'he' ? 'הגדרות' : 'Settings'} onSelect={() => go('/settings')} />
            </Command.Group>

            {events && events.length > 0 && (
              <Command.Group heading={lang === 'he' ? 'אירועים' : 'Events'} className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                {events.map((event) => (
                  <Item
                    key={event.id}
                    icon={Sparkles}
                    label={`${event.icon ?? ''} ${event.title}`}
                    onSelect={() => go(`/events/${event.id}`)}
                  />
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function Item({ icon: Icon, label, onSelect }) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm outline-none data-[selected=true]:bg-muted"
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      {label}
    </Command.Item>
  );
}
