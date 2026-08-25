import { Bell, MessageSquare, Receipt, HandCoins, UserPlus, ListPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/lib/AuthContext';
import { useLang } from '@/hooks/useLang';
import { useNotifications, useMarkAllNotificationsRead, useMarkNotificationRead } from '@/hooks/useNotifications';
import { formatChatTimestamp } from '@/lib/dateUtils';

const TYPE_ICON = {
  chat: MessageSquare,
  expense: Receipt,
  settlement: HandCoins,
  join: UserPlus,
  poll: ListPlus,
};

export function NotificationBell() {
  const { user } = useAuth();
  const { lang } = useLang();
  const navigate = useNavigate();
  const { data: notifications } = useNotifications(user.id);
  const markRead = useMarkNotificationRead(user.id);
  const markAllRead = useMarkAllNotificationsRead(user.id);

  const items = notifications ?? [];
  const unreadCount = items.filter((n) => !n.read).length;

  const handleClick = (n) => {
    if (!n.read) markRead.mutate(n.id);
    if (n.event_id) navigate(`/events/${n.event_id}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute end-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-sm font-semibold">{lang === 'he' ? 'התראות' : 'Notifications'}</span>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => markAllRead.mutate()}
              className="text-xs text-primary underline hover:no-underline"
            >
              {lang === 'he' ? 'סמן הכל כנקרא' : 'Mark all read'}
            </button>
          )}
        </div>
        {items.length === 0 && (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            {lang === 'he' ? 'אין התראות' : 'No notifications'}
          </p>
        )}
        {items.map((n) => {
          const Icon = TYPE_ICON[n.type] ?? Bell;
          return (
            <DropdownMenuItem
              key={n.id}
              onClick={() => handleClick(n)}
              className={`flex items-start gap-2.5 whitespace-normal ${!n.read ? 'bg-primary/5' : ''}`}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-tight">{n.title}</p>
                {n.body && <p className="truncate text-xs text-muted-foreground">{n.body}</p>}
                <p className="mt-0.5 text-[10px] text-muted-foreground">{formatChatTimestamp(n.created_at, lang)}</p>
              </div>
              {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
