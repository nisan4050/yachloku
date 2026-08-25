import { Navigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Receipt, Split, MessageCircle } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useLang } from '@/hooks/useLang';
import { Button } from '@/components/ui/button';

const FEATURES = [
  { icon: Receipt, title: { he: 'תיעוד הוצאות', en: 'Track expenses' }, desc: { he: 'הוסיפו הוצאות בשניות, עם קבלות וקטגוריות', en: 'Log expenses in seconds, with receipts and categories' } },
  { icon: Split, title: { he: 'חלוקה חכמה', en: 'Smart splitting' }, desc: { he: 'שווה, מותאם אישית או באחוזים — כמו שנוח לכם', en: 'Equal, custom, or percentage — however you like' } },
  { icon: Users, title: { he: 'מזעור העברות', en: 'Fewer transfers' }, desc: { he: 'האלגוריתם שלנו מצמצם את מספר התשלומים הנדרש', en: 'Our algorithm minimizes the number of payments needed' } },
  { icon: MessageCircle, title: { he: 'צ׳אט מובנה', en: 'Built-in chat' }, desc: { he: 'תאמו ותשוחחו על הטיול בלי לצאת מהאפליקציה', en: 'Coordinate the trip without leaving the app' } },
];

export default function Landing() {
  const { user, loading } = useAuth();
  const { lang, t } = useLang();

  if (!loading && user) return <Navigate to="/home" replace />;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/40">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🧳</span>
          <span className="text-lg font-bold text-primary">{t('appName')}</span>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" asChild>
            <Link to="/login">{t('login')}</Link>
          </Button>
          <Button asChild>
            <Link to="/signup">{t('signup')}</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pt-12 text-center md:pt-20">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-4xl font-extrabold tracking-tight text-foreground md:text-6xl"
        >
          {t('appName')}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground"
        >
          {t('tagline')}
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-8 flex justify-center gap-3"
        >
          <Button size="lg" variant="accent" asChild>
            <Link to="/signup">{lang === 'he' ? 'בואו נתחיל' : 'Get started'}</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/login">{t('login')}</Link>
          </Button>
        </motion.div>

        <div className="mx-auto mt-16 grid max-w-3xl grid-cols-1 gap-4 pb-20 sm:grid-cols-2">
          {FEATURES.map(({ icon: Icon, title, desc }, i) => (
            <motion.div
              key={title.en}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.25 + i * 0.08 }}
              className="rounded-3xl border border-border bg-card p-6 text-start shadow-sm"
            >
              <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-card-foreground">{title[lang]}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{desc[lang]}</p>
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  );
}
