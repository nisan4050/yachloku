import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Zap, Edit2 } from 'lucide-react';
import { useLang } from '@/hooks/useLang';
import { CATEGORIES } from '@/lib/categories';
import { computeSplitBetween } from '@/lib/settlementEngine';
import { getRememberedSplit, rememberSplit } from '@/lib/expenseDefaults';
import { fetchExchangeRates } from '@/lib/exchangeRates';
import { validateAmount, validateDescription, detectDuplicate } from '@/lib/expenseValidation';
import { useCreateExpense, useUpdateExpense, useExpenses } from '@/hooks/useExpenses';
import { uploadReceipt } from '@/api/expenses';
import { notifyEventMembers } from '@/api/notifications';
import { enqueueExpense } from '@/lib/offlineQueue';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const CURRENCIES = ['ILS', 'USD', 'EUR', 'GBP'];

// Simple Alert component
function Alert({ className, children }) {
  return <div className={cn('rounded-lg border border-border bg-muted p-3', className)}>{children}</div>;
}

function AlertDescription({ className, children }) {
  return <div className={cn('text-sm', className)}>{children}</div>;
}

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const today = () => new Date().toISOString().slice(0, 10);

export function AddExpenseModal({ event, userId, expense, trigger, open: controlledOpen, onOpenChange }) {
  const { lang, t } = useLang();
  const isEdit = Boolean(expense);
  const createExpense = useCreateExpense(event.id);
  const updateExpense = useUpdateExpense(event.id);
  const { data: recentExpenses } = useExpenses(event.id);
  const participants = event.participants ?? [];
  const participantsById = Object.fromEntries(participants.map((p) => [p.id, p]));
  const remembered = !isEdit ? getRememberedSplit(event.id) : null;

  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(event.currency);
  const [convertingCurrency, setConvertingCurrency] = useState(false);
  const [category, setCategory] = useState('other');
  const [date, setDate] = useState(today());
  const [payerIds, setPayerIds] = useState([]);
  const [splitType, setSplitType] = useState('equal');
  const [includedIds, setIncludedIds] = useState([]);
  const [useCustomPayerAmounts, setUseCustomPayerAmounts] = useState(false);
  const [customPayerAmounts, setCustomPayerAmounts] = useState({});
  const [receiptFile, setReceiptFile] = useState(null);

  const [amountError, setAmountError] = useState(null);
  const [descriptionError, setDescriptionError] = useState(null);
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  const fileInputRef = useRef(null);

  // Load draft / remembered defaults / edit values whenever the modal opens
  useEffect(() => {
    if (!open) return;

    if (isEdit) {
      setDescription(expense.description);
      setAmount(String(expense.amount));
      setCurrency(expense.currency ?? event.currency);
      setCategory(expense.category ?? 'other');
      setDate(expense.date ?? today());
      const payers = (expense.paid_by ?? []).map((p) => p.participant_id);
      setPayerIds(payers);
      setSplitType(expense.split_type ?? 'equal');
      setIncludedIds((expense.split_between ?? []).map((s) => s.participant_id));

      const amounts = expense.paid_by ?? [];
      const isUneven = amounts.length > 1 && amounts.some((p) => Math.abs(p.amount - amounts[0].amount) > 0.01);
      setUseCustomPayerAmounts(isUneven);
      setCustomPayerAmounts(Object.fromEntries(amounts.map((p) => [p.participant_id, String(p.amount)])));
      return;
    }

    setDescription('');
    setAmount('');
    setCurrency(event.currency);
    setCategory(remembered?.category ?? 'other');
    setDate(today());
    setSplitType(remembered?.splitType ?? 'equal');
    setPayerIds(
      remembered?.payerIds?.filter((id) => participants.some((p) => p.id === id)) ?? (participants[0] ? [participants[0].id] : [])
    );
    setIncludedIds(
      remembered?.includedIds?.filter((id) => participants.some((p) => p.id === id)) ?? participants.map((p) => p.id)
    );
    setUseCustomPayerAmounts(false);
    setCustomPayerAmounts({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Check for duplicates (new expenses only)
  useEffect(() => {
    if (!open || isEdit || !amount || !description) {
      setDuplicateWarning(null);
      return;
    }
    const duplicate = detectDuplicate({ amount: Number(amount), description }, recentExpenses ?? []);
    setDuplicateWarning(duplicate ?? null);
  }, [open, isEdit, amount, description]);

  const reset = () => {
    setDescription('');
    setAmount('');
    setDate(today());
    setReceiptFile(null);
    setAmountError(null);
    setDescriptionError(null);
    setDuplicateWarning(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const togglePayer = (id) =>
    setPayerIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleIncluded = (id) =>
    setIncludedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleCurrencyChange = async (newCurrency) => {
    if (newCurrency === currency) return;
    const numAmount = Number(amount);
    if (numAmount > 0) {
      setConvertingCurrency(true);
      try {
        const rates = await fetchExchangeRates(currency);
        const rate = rates.rates[newCurrency];
        if (rate) {
          setAmount(String(Math.round(numAmount * rate)));
        }
      } catch {
        toast.error(lang === 'he' ? 'לא ניתן היה לקבל שער חליפין עדכני' : 'Could not fetch a live exchange rate');
      } finally {
        setConvertingCurrency(false);
      }
    }
    setCurrency(newCurrency);
  };

  const handleReceiptChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReceiptFile(file);
  };

  const handleAmountChange = (value) => {
    setAmount(value);
    const validation = validateAmount(value);
    setAmountError(validation.valid ? null : validation.error);
  };

  const handleDescriptionChange = (value) => {
    setDescription(value);
    const validation = validateDescription(value);
    setDescriptionError(validation.valid ? null : validation.error);
  };

  const customPayerSum = round2(payerIds.reduce((sum, id) => sum + (Number(customPayerAmounts[id]) || 0), 0));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const numAmount = Number(amount);

    const amountValidation = validateAmount(amount);
    if (!amountValidation.valid) {
      setAmountError(amountValidation.error);
      return;
    }
    const descValidation = validateDescription(description);
    if (!descValidation.valid) {
      setDescriptionError(descValidation.error);
      return;
    }
    if (payerIds.length === 0) return toast.error(lang === 'he' ? 'בחרו מי שילם' : 'Choose who paid');
    if (includedIds.length === 0) return toast.error(lang === 'he' ? 'בחרו בין מי מתחלקים' : 'Choose who to split between');

    let paidBy;
    if (useCustomPayerAmounts && payerIds.length > 1) {
      if (Math.abs(customPayerSum - numAmount) > 0.01) {
        toast.error(
          lang === 'he'
            ? `הסכומים לא מסתכמים לסה״כ (${customPayerSum} מתוך ${numAmount})`
            : `Amounts don't add up to the total (${customPayerSum} of ${numAmount})`
        );
        return;
      }
      paidBy = payerIds.map((id) => ({ participant_id: id, amount: round2(Number(customPayerAmounts[id]) || 0) }));
    } else {
      const perPayer = round2(numAmount / payerIds.length);
      paidBy = payerIds.map((id, idx) => ({
        participant_id: id,
        amount: idx === payerIds.length - 1 ? round2(numAmount - perPayer * (payerIds.length - 1)) : perPayer,
      }));
    }

    const splitBetween = computeSplitBetween(
      numAmount,
      splitType,
      includedIds.map((id) => ({ participant_id: id, percentage: round2(100 / includedIds.length) }))
    );

    const expensePayload = {
      description,
      amount: numAmount,
      currency,
      category,
      paid_by: paidBy,
      split_type: splitType,
      split_between: splitBetween,
      date,
    };

    if (isEdit) {
      try {
        let receiptUrl = expense.receipt_url ?? null;
        if (receiptFile) {
          receiptUrl = await uploadReceipt(event.id, receiptFile);
        }
        await updateExpense.mutateAsync({ expenseId: expense.id, patch: { ...expensePayload, receipt_url: receiptUrl } });
        toast.success(lang === 'he' ? 'ההוצאה עודכנה' : 'Expense updated');
        setOpen(false);
      } catch (err) {
        toast.error(err.message);
      }
      return;
    }

    if (!navigator.onLine) {
      await enqueueExpense({ ...expensePayload, event_id: event.id, created_by: userId });
      rememberSplit(event.id, { payerIds, splitType, includedIds, category });
      toast.success(lang === 'he' ? 'אין חיבור — ההוצאה תסונכרן אוטומטית כשיחזור' : 'Offline — this will sync automatically once you reconnect');
      reset();
      setOpen(false);
      return;
    }

    try {
      let receiptUrl = null;
      if (receiptFile) {
        receiptUrl = await uploadReceipt(event.id, receiptFile);
      }

      await createExpense.mutateAsync({ ...expensePayload, event_id: event.id, created_by: userId, receipt_url: receiptUrl });

      rememberSplit(event.id, { payerIds, splitType, includedIds, category });

      notifyEventMembers({
        event,
        excludeUserId: userId,
        type: 'expense',
        title: lang === 'he' ? `הוצאה חדשה ב${event.title}` : `New expense in ${event.title}`,
        body: `${description} · ${numAmount.toLocaleString(lang === 'he' ? 'he-IL' : 'en-US', { style: 'currency', currency })}`,
      });

      toast.success(lang === 'he' ? 'ההוצאה נוספה' : 'Expense added');
      reset();
      setOpen(false);
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? (lang === 'he' ? 'עריכת הוצאה' : 'Edit expense') : t('action_add_expense')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {duplicateWarning && (
            <Alert className="border-amber-200 bg-amber-50">
              <Zap className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-sm text-amber-800">
                {lang === 'he'
                  ? `⚠️ הוצאה דומה (${duplicateWarning.description}) הוזנה לפני זמן קצר. כפול?`
                  : `⚠️ Similar expense (${duplicateWarning.description}) was added recently. Duplicate?`}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-1.5">
            <Label>{lang === 'he' ? 'קבלה (לא חובה)' : 'Receipt (optional)'}</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleReceiptChange}
              className="text-sm text-muted-foreground file:me-3 file:rounded-full file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm"
            />
            {receiptFile && (
              <p className="text-xs text-muted-foreground">
                {lang === 'he' ? `נבחר: ${receiptFile.name}` : `Selected: ${receiptFile.name}`}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{lang === 'he' ? 'תיאור *' : 'Description *'}</Label>
            <Input
              required
              value={description}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              className={descriptionError ? 'border-destructive' : ''}
            />
            {descriptionError && <p className="text-xs text-destructive">{descriptionError}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="flex flex-col gap-1.5">
              <Label>{lang === 'he' ? 'סכום *' : 'Amount *'}</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                className={amountError ? 'border-destructive' : ''}
                disabled={convertingCurrency}
              />
              {amountError && <p className="text-xs text-destructive">{amountError}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{lang === 'he' ? 'מטבע' : 'Currency'}</Label>
              <Select value={currency} onValueChange={handleCurrencyChange} disabled={convertingCurrency}>
                <SelectTrigger>
                  {convertingCurrency ? <Loader2 className="h-4 w-4 animate-spin" /> : <SelectValue />}
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{lang === 'he' ? 'תאריך' : 'Date'}</Label>
              <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{lang === 'he' ? 'קטגוריה' : 'Category'}</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORIES).map(([key, cat]) => (
                    <SelectItem key={key} value={key}>
                      {cat.emoji} {cat.label[lang]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label>{lang === 'he' ? 'מי שילם *' : 'Paid by *'}</Label>
              {remembered && <span className="text-xs text-muted-foreground">{lang === 'he' ? 'מולא לפי הפעם הקודמת' : 'Pre-filled from last time'}</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              {participants.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => togglePayer(p.id)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-sm transition-colors',
                    payerIds.includes(p.id) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'
                  )}
                >
                  {p.name}
                </button>
              ))}
            </div>

            {payerIds.length > 1 && (
              <button
                type="button"
                onClick={() => setUseCustomPayerAmounts((v) => !v)}
                className="self-start text-xs text-primary underline hover:no-underline"
              >
                {useCustomPayerAmounts
                  ? lang === 'he' ? 'חלוקה שווה בין המשלמים' : 'Split equally between payers'
                  : lang === 'he' ? 'כל אחד שילם סכום שונה?' : 'Each paid a different amount?'}
              </button>
            )}

            {useCustomPayerAmounts && payerIds.length > 1 && (
              <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
                {payerIds.map((id) => (
                  <div key={id} className="flex items-center justify-between gap-2">
                    <span className="text-sm text-foreground">{participantsById[id]?.name}</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-28"
                      value={customPayerAmounts[id] ?? ''}
                      onChange={(e) => setCustomPayerAmounts((prev) => ({ ...prev, [id]: e.target.value }))}
                    />
                  </div>
                ))}
                <p className={cn('text-xs', Math.abs(customPayerSum - (Number(amount) || 0)) > 0.01 ? 'text-destructive' : 'text-muted-foreground')}>
                  {lang === 'he' ? `הוזן ${customPayerSum} מתוך ${amount || 0}` : `Entered ${customPayerSum} of ${amount || 0}`}
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{lang === 'he' ? 'איך מתחלק' : 'Split type'}</Label>
            <Select value={splitType} onValueChange={setSplitType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equal">{lang === 'he' ? 'שווה בשווה' : 'Equal'}</SelectItem>
                <SelectItem value="percentage">{lang === 'he' ? 'אחוזים שווים' : 'Equal percentage'}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{lang === 'he' ? 'בין מי מתחלקים *' : 'Split between *'}</Label>
            <div className="flex flex-wrap gap-2">
              {participants.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => toggleIncluded(p.id)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-sm transition-colors',
                    includedIds.includes(p.id) ? 'border-secondary bg-secondary/10 text-secondary' : 'border-border text-muted-foreground'
                  )}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={createExpense.isPending || updateExpense.isPending}>
              {isEdit && <Edit2 className="h-4 w-4" />}
              {isEdit ? (lang === 'he' ? 'עדכון הוצאה' : 'Update expense') : t('action_save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
