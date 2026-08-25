import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { useLang } from '@/hooks/useLang';
import { useJoinEvent } from '@/hooks/useEvents';
import { notifyEventMembers } from '@/api/notifications';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function JoinEvent() {
  const { user } = useAuth();
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const joinEvent = useJoinEvent();

  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const event = await joinEvent.mutateAsync({
        inviteCode: code,
        member: { name: user.user_metadata?.full_name || user.email, email: user.email },
      });
      const joinerName = user.user_metadata?.full_name || user.email;
      notifyEventMembers({
        event,
        excludeUserId: user.id,
        type: 'join',
        title: lang === 'he' ? `${joinerName} הצטרף/ה ל${event.title}` : `${joinerName} joined ${event.title}`,
      });
      toast.success(lang === 'he' ? 'הצטרפת לאירוע!' : 'Joined the event!');
      navigate(`/events/${event.id}`);
    } catch (err) {
      if (err.code === 'P0002') {
        toast.error(lang === 'he' ? 'לא נמצא אירוע עם קוד זה' : 'No event found with this code');
      } else {
        toast.error(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>{t('action_join_event')}</CardTitle>
          <CardDescription>
            {lang === 'he' ? 'הזינו את קוד ההזמנה שקיבלתם' : 'Enter the invite code you received'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="code">{lang === 'he' ? 'קוד הזמנה' : 'Invite code'}</Label>
              <Input
                id="code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="text-center text-lg font-mono tracking-[0.3em]"
                maxLength={6}
                placeholder="ABC123"
              />
            </div>
            <Button type="submit" disabled={submitting}>
              {t('action_join_event')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
