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
      <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
        <Button asChild className="min-w-0 px-3 sm:px-5">
          <Link to="/events/new">
            <Plus className="h-4 w-4 shrink-0" />
            <span className="truncate">{t('action_create_event')}</span>
          </Link>
        </Button>
        <Button variant="outline" asChild className="min-w-0 px-3 sm:px-5">
          <Link to="/events/join">
            <KeyRound className="h-4 w-4 shrink-0" />
            <span className="truncate">{t('action_join_event')}</span>
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
                <Plus className="h-4 w-4 shrink-0" />
                <span className="truncate">{t('action_create_event')}</span>
              </Link>
            </Button>
          }
        />
      )}

      {!isLoading && events && events.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {[...events]
            .sort((a, b) => (a.status === 'active') === (b.status === 'active') ? 0 : a.status === 'active' ? -1 : 1)
            .map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
        </div>
      )}
    </div>
  );
}
