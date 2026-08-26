import { Link } from 'react-router-dom';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-12" style={{ paddingTop: 'calc(3rem + env(safe-area-inset-top))' }}>
        <Link to="/" className="text-sm text-primary hover:underline">
          ← חזרה ליחלוקו
        </Link>
        <h1 className="mt-4 text-3xl font-bold text-foreground">מדיניות פרטיות</h1>
        <p className="mt-1 text-sm text-muted-foreground">עודכן לאחרונה: אוגוסט 2026</p>

        <div className="mt-8 space-y-6 text-foreground">
          <section>
            <h2 className="text-xl font-semibold">איזה מידע אנחנו אוספים</h2>
            <p className="mt-2 text-muted-foreground">
              כשאתם נרשמים ליחלוקו אנחנו שומרים את השם והאימייל שלכם (או פרטי חשבון ה-Google שלכם,
              אם אתם מתחברים דרך Google). בתוך אירועים שאתם יוצרים או מצטרפים אליהם אנחנו שומרים את
              ההוצאות, ההודעות, הסקרים והתמונות שאתם מעלים, לצורך תפעול השירות בלבד.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">איך אנחנו משתמשים במידע</h2>
            <p className="mt-2 text-muted-foreground">
              המידע משמש אך ורק להפעלת האפליקציה — הצגת האירועים וההוצאות שלכם, חישוב חלוקת התשלומים,
              ושליחת התראות (Push) על פעילות באירועים שאתם חברים בהם. אנחנו לא מוכרים ולא משתפים את
              המידע שלכם עם צדדים שלישיים לצורכי פרסום.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">התחברות עם Google</h2>
            <p className="mt-2 text-muted-foreground">
              אם אתם מתחברים עם חשבון Google, אנחנו מקבלים מגוגל רק את השם, כתובת האימייל ותמונת
              הפרופיל שלכם — ואת המזהה הזה משתמשים אך ורק לזיהוי החשבון שלכם באפליקציה.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">איפה המידע מאוחסן</h2>
            <p className="mt-2 text-muted-foreground">
              המידע מאוחסן אצל ספקי תשתית חיצוניים (Supabase לבסיס הנתונים ואחסון קבצים, Firebase
              להתראות Push), תחת אבטחה מקובלת בתעשייה.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">מחיקת מידע</h2>
            <p className="mt-2 text-muted-foreground">
              אתם יכולים למחוק את החשבון שלכם בכל עת דרך עמוד ההגדרות באפליקציה. מחיקת חשבון מוחקת
              לצמיתות את הפרטים האישיים שלכם מהמערכת.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">יצירת קשר</h2>
            <p className="mt-2 text-muted-foreground">
              שאלות לגבי מדיניות הפרטיות? אפשר לפנות אלינו במייל:{' '}
              <a href="mailto:nisan4050@gmail.com" className="text-primary hover:underline">
                nisan4050@gmail.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
