import { Link } from 'react-router-dom';
import { Download as DownloadIcon, Smartphone, Share2 } from 'lucide-react';
import { useLang } from '@/hooks/useLang';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const APK_URL = 'https://github.com/nisan4050/yachloku/releases/latest/download/yachloku.apk';

export default function Download() {
  const { lang } = useLang();
  const he = lang === 'he';

  const apkSteps = he
    ? [
        'לחצו על "הורדת האפליקציה" ופתחו את הקובץ שירד.',
        'אם אנדרואיד חוסם את ההתקנה, אשרו "התקנה ממקור זה" בהגדרות שייפתחו, וחזרו אחורה.',
        'לחצו "התקנה". אחרי ההתקנה האפליקציה תופיע במסך הבית.',
      ]
    : [
        'Tap "Download the app" and open the file.',
        'If Android blocks it, allow "Install from this source" in the settings that open, then go back.',
        'Tap "Install". The app will appear on your home screen.',
      ];

  const pwaSteps = he
    ? ['פתחו את www.yachloku.com ב-Chrome.', 'תפריט (שלוש נקודות) ← "הוספה למסך הבית" / "התקנת אפליקציה".']
    : ['Open www.yachloku.com in Chrome.', 'Menu (three dots) → "Add to Home screen" / "Install app".'];

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted/40 px-4 py-8"
      style={{ paddingTop: 'max(2rem, env(safe-area-inset-top))', paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
    >
      <div className="flex w-full max-w-md flex-col gap-4">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-1 text-4xl">🧳</div>
            <CardTitle>{he ? 'האפליקציה של יחלוקו' : 'The Yachloku app'}</CardTitle>
            <CardDescription>{he ? 'להתקנה ישירה באנדרואיד, בלי חנות אפליקציות' : 'Direct install on Android, no app store'}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Button asChild size="lg">
              <a href={APK_URL}>
                <DownloadIcon className="h-5 w-5" />
                {he ? 'הורדת האפליקציה (APK)' : 'Download the app (APK)'}
              </a>
            </Button>
            <ol className="flex list-decimal flex-col gap-1.5 ps-5 text-sm text-muted-foreground">
              {apkSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Smartphone className="h-4 w-4" />
              {he ? 'או בלי הורדה: התקנה מהדפדפן' : 'Or without a download: install from the browser'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="flex list-decimal flex-col gap-1.5 ps-5 text-sm text-muted-foreground">
              {pwaSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <Share2 className="h-3.5 w-3.5" />
          {he ? 'אפשר לשתף את הדף הזה עם חברים' : 'You can share this page with friends'}
        </p>
        <Link to="/" className="text-center text-sm font-medium text-primary hover:underline">
          {he ? 'חזרה לאתר' : 'Back to the site'}
        </Link>
      </div>
    </div>
  );
}
