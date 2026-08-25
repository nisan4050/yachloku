import { Link } from 'react-router-dom';
import { Plus, KeyRound } from 'lucide-react';
import { useMyEvents } from '@/hooks/useEvents';
import { useLang } from '@/hooks/useLang';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { EventCard } from '@/components/events/EventCard';
import { CrossEventSummary } from '@/components/events/CrossEventSummary';

export default function Home() {
  const { data: events, isLoading } = useMyEvents();
  const { t } = useLang();

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('nav_home')}</h1>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
        <Button variant="outline" asChild className="w-full sm:w-auto">
          <Link to="/events/join">
            <KeyRound className="h-4 w-4" />
            {t('action_join_event')}
          </Link>
        </Button>
        <Button asChild className="w-full sm:w-auto">
          <Link to="/events/new">
            <Plus className="h-4 w-4" />
            {t('action_create_event')}
          </Link>
        </Button>
      </div>

      {!isLoading && events && events.length > 0 && <CrossEventSummary events={events} />}

      {isLoading && (
        <div className="grid gap-3 sm:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      )}

      {!isLoading && (!events || events.length === 0) && (
        <EmptyState
          icon="🏝️"
          title={t('empty_events_title')}
          subtitle={t('empty_events_subtitle')}
          action={
            <Button asChild>
              <Link to="/events/new">
                <Plus className="h-4 w-4" />
                {t('action_create_event')}
              </Link>
            </Button>
          }
        />
      )}

      {!isLoading && events && events.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
