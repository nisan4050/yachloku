import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { serverFetch } from '@/api/server';
import { useLang } from '@/hooks/useLang';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ForgotPassword() {
  const { t, lang } = useLang();
  const he = lang === 'he';
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await serverFetch('/auth/forgot', { method: 'POST', body: { email } });
      setSent(true);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted/40 px-4 py-8"
      style={{ paddingTop: 'max(2rem, env(safe-area-inset-top))', paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
    >
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-1 text-3xl">🔑</div>
          <CardTitle>{he ? 'איפוס סיסמה' : 'Reset password'}</CardTitle>
          <CardDescription>
            {he ? 'נשלח אליכם קישור לבחירת סיסמה חדשה' : "We'll email you a link to choose a new password"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <p className="rounded-xl bg-primary/10 p-4 text-center text-sm text-foreground">
              {he
                ? 'אם הכתובת רשומה אצלנו, נשלח אליה קישור לאיפוס הסיסמה. בדקו גם בתיקיית הספאם.'
                : "If that address is registered, we've sent it a reset link. Check your spam folder too."}
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">{t('email')}</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <Button type="submit" disabled={submitting}>
                {he ? 'שליחת קישור' : 'Send link'}
              </Button>
            </form>
          )}
          <p className="mt-6 text-center text-sm">
            <Link to="/login" className="font-medium text-primary hover:underline">
              {he ? 'חזרה להתחברות' : 'Back to sign in'}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
