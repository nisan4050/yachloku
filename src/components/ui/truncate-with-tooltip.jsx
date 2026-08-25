import { useState } from 'react';
import { cn } from '@/lib/utils';

export function TruncateWithTooltip({ children, maxLength = 30, className, ...props }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const text = String(children);
  const isTruncated = text.length > maxLength;
  const truncated = isTruncated ? text.slice(0, maxLength) + '…' : text;

  if (!isTruncated) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span
      className={cn('relative inline-block cursor-help border-b border-dotted border-muted-foreground/30', className)}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      {...props}
    >
      {truncated}
      {showTooltip && (
        <div className="absolute bottom-full left-0 mb-2 rounded-lg bg-foreground px-2 py-1 text-xs text-background whitespace-nowrap z-50">
          {text}
        </div>
      )}
    </span>
  );
}
