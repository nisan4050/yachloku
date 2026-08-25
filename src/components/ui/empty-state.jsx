export function EmptyState({ icon, title, subtitle, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-border bg-muted/40 px-6 py-16 text-center">
      {icon && <div className="text-5xl">{icon}</div>}
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {subtitle && <p className="max-w-xs text-sm text-muted-foreground">{subtitle}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
