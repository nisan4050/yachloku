import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';
import { Home, Settings, LogOut, User, Search } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useLang } from '@/hooks/useLang';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';

// "Create trip" isn't here — it's redundant with the prominent button already
// on the home page itself.
const NAV_ITEMS = [
  { to: '/home', icon: Home, key: 'nav_home' },
  { to: '/settings', icon: Settings, key: 'nav_settings' },
];

export function AppShell({ children }) {
  const { user, signOut } = useAuth();
  const { t, lang } = useLang();
  const location = useLocation();
  const navigate = useNavigate();
  const keyboardVisible = useKeyboardVisible();

  const initials = (user?.user_metadata?.full_name || user?.email || '?')[0]?.toUpperCase();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let listeners = [];
    import('@capacitor/push-notifications').then(({ PushNotifications }) => {
      Promise.all([
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          const url = notification.data?.url;
          toast(notification.title ?? '', {
            description: notification.body,
            icon: '🧳',
            duration: 6000,
            action: url ? { label: lang === 'he' ? 'צפייה' : 'View', onClick: () => navigate(url) } : undefined,
            onClick: url ? () => navigate(url) : undefined,
          });
        }),
        PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          const url = action.notification?.data?.url;
          if (url) navigate(url);
        }),
      ]).then((handles) => {
        listeners = handles;
      });
    });
    return () => listeners.forEach((h) => h.remove());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <CommandPalette />
      <header
        className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/home" className="flex items-center gap-2">
            <span className="text-2xl">🧳</span>
            <span className="text-lg font-bold text-primary">{t('appName')}</span>
          </Link>

          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              className="hidden md:inline-flex"
              onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
              title="⌘K"
            >
              <Search className="h-5 w-5" />
            </Button>
            <NotificationBell />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="ms-1 rounded-full ring-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar>
                    <AvatarImage src={user?.user_metadata?.avatar_url} alt="" />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate('/settings')}>
                  <User className="h-4 w-4" />
                  {t('nav_settings')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()}>
                  <LogOut className="h-4 w-4" />
                  {t('logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main
        className="mx-auto max-w-6xl flex-1 px-4 py-6 sm:px-6"
        style={{ paddingBottom: keyboardVisible ? '1.5rem' : 'calc(5rem + env(safe-area-inset-bottom) + 1.25rem)' }}
      >
        {children}
      </main>

      <nav
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/80 backdrop-blur transition-transform ${
          keyboardVisible ? 'translate-y-full' : 'translate-y-0'
        }`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-around h-20 px-2">
          {NAV_ITEMS.map(({ to, icon: Icon, key }) => (
            <Link
              key={to}
              to={to}
              className={`flex flex-1 flex-col items-center justify-center gap-1 px-3 py-2 text-xs font-medium transition-colors sm:px-4 ${
                location.pathname === to ? 'text-primary' : 'text-muted-foreground hover:text-primary'
              }`}
            >
              <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
              <span className="hidden sm:block">{t(key)}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
