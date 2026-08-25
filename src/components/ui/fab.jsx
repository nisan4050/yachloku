import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export const Fab = forwardRef(({ className, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    className={cn(
      'fixed bottom-24 end-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 sm:end-8',
      className
    )}
    {...props}
  />
));
Fab.displayName = 'Fab';
