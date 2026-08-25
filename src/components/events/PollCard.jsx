import { toast } from 'sonner';
import { Edit2, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useLang } from '@/hooks/useLang';
import { useCastVote, useDeletePoll } from '@/hooks/usePolls';
import { Card, CardContent } from '@/components/ui/card';
import { CreatePollModal } from '@/components/events/CreatePollModal';
import { cn } from '@/lib/utils';

export function PollCard({ poll, eventId, isManager }) {
  const { user } = useAuth();
  const { lang } = useLang();
  const castVote = useCastVote(eventId);
  const deletePoll = useDeletePoll(eventId);

  const votes = poll.poll_votes ?? [];
  const totalVotes = votes.length;
  const myVote = votes.find((v) => v.user_id === user.id)?.option_id;
  const canManage = poll.created_by === user.id || isManager;

  const handleVote = (optionId) => {
    if (poll.closed) return;
    castVote.mutate({ pollId: poll.id, optionId, userId: user.id });
  };

  const handleDelete = async () => {
    try {
      await deletePoll.mutateAsync(poll.id);
      toast.success(lang === 'he' ? 'הסקר נמחק' : 'Poll deleted');
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <Card className="border-secondary/30 bg-secondary/5">
      <CardContent className="flex flex-col gap-2.5 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium text-card-foreground">{poll.question}</p>
          {canManage && (
            <div className="flex shrink-0 items-center gap-1">
              {!poll.closed && (
                <CreatePollModal
                  eventId={eventId}
                  poll={poll}
                  trigger={
                    <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label={lang === 'he' ? 'עריכת סקר' : 'Edit poll'}>
                      <Edit2 className="h-4 w-4" />
                    </button>
                  }
                />
              )}
              <button
                type="button"
                onClick={handleDelete}
                className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label={lang === 'he' ? 'מחיקת סקר' : 'Delete poll'}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          {poll.options.map((opt) => {
            const optVotes = votes.filter((v) => v.option_id === opt.id).length;
            const pct = totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0;
            const isMine = myVote === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleVote(opt.id)}
                disabled={poll.closed}
                className={cn(
                  'relative overflow-hidden rounded-xl border px-3 py-2 text-start text-sm transition-colors',
                  isMine ? 'border-secondary' : 'border-border'
                )}
              >
                <div
                  className="absolute inset-y-0 start-0 bg-secondary/15"
                  style={{ width: `${pct}%` }}
                />
                <div className="relative flex items-center justify-between">
                  <span>{opt.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {optVotes} {lang === 'he' ? 'קולות' : 'votes'} · {pct}%
                  </span>
                </div>
              </button>
            );
          })}
        </div>
        {poll.closed && (
          <p className="text-xs text-muted-foreground">{lang === 'he' ? 'הסקר נסגר' : 'Poll closed'}</p>
        )}
      </CardContent>
    </Card>
  );
}
