import { useEffect, useRef, useState } from 'react';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { useLang } from '@/hooks/useLang';

const HOLD_MS = 500;
const MOVE_TOLERANCE = 10;
const HIDE_AFTER_MS = 6000;

function isTruncated(el) {
  if (!(el instanceof HTMLElement) || !el.clientWidth) return false;
  if (!el.textContent?.trim()) return false;
  const cs = getComputedStyle(el);
  const clips =
    cs.textOverflow === 'ellipsis' ||
    cs.overflow === 'hidden' ||
    cs.overflowX === 'hidden' ||
    (cs.webkitLineClamp && cs.webkitLineClamp !== 'none');
  if (!clips) return false;
  return el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
}

function findTruncated(target) {
  if (!(target instanceof Element)) return null;
  if (target.closest('input, textarea, select, [contenteditable="true"]')) return null;

  // The pressed element and its ancestors.
  for (let el = target, depth = 0; el && el !== document.body && depth < 6; el = el.parentElement, depth++) {
    if (isTruncated(el)) return el;
  }
  // Text inside the pressed button/link/card (e.g. pressing on an icon next to the label).
  const container = target.closest('button, a, [role="button"], label, li');
  if (container) {
    for (const el of container.querySelectorAll('*')) {
      if (isTruncated(el)) return el;
    }
  }
  return null;
}

/**
 * Global: a long press on any text that is cut off (ellipsis / clamped)
 * shows its full text in a small bubble.
 */
export function LongPressReveal() {
  const { lang } = useLang();
  const [bubble, setBubble] = useState(null);
  const state = useRef({ timer: null, x: 0, y: 0, suppressClickUntil: 0 });

  useEffect(() => {
    const s = state.current;
    const cancel = () => {
      clearTimeout(s.timer);
      s.timer = null;
    };

    const onPointerDown = (e) => {
      if (e.button !== 0) return;
      if (e.target instanceof Element && e.target.closest('[data-long-press-bubble]')) return;
      setBubble(null);
      cancel();
      s.x = e.clientX;
      s.y = e.clientY;
      const target = e.target;
      s.timer = setTimeout(() => {
        s.timer = null;
        const el = findTruncated(target);
        if (!el) return;
        const text = el.innerText.trim() || el.textContent.trim();
        const rect = el.getBoundingClientRect();
        s.suppressClickUntil = Date.now() + 800;
        navigator.vibrate?.(15);
        setBubble({ text, rect });
      }, HOLD_MS);
    };

    const onPointerMove = (e) => {
      if (!s.timer) return;
      if (Math.abs(e.clientX - s.x) > MOVE_TOLERANCE || Math.abs(e.clientY - s.y) > MOVE_TOLERANCE) cancel();
    };

    // Swallow the click that ends a long press, so the button doesn't also fire.
    const onClick = (e) => {
      if (Date.now() < s.suppressClickUntil) {
        e.preventDefault();
        e.stopPropagation();
        s.suppressClickUntil = 0;
      }
    };

    // Stop the browser's own long-press menu when we're revealing text.
    const onContextMenu = (e) => {
      if (Date.now() < s.suppressClickUntil || findTruncated(e.target)) e.preventDefault();
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('pointerup', cancel, true);
    document.addEventListener('pointercancel', cancel, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('contextmenu', onContextMenu, true);
    window.addEventListener('scroll', cancel, true);
    return () => {
      cancel();
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('pointermove', onPointerMove, true);
      document.removeEventListener('pointerup', cancel, true);
      document.removeEventListener('pointercancel', cancel, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('contextmenu', onContextMenu, true);
      window.removeEventListener('scroll', cancel, true);
    };
  }, []);

  useEffect(() => {
    if (!bubble) return;
    const t = setTimeout(() => setBubble(null), HIDE_AFTER_MS);
    const hide = () => setBubble(null);
    window.addEventListener('scroll', hide, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener('scroll', hide, true);
    };
  }, [bubble]);

  if (!bubble) return null;

  const { rect, text } = bubble;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    toast.success(lang === 'he' ? 'הטקסט הועתק' : 'Text copied');
    setBubble(null);
  };
  const above = rect.top > 80;
  const style = {
    position: 'fixed',
    left: 16,
    right: 16,
    zIndex: 100,
    display: 'flex',
    justifyContent: 'center',
    pointerEvents: 'none',
    ...(above ? { bottom: window.innerHeight - rect.top + 8 } : { top: rect.bottom + 8 }),
  };

  return (
    <div style={style} role="tooltip" aria-live="polite">
      <div
        data-long-press-bubble
        className="pointer-events-auto flex max-w-full items-center gap-2 rounded-xl bg-foreground py-1.5 pe-1.5 ps-3 text-sm text-background shadow-lg"
      >
        <span className="min-w-0 select-text break-words">{text}</span>
        <button
          type="button"
          onClick={copy}
          className="flex shrink-0 items-center gap-1 rounded-lg bg-background/15 px-2 py-1.5 text-xs font-medium hover:bg-background/25"
        >
          <Copy className="h-3.5 w-3.5" />
          {lang === 'he' ? 'העתקה' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
