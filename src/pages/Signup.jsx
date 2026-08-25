import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { useLang } from '@/hooks/useLang';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Signup() {
  const { user, loading, signUp, signInWithGoogle } = useAuth();
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) return <Navigate to="/home" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const { data, error } = await signUp(email, password, fullName);
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data.session) {
      toast.success(
        lang === 'he'
          ? 'נרשמת בהצלחה! שלחנו לכם מייל אישור — יש ללחוץ על הקישור בו כדי להתחבר.'
          : "Signed up! We've sent a confirmation email — click the link in it to log in.",
        { duration: 8000 }
      );
      navigate('/login');
      return;
    }
    toast.success(lang === 'he' ? 'נרשמת בהצלחה!' : 'Signed up successfully!');
    navigate('/home');
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted/40 px-4 py-8"
      style={{ paddingTop: 'max(2rem, env(safe-area-inset-top))', paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
    >
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-1 text-3xl">🧳</div>
          <CardTitle>{t('signup')}</CardTitle>
          <CardDescription>{t('appName')} · {t('tagline')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fullName">{t('full_name')}</Label>
              <Input id="fullName" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">{t('email')}</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">{t('password')}</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={submitting}>
              {t('signup')}
            </Button>
          </form>

          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            {lang === 'he' ? 'או' : 'or'}
            <div className="h-px flex-1 bg-border" />
          </div>

          <Button variant="outline" className="w-full" onClick={() => signInWithGoogle()}>
            Google
          </Button>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {lang === 'he' ? 'כבר יש לך חשבון?' : 'Already have an account?'}{' '}
            <Link to="/login" className="font-medium text-primary hover:underline">
              {t('login')}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
