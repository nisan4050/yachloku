import { useState } from 'react';
import { UserPlus, X, Info } from 'lucide-react';
import { useLang } from '@/hooks/useLang';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

/**
 * Reusable "add friends without an account" flow — name-by-name entry with a
 * pending chip list (not a bulk textarea), plus an on-demand info popup
 * explaining this is only for people without a phone/account. Used both from
 * CreateEvent (before the trip exists) and EditEventModal (after).
 */
export function AddFriendsDialog({ open, onOpenChange, onConfirm, adding }) {
  const { lang } = useLang();
  const [nameInput, setNameInput] = useState('');
  const [pendingNames, setPendingNames] = useState([]);
  const [infoOpen, setInfoOpen] = useState(false);

  const addName = () => {
    const name = nameInput.trim();
    if (!name) return;
    if (!pendingNames.some((n) => n.toLowerCase() === name.toLowerCase())) {
      setPendingNames((prev) => [...prev, name]);
    }
    setNameInput('');
  };

  const removeName = (name) => {
    setPendingNames((prev) => prev.filter((n) => n !== name));
  };

  const handleConfirm = async () => {
    if (pendingNames.length === 0) return;
    await onConfirm(pendingNames);
    setPendingNames([]);
    setNameInput('');
  };

  const handleOpenChange = (next) => {
    if (!next) {
      setPendingNames([]);
      setNameInput('');
    }
    onOpenChange(next);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{lang === 'he' ? 'הוספת חברים' : 'Add friends'}</DialogTitle>
          </DialogHeader>

          <button
            type="button"
            onClick={() => setInfoOpen(true)}
            className="flex items-center gap-1.5 self-start text-xs text-primary underline underline-offset-2 hover:no-underline"
          >
            <Info className="h-3.5 w-3.5" />
            {lang === 'he' ? 'למי זה מיועד?' : "Who is this for?"}
          </button>

          <div className="flex flex-col gap-1.5">
            <div className="flex gap-2">
              <Input
                autoFocus
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder={lang === 'he' ? 'שם החבר' : "Friend's name"}
                className="placeholder:text-foreground/50"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addName();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addName} disabled={!nameInput.trim()}>
                <UserPlus className="h-4 w-4" />
                {lang === 'he' ? 'הוספה' : 'Add'}
              </Button>
            </div>

            {pendingNames.length > 0 && (
              <div className="flex flex-wrap gap-1.5 rounded-xl border border-border p-2">
                {pendingNames.map((name) => (
                  <Badge key={name} variant="secondary" className="gap-1 py-1 ps-2.5 pe-1.5 text-xs font-normal">
                    {name}
                    <button
                      type="button"
                      onClick={() => removeName(name)}
                      aria-label={lang === 'he' ? 'הסרה' : 'Remove'}
                      className="rounded-full p-0.5 hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              {lang === 'he' ? 'ביטול' : 'Cancel'}
            </Button>
            <Button type="button" onClick={handleConfirm} disabled={adding || pendingNames.length === 0}>
              <UserPlus className="h-4 w-4" />
              {lang === 'he'
                ? pendingNames.length > 0
                  ? `הוספת ${pendingNames.length} חברים`
                  : 'הוספה'
                : pendingNames.length > 0
                  ? `Add ${pendingNames.length} friend${pendingNames.length > 1 ? 's' : ''}`
                  : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{lang === 'he' ? 'הוספת חבר ללא חשבון' : 'Adding a friend without an account'}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {lang === 'he'
              ? 'הוספה ידנית מיועדת רק למי שאין לו טלפון או חשבון. אם החבר מתכנן להתחבר בעצמו מהטלפון שלו, עדיף שיצטרף עם קוד ההזמנה — כך הוא יוכל לראות את הטיול ולהשתתף בצ׳אט.'
              : "Adding someone manually is only for a friend without a phone or account. If they plan to log in themselves from their own phone, it's better to have them join with the invite code instead — that way they can see the trip and take part in the chat."}
          </p>
          <DialogFooter>
            <Button type="button" onClick={() => setInfoOpen(false)}>
              {lang === 'he' ? 'הבנתי' : 'Got it'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
