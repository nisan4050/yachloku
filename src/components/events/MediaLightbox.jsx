import { useEffect } from 'react';
import { ChevronLeft, ChevronRight, Download, FileText, Trash2, X } from 'lucide-react';
import { useLang } from '@/hooks/useLang';
import { formatDateTime } from '@/lib/dateUtils';
import { formatBytes } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function MediaLightbox({ items, index, onIndexChange, onClose, onDownload, onDelete, participantsById, canManage }) {
  const item = items[index];
  const { lang, dir } = useLang();
  const uploader = participantsById[item.uploaded_by_participant_id]?.name;

  const goNext = () => onIndexChange((index + 1) % items.length);
  const goPrev = () => onIndexChange((index - 1 + items.length) % items.length);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === (dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight')) goNext();
      if (e.key === (dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft')) goPrev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95" onClick={onClose}>
      <div className="flex items-center justify-between p-4 text-white" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0 text-sm">
          <p className="truncate font-medium">{uploader ?? '—'}</p>
          <p className="text-xs text-white/60">
            {formatDateTime(item.uploaded_at, lang)}
            {item.size ? ` · ${formatBytes(item.size)}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => onDownload(item)}>
            <Download className="h-5 w-5" />
          </Button>
          {canManage && (
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => onDelete(item)}>
              <Trash2 className="h-5 w-5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4 pb-4" onClick={(e) => e.stopPropagation()}>
        {items.length > 1 && (
          <button
            type="button"
            onClick={goPrev}
            className="absolute start-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        {item.type === 'video' ? (
          <video src={item.url} controls autoPlay className="max-h-full max-w-full rounded-xl" />
        ) : item.type === 'file' ? (
          <div className="flex flex-col items-center gap-4 rounded-xl bg-white/5 p-10 text-white">
            <FileText className="h-16 w-16" />
            <p className="max-w-xs truncate text-center font-medium">{item.name}</p>
            <Button variant="secondary" onClick={() => onDownload(item)}>
              <Download className="h-4 w-4" />
              {lang === 'he' ? 'הורדה' : 'Download'}
            </Button>
          </div>
        ) : (
          <img src={item.url} alt="" className="max-h-full max-w-full rounded-xl object-contain" />
        )}

        {items.length > 1 && (
          <button
            type="button"
            onClick={goNext}
            className="absolute end-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>

      {items.length > 1 && (
        <p className="pb-3 text-center text-xs text-white/50">
          {index + 1} / {items.length}
        </p>
      )}
    </div>
  );
}
