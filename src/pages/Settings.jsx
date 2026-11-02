import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { Paperclip, Send, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useLang } from '@/hooks/useLang';
import { useTheme } from '@/hooks/useTheme';
import { useAccessibility } from '@/hooks/useAccessibility';
import { useProfile, useUpdateNotificationPrefs } from '@/hooks/useNotificationPrefs';
import { isPushSupported, subscribeToPush, unsubscribeFromPush } from '@/lib/notificationManager';
import { submitFeedback } from '@/api/feedback';
import { deleteAccount } from '@/api/account';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const DELETE_CONFIRM_WORD = { he: 'מחק', en: 'DELETE' };

const FONT_SCALE_LABEL = {
  sm: { he: 'קטן', en: 'Small' },
  md: { he: 'רגיל', en: 'Default' },
  lg: { he: 'גדול', en: 'Large' },
  xl: { he: 'גדול מאוד', en: 'Extra large' },
};

const NOTIFICATION_TOGGLES = [
  { key: 'chat', he: 'הודעות צ׳אט', en: 'Chat messages' },
  { key: 'expenses', he: 'הוצאות חדשות', en: 'New expenses' },
  { key: 'balance_changes', he: 'שינויים באיזון חשבון', en: 'Balance changes' },
  { key: 'daily_digest', he: 'סיכום יומי', en: 'Daily digest' },
];

export default function Settings() {
  const { user, signOut } = useAuth();
  const { lang, toggleLang, t } = useLang();
  const { mode: themeMode, setMode: setThemeMode } = useTheme();
  const { highContrast, setHighContrast, fontScale, setFontScale, fontScales } = useAccessibility();
  const [pushEnabled, setPushEnabled] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackFile, setFeedbackFile] = useState(null);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const feedbackFileRef = useRef(null);

  const { data: profile } = useProfile(user.id);
  const updatePrefs = useUpdateNotificationPrefs(user.id);
  const prefs = profile?.notification_prefs ?? { chat: true, expenses: true, balance_changes: true, daily_digest: false };

  const handleTogglePush = async (checked) => {
    try {
      if (checked) {
        await subscribeToPush(user.id);
      } else {
        await unsubscribeFromPush(user.id);
      }
      setPushEnabled(checked);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleTogglePref = (key, checked) => {
    updatePrefs.mutate({ ...prefs, [key]: checked });
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      await deleteAccount();
      await signOut();
    } catch (err) {
      toast.error(err.message);
      setDeletingAccount(false);
    }
  };

  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    if (!feedbackMessage.trim()) return;
    setSubmittingFeedback(true);
    try {
      await submitFeedback({
        userId: user.id,
        senderEmail: user.email,
        senderName: user.user_metadata?.full_name || user.email,
        message: feedbackMessage,
        file: feedbackFile,
      });
      toast.success(lang === 'he' ? 'ההערה נשלחה, תודה!' : 'Feedback submitted, thank you!');
      setFeedbackMessage('');
      setFeedbackFile(null);
      if (feedbackFileRef.current) feedbackFileRef.current.value = '';
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmittingFeedback(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <h1 className="text-2xl font-bold text-foreground">{t('nav_settings')}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{lang === 'he' ? 'חשבון' : 'Account'}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          <div className="flex flex-col gap-1">
            <p className="text-muted-foreground">{t('email')}</p>
            <p className="font-medium text-foreground">{user?.email}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{lang === 'he' ? 'העדפות' : 'Preferences'}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="lang-switch">{lang === 'he' ? 'שפה: עברית' : 'Language: English'}</Label>
            <Switch id="lang-switch" checked={lang === 'en'} onCheckedChange={toggleLang} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label>{lang === 'he' ? 'ערכת נושא' : 'Theme'}</Label>
            <Select value={themeMode} onValueChange={setThemeMode}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">{lang === 'he' ? 'אוטומטי (לפי המכשיר)' : 'Auto (device)'}</SelectItem>
                <SelectItem value="light">{lang === 'he' ? 'בהיר' : 'Light'}</SelectItem>
                <SelectItem value="dark">{lang === 'he' ? 'כהה' : 'Dark'}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isPushSupported() && (
            <div className="flex items-center justify-between">
              <Label htmlFor="push-switch">{lang === 'he' ? 'התראות Push' : 'Push notifications'}</Label>
              <Switch id="push-switch" checked={pushEnabled} onCheckedChange={handleTogglePush} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{lang === 'he' ? 'התראות — מה לקבל' : 'Notifications — what to receive'}</CardTitle>
          <p className="text-xs text-muted-foreground">
            {lang === 'he'
              ? 'העדפה בתוך האפליקציה בלבד — לא מפעילה או מכבה התראות ברמת המכשיר.'
              : "An in-app preference only — it doesn't turn device-level notifications on or off."}
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {NOTIFICATION_TOGGLES.map(({ key, he, en }) => (
            <div key={key} className="flex items-center justify-between">
              <Label htmlFor={`pref-${key}`}>{lang === 'he' ? he : en}</Label>
              <Switch id={`pref-${key}`} checked={Boolean(prefs[key])} onCheckedChange={(v) => handleTogglePref(key, v)} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{lang === 'he' ? 'נגישות' : 'Accessibility'}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="contrast-switch">{lang === 'he' ? 'ניגודיות גבוהה' : 'High contrast'}</Label>
            <Switch id="contrast-switch" checked={highContrast} onCheckedChange={setHighContrast} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{lang === 'he' ? 'גודל טקסט' : 'Text size'}</Label>
            <Select value={fontScale} onValueChange={setFontScale}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fontScales.map((scale) => (
                  <SelectItem key={scale} value={scale}>
                    {FONT_SCALE_LABEL[scale][lang]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{lang === 'he' ? 'הערות למפתח' : 'Feedback to the developer'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmitFeedback} className="flex flex-col gap-3">
            <Textarea
              required
              value={feedbackMessage}
              onChange={(e) => setFeedbackMessage(e.target.value)}
              placeholder={lang === 'he' ? 'תיאור הבעיה או הרעיון...' : 'Describe the issue or idea...'}
              rows={4}
            />
            <input
              ref={feedbackFileRef}
              type="file"
              onChange={(e) => setFeedbackFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => feedbackFileRef.current?.click()}>
                <Paperclip className="h-4 w-4" />
                {feedbackFile ? feedbackFile.name : lang === 'he' ? 'צירוף קובץ' : 'Attach file'}
              </Button>
              <Button type="submit" size="sm" disabled={submittingFeedback || !feedbackMessage.trim()}>
                {submittingFeedback ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {lang === 'he' ? 'שליחה' : 'Send'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {user?.isAdmin && (
        <Button asChild variant="outline">
          <Link to="/admin">
            <ShieldCheck className="h-4 w-4" />
            {lang === 'he' ? 'ניהול' : 'Admin'}
          </Link>
        </Button>
      )}

      <Button variant="outline" onClick={() => signOut()}>
        {t('logout')}
      </Button>

      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setDeleteConfirmText('');
        }}
      >
        <DialogTrigger asChild>
          <Button variant="destructive">{lang === 'he' ? 'מחיקת חשבון' : 'Delete account'}</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{lang === 'he' ? 'למחוק את החשבון?' : 'Delete your account?'}</DialogTitle>
            <DialogDescription>
              {lang === 'he'
                ? 'הפעולה תסיר אותך מכל האירועים ותמחק את החשבון לצמיתות. לא ניתן לבטל.'
                : 'This removes you from every event and permanently deletes your account. This cannot be undone.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="delete-confirm-input">
              {lang === 'he'
                ? `הקלידו "${DELETE_CONFIRM_WORD.he}" כדי לאשר`
                : `Type "${DELETE_CONFIRM_WORD.en}" to confirm`}
            </Label>
            <Input
              id="delete-confirm-input"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deletingAccount || deleteConfirmText !== DELETE_CONFIRM_WORD[lang]}
            >
              {deletingAccount && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('action_delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
