import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLang } from '@/hooks/useLang';

const STATUS_VARIANT = { active: 'default', settled: 'secondary', archived: 'outline' };
const STATUS_LABEL = {
  active: { he: 'פעיל', en: 'Active' },
  settled: { he: 'נסגר', en: 'Settled' },
  archived: { he: 'בארכיון', en: 'Archived' },
};

export function EventCard({ event }) {
  const { lang } = useLang();
  const isActive = event.status === 'active';

  return (
    <Link to={`/events/${event.id}`}>
      <Card className={`transition-transform hover:-translate-y-0.5 hover:shadow-md ${!isActive ? 'opacity-60 grayscale-[0.4]' : ''}`}>
        <CardContent className="flex items-center gap-4 p-5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-3xl">
            {event.icon || '🧳'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-semibold text-card-foreground">{event.title}</h3>
              <Badge variant={STATUS_VARIANT[event.status]}>{STATUS_LABEL[event.status]?.[lang]}</Badge>
            </div>
            {event.description && <p className="mt-0.5 truncate text-sm text-muted-foreground">{event.description}</p>}
            <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              {event.participants?.length ?? 0} {lang === 'he' ? 'משתתפים' : 'participants'}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
