import { forwardRef, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * Chat message textbox that grows with the text — starts at one line, grows
 * up to ~2 lines, then scrolls internally instead of growing further. Plain
 * Enter submits (matches the old single-line <Input> behavior); Shift+Enter
 * inserts a newline.
 */
export const ChatMessageInput = forwardRef(({ value, onChange, onSubmit, className, ...props }, ref) => {
  const innerRef = useRef(null);

  const setRefs = (node) => {
    innerRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  };

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={setRefs}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          onSubmit();
        }
      }}
      rows={1}
      className={cn(
        'flex max-h-[4.5rem] min-h-11 w-full resize-none overflow-y-auto rounded-xl border border-input bg-background px-4 py-2.5 text-sm leading-normal shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
});
ChatMessageInput.displayName = 'ChatMessageInput';
