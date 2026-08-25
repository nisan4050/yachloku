import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Upload, Play, FolderDown, FileText } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useLang } from '@/hooks/useLang';
import { useUpdateEvent } from '@/hooks/useEvents';
import { useExpenses } from '@/hooks/useExpenses';
import { usePendingDeletes } from '@/hooks/usePendingDeletes';
import { uploadWithProgress } from '@/lib/storageUpload';
import { buildStoragePath, formatBytes } from '@/lib/utils';
import { formatDate } from '@/lib/dateUtils';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { CircularProgress } from '@/components/ui/circular-progress';
import { MediaLightbox } from '@/components/events/MediaLightbox';

export function PhotosGallery({ event }) {
  const { user } = useAuth();
  const { lang } = useLang();
  const updateEvent = useUpdateEvent(event.id);
  const { data: expenses } = useExpenses(event.id);
  const { pendingIds, scheduleDelete } = usePendingDeletes();
  const inputRef = useRef(null);

  const [uploading, setUploading] = useState([]); // [{ id, name, progress }]
  const [lightboxIndex, setLightboxIndex] = useState(null);

  const participantsById = Object.fromEntries(event.participants.map((p) => [p.id, p]));
  const me = event.participants.find((p) => p.user_id === user.id);

  const photos = useMemo(
    () => (event.photos ?? []).filter((p) => !pendingIds.has(p.id)).sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at)),
    [event.photos, pendingIds]
  );

  const receipts = (expenses ?? []).filter((e) => e.receipt_url);

  const totalSize = photos.reduce((sum, p) => sum + (p.size ?? 0), 0);

  const persistPhotos = async (nextPhotos) => {
    await updateEvent.mutateAsync({ photos: nextPhotos });
  };

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0 || !me) return;
    e.target.value = '';

    const uploadEntries = files.map((file) => ({ id: crypto.randomUUID(), file, name: file.name, progress: 0 }));
    setUploading((prev) => [...prev, ...uploadEntries]);

    for (const entry of uploadEntries) {
      try {
        const path = buildStoragePath(event.id, entry.file);
        const url = await uploadWithProgress('event-photos', path, entry.file, (percent) => {
          setUploading((prev) => prev.map((u) => (u.id === entry.id ? { ...u, progress: percent } : u)));
        });

        const type = entry.file.type.startsWith('video/')
          ? 'video'
          : entry.file.type.startsWith('image/')
            ? 'image'
            : 'file';
        const meta = {
          id: crypto.randomUUID(),
          url,
          type,
          name: entry.file.name,
          size: entry.file.size,
          uploaded_by_participant_id: me.id,
          uploaded_at: new Date().toISOString(),
        };

        await persistPhotos([...(event.photos ?? []), meta]);
      } catch (err) {
        toast.error(`${entry.name}: ${err.message}`);
      } finally {
        setUploading((prev) => prev.filter((u) => u.id !== entry.id));
      }
    }
  };

  const handleDownload = async (item) => {
    const res = await fetch(item.url);
    const blob = await res.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = item.name ?? 'file';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleDownloadAll = async () => {
    if (photos.length === 0) return;
    toast.info(lang === 'he' ? 'מכין קובץ ZIP...' : 'Preparing ZIP file...');
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    await Promise.all(
      photos.map(async (item, i) => {
        const res = await fetch(item.url);
        const blob = await res.blob();
        zip.file(item.name || `file-${i + 1}`, blob);
      })
    );

    const content = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `${event.title}-media.zip`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleDelete = async (item) => {
    scheduleDelete(
      item.id,
      async () => {
        const remaining = (event.photos ?? []).filter((p) => p.id !== item.id);
        try {
          await persistPhotos(remaining);
        } catch (err) {
          toast.error(err.message);
        }
      },
      {
        label: lang === 'he' ? 'הקובץ נמחק' : 'File deleted',
        undoLabel: lang === 'he' ? 'ביטול' : 'Undo',
        undoneLabel: lang === 'he' ? 'המחיקה בוטלה' : 'Delete undone',
      }
    );
    setLightboxIndex(null);
  };

  const canManage = (item) => item.uploaded_by_participant_id === me?.id || event.manager_user_id === user.id;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {photos.length > 0 &&
            `${photos.length} ${lang === 'he' ? 'קבצים' : 'files'} · ${formatBytes(totalSize)}`}
        </p>
        <div className="flex gap-2">
          {photos.length > 0 && (
            <Button variant="outline" onClick={handleDownloadAll}>
              <FolderDown className="h-4 w-4" />
              {lang === 'he' ? 'הורדת הכל' : 'Download all'}
            </Button>
          )}
          <input ref={inputRef} type="file" multiple hidden onChange={handleUpload} />
          <Button onClick={() => inputRef.current?.click()}>
            <Upload className="h-4 w-4" />
            {lang === 'he' ? 'העלאת קבצים' : 'Upload files'}
          </Button>
        </div>
      </div>

      {uploading.length > 0 && (
        <div className="flex flex-wrap gap-3 rounded-2xl border border-dashed border-border bg-muted/30 p-4">
          {uploading.map((u) => (
            <div key={u.id} className="flex flex-col items-center gap-1.5">
              <CircularProgress value={u.progress} size={52} />
              <span className="max-w-[80px] truncate text-[10px] text-muted-foreground">{u.name}</span>
            </div>
          ))}
        </div>
      )}

      {photos.length === 0 && uploading.length === 0 ? (
        <EmptyState icon="📷" title={lang === 'he' ? 'עדיין אין תמונות או סרטונים' : 'No photos or videos yet'} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((item, i) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setLightboxIndex(i)}
              className="group relative block aspect-square overflow-hidden rounded-2xl bg-muted text-start"
            >
              {item.type === 'video' ? (
                <>
                  <video src={item.url} className="h-full w-full object-cover" muted />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <Play className="h-8 w-8 fill-white text-white" />
                  </div>
                </>
              ) : item.type === 'file' ? (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-muted p-2">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                  <span className="w-full truncate text-center text-[10px] text-muted-foreground">{item.name}</span>
                </div>
              ) : (
                <img src={item.url} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                <p className="truncate font-medium">{participantsById[item.uploaded_by_participant_id]?.name}</p>
                <p className="opacity-80">{formatDate(item.uploaded_at, lang)}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {receipts.length > 0 && (
        <div>
          <h3 className="mb-2 font-semibold text-foreground">{lang === 'he' ? 'קבלות שנסרקו' : 'Scanned receipts'}</h3>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6">
            {receipts.map((exp) => (
              <a
                key={exp.id}
                href={exp.receipt_url}
                target="_blank"
                rel="noreferrer"
                className="block aspect-square overflow-hidden rounded-xl border border-border"
                title={exp.description}
              >
                <img src={exp.receipt_url} alt={exp.description} className="h-full w-full object-cover" />
              </a>
            ))}
          </div>
        </div>
      )}

      {lightboxIndex !== null && photos[lightboxIndex] && (
        <MediaLightbox
          items={photos}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onDownload={handleDownload}
          onDelete={handleDelete}
          participantsById={participantsById}
          canManage={canManage(photos[lightboxIndex])}
        />
      )}
    </div>
  );
}
