import { useEffect, useState } from 'react';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useLang } from '@/hooks/useLang';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { PrivateChatThread } from '@/components/events/PrivateChatThread';

export function PrivateChatsList({ event, openWithParticipantId, scrollToMessageId }) {
  const { user } = useAuth();
  const { lang } = useLang();
  const [unreadByParticipant, setUnreadByParticipant] = useState({});

  const others = event.participants.filter((p) => p.user_id && p.user_id !== user.id);
  const [activeParticipant, setActiveParticipant] = useState(
    () => others.find((p) => p.id === openWithParticipantId) ?? null
  );

  useEffect(() => {
    const fetchUnread = async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('from_participant_id')
        .eq('event_id', event.id)
        .eq('to_user_id', user.id)
        .eq('read', false);

      const counts = {};
      for (const row of data ?? []) {
        counts[row.from_participant_id] = (counts[row.from_participant_id] ?? 0) + 1;
      }
      setUnreadByParticipant(counts);
    };

    fetchUnread();

    const channel = supabase
      .channel(`private-chats-${event.id}-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_messages', filter: `event_id=eq.${event.id}` },
        fetchUnread
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [event.id, user.id]);

  if (others.length === 0) {
    return (
      <EmptyState
        icon="👥"
        title={lang === 'he' ? 'אין עדיין משתתפים אחרים' : 'No other participants yet'}
        subtitle={lang === 'he' ? 'רק משתתפים שהצטרפו עם חשבון אפשר לשוחח איתם באופן פרטי' : 'Only participants who joined with an account can be messaged privately'}
      />
    );
  }

  if (activeParticipant) {
    return (
      <PrivateChatThread
        event={event}
        otherParticipant={activeParticipant}
        onBack={() => setActiveParticipant(null)}
        scrollToMessageId={scrollToMessageId}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {others.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => setActiveParticipant(p)}
          className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-start transition-colors hover:bg-muted"
        >
          <Avatar>
            <AvatarFallback>{p.name[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className="flex-1 font-medium text-card-foreground">{p.name}</span>
          {unreadByParticipant[p.id] > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-bold text-accent-foreground">
              {unreadByParticipant[p.id]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
