import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { useLang } from '@/hooks/useLang';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ResetPassword() {
  const { resetPassword } = useAuth();
  const { t, lang } = useLang();
  const he = lang === 'he';
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error(he ? 'הסיסמאות אינן זהות' : 'Passwords do not match');
      return;
    }
    setSubmitting(true);
    const { error } = await resetPassword(token, password);
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(he ? 'הסיסמה עודכנה, התחברתם בהצלחה' : 'Password updated, you are signed in');
    navigate('/home', { replace: true });
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted/40 px-4 py-8"
      style={{ paddingTop: 'max(2rem, env(safe-area-inset-top))', paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
    >
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-1 text-3xl">🔑</div>
          <CardTitle>{he ? 'בחירת סיסמה חדשה' : 'Choose a new password'}</CardTitle>
          <CardDescription>{he ? 'לפחות 6 תווים' : 'At least 6 characters'}</CardDescription>
        </CardHeader>
        <CardContent>
          {!token ? (
            <p className="text-center text-sm text-destructive">
              {he ? 'הקישור אינו תקין. בקשו קישור חדש.' : 'This link is not valid. Request a new one.'}
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">{t('password')}</Label>
                <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirm">{he ? 'אימות סיסמה' : 'Confirm password'}</Label>
                <Input id="confirm" type="password" required minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
              <Button type="submit" disabled={submitting}>
                {he ? 'שמירה והתחברות' : 'Save and sign in'}
              </Button>
            </form>
          )}
          <p className="mt-6 text-center text-sm">
            <Link to="/forgot-password" className="font-medium text-primary hover:underline">
              {he ? 'בקשת קישור חדש' : 'Request a new link'}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
