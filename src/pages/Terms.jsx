import { Link } from 'react-router-dom';

export default function Terms() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-12" style={{ paddingTop: 'calc(3rem + env(safe-area-inset-top))' }}>
        <Link to="/" className="text-sm text-primary hover:underline">
          ← חזרה ליחלוקו
        </Link>
        <h1 className="mt-4 text-3xl font-bold text-foreground">תנאי שימוש</h1>
        <p className="mt-1 text-sm text-muted-foreground">עודכן לאחרונה: אוגוסט 2026</p>

        <div className="mt-8 space-y-6 text-foreground">
          <section>
            <h2 className="text-xl font-semibold">השירות</h2>
            <p className="mt-2 text-muted-foreground">
              יחלוקו הוא כלי לתיעוד וחלוקת הוצאות משותפות בטיולים ואירועים בין קבוצת אנשים. השימוש
              באפליקציה כרוך ביצירת חשבון אישי.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">אחריות המשתמש</h2>
            <p className="mt-2 text-muted-foreground">
              אתם אחראים לנכונות המידע שאתם מזינים (הוצאות, חלוקות, פרטי משתתפים). יחלוקו הוא כלי
              עזר לחישוב וניהול חלוקת ההוצאות בלבד, ואינו מבצע העברות כספיות בין המשתמשים — ההסדרה
              בפועל בין המשתתפים נעשית מחוץ לאפליקציה.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">תוכן שאתם מעלים</h2>
            <p className="mt-2 text-muted-foreground">
              אתם האחראים הבלעדיים לתוכן שאתם מעלים לאפליקציה (הודעות, תמונות, קבלות). אין להעלות
              תוכן פוגעני, בלתי חוקי או שאינו שייך לכם.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">זמינות השירות</h2>
            <p className="mt-2 text-muted-foreground">
              אנחנו עושים מאמץ לשמור על זמינות ותקינות השירות, אך איננו מתחייבים לזמינות רציפה
              וללא תקלות.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">שינויים בתנאים</h2>
            <p className="mt-2 text-muted-foreground">
              אנחנו עשויים לעדכן את תנאי השימוש מעת לעת. המשך השימוש באפליקציה לאחר עדכון מהווה
              הסכמה לתנאים המעודכנים.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold">יצירת קשר</h2>
            <p className="mt-2 text-muted-foreground">
              שאלות לגבי תנאי השימוש? אפשר לפנות אלינו במייל:{' '}
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
