import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  Send,
  MoreVertical,
  Edit2,
  Trash2,
  SmilePlus,
  Search,
  X,
  Paperclip,
  Download,
  Loader2,
  Copy,
  Pin,
  MapPin,
  Play,
} from 'lucide-react';
import { toast } from 'sonner';
import { Geolocation } from '@capacitor/geolocation';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useLang } from '@/hooks/useLang';
import { formatChatTimestamp } from '@/lib/dateUtils';
import { formatBytes, buildStoragePath } from '@/lib/utils';
import { uploadWithProgress } from '@/lib/storageUpload';
import { isImageUrl, isVideoUrl } from '@/api/chat';
import { MediaLightbox } from '@/components/events/MediaLightbox';
import { notifyEventMembers } from '@/api/notifications';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😢', '🔥', '👏'];

/** Renders message text as safe React nodes: **bold**, *italic*, `code`. */
function renderMessageContent(text) {
  const tokenPattern = /(\*\*[^*]+?\*\*)|(`[^`]+?`)|(\*[^*]+?\*)/g;
  const nodes = [];
  let lastIndex = 0;
  let key = 0;
  let match;

  while ((match = tokenPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(<span key={key++}>{text.slice(lastIndex, match.index)}</span>);
    }
    const token = match[0];
    if (token.startsWith('**')) {
      nodes.push(<b key={key++}>{token.slice(2, -2)}</b>);
    } else if (token.startsWith('`')) {
      nodes.push(
        <code key={key++} className="rounded bg-black/10 px-1 text-xs dark:bg-white/10">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('*')) {
      nodes.push(<i key={key++}>{token.slice(1, -1)}</i>);
    }
    lastIndex = tokenPattern.lastIndex;
  }
  if (lastIndex < text.length) {
    nodes.push(<span key={key++}>{text.slice(lastIndex)}</span>);
  }
  return nodes;
}

export function PrivateChatThread({ event, otherParticipant, onBack, scrollToMessageId }) {
  const { user } = useAuth();
  const { lang, dir } = useLang();
  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [typing, setTyping] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [sending, setSending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [lightboxMessage, setLightboxMessage] = useState(null);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const pressTimerRef = useRef(null);
  const pressMovedRef = useRef(false);

  const me = event.participants.find((p) => p.user_id === user.id);

  useEffect(() => {
    if (!me) return;
    let active = true;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('event_id', event.id)
        .or(
          `and(from_participant_id.eq.${me.id},to_participant_id.eq.${otherParticipant.id}),and(from_participant_id.eq.${otherParticipant.id},to_participant_id.eq.${me.id})`
        )
        .order('created_at', { ascending: true });

      if (active) {
        setMessages(data ?? []);
        setLoading(false);
      }

      await supabase
        .from('chat_messages')
        .update({ read: true })
        .eq('event_id', event.id)
        .eq('from_participant_id', otherParticipant.id)
        .eq('to_user_id', user.id)
        .eq('read', false);
    };

    fetchMessages();

    const channel = supabase
      .channel(`chat-${event.id}-${[me.id, otherParticipant.id].sort().join('-')}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `event_id=eq.${event.id}` },
        (payload) => {
          const m = payload.new;
          const involvesPair =
            (m.from_participant_id === me.id && m.to_participant_id === otherParticipant.id) ||
            (m.from_participant_id === otherParticipant.id && m.to_participant_id === me.id);
          if (!involvesPair) return;
          setMessages((prev) => [...prev, m]);
          if (m.to_user_id === user.id) {
            supabase.from('chat_messages').update({ read: true }).eq('id', m.id);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: `event_id=eq.${event.id}` },
        (payload) => setMessages((prev) => prev.map((m) => (m.id === payload.new.id ? payload.new : m)))
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id, me?.id, otherParticipant.id, user.id]);

  useEffect(() => {
    if (scrollToMessageId) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    if (!scrollToMessageId || !messages.some((m) => m.id === scrollToMessageId)) return;
    setTimeout(() => {
      document.getElementById(`dm-${scrollToMessageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  useEffect(() => {
    const channel = supabase
      .channel(`typing-dm-${event.id}-${[me?.id, otherParticipant.id].sort().join('-')}`)
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload.user_id === user.id) return;
        setTyping(payload.payload.is_typing);
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id, me?.id, otherParticipant.id, user.id]);

  const handleTyping = (value) => {
    setText(value);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    const channel = supabase.channel(`typing-dm-${event.id}-${[me.id, otherParticipant.id].sort().join('-')}`);
    channel.send({ type: 'broadcast', event: 'typing', payload: { user_id: user.id, is_typing: true } });
    typingTimeoutRef.current = setTimeout(() => {
      channel.send({ type: 'broadcast', event: 'typing', payload: { user_id: user.id, is_typing: false } });
    }, 3000);
  };

  const describeMessage = (m) => {
    if (!m) return lang === 'he' ? 'הודעה שנמחקה' : 'deleted message';
    if (m.content) return m.content;
    if (m.media_url) return `📎 ${m.media_meta?.name || (lang === 'he' ? 'קובץ מצורף' : 'attachment')}`;
    if (m.location) return `📍 ${lang === 'he' ? 'מיקום' : 'Location'}`;
    return lang === 'he' ? 'הודעה שנמחקה' : 'deleted message';
  };

  const scrollToMessage = (id) => {
    document.getElementById(`dm-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!me) return;
    const rawContent = text.trim();

    if (editingId) {
      if (!rawContent) return;
      setText('');
      const { error } = await supabase
        .from('chat_messages')
        .update({ content: rawContent, edited_at: new Date().toISOString() })
        .eq('id', editingId);
      if (error) toast.error(lang === 'he' ? 'עריכת ההודעה נכשלה' : 'Failed to edit message');
      setEditingId(null);
      return;
    }

    if (!rawContent && !pendingAttachment) return;

    const payload = {
      event_id: event.id,
      from_participant_id: me.id,
      to_participant_id: otherParticipant.id,
      from_user_id: user.id,
      to_user_id: otherParticipant.user_id,
      content: rawContent || null,
      reply_to_id: replyingTo?.id || null,
    };

    setSending(true);
    setUploadProgress(0);
    try {
      if (pendingAttachment?.kind === 'file') {
        const path = buildStoragePath(event.id, pendingAttachment.file);
        const url = await uploadWithProgress('chat-media', path, pendingAttachment.file, setUploadProgress);
        payload.media_url = url;
        payload.media_meta = {
          name: pendingAttachment.file.name,
          type: pendingAttachment.file.type,
          size: pendingAttachment.file.size,
        };
      } else if (pendingAttachment?.kind === 'location') {
        payload.location = { lat: pendingAttachment.lat, lng: pendingAttachment.lng };
      }

      const { data: inserted, error } = await supabase.from('chat_messages').insert(payload).select().single();
      if (error) throw error;

      notifyEventMembers({
        event: { ...event, participants: event.participants.filter((p) => p.id === otherParticipant.id) },
        excludeUserId: user.id,
        type: 'chat',
        title: `${me.name} · ${lang === 'he' ? 'הודעה פרטית' : 'Private message'}`,
        body:
          payload.content ||
          (pendingAttachment?.kind === 'location'
            ? `📍 ${lang === 'he' ? 'מיקום' : 'Location'}`
            : pendingAttachment
              ? `📎 ${pendingAttachment.file.name}`
              : ''),
        data: { tab: 'private-chat', with: me.id, msg: inserted.id },
      });

      setText('');
      setPendingAttachment(null);
      setReplyingTo(null);
    } catch (err) {
      toast.error(lang === 'he' ? 'השליחה נכשלה' : 'Failed to send');
      console.error(err);
    } finally {
      setSending(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (messageId) => {
    const { error } = await supabase
      .from('chat_messages')
      .update({ deleted_at: new Date().toISOString(), content: null, media_url: null, media_meta: null, location: null })
      .eq('id', messageId);
    if (error) toast.error(lang === 'he' ? 'מחיקת ההודעה נכשלה' : 'Failed to delete message');
    setMenuOpenId(null);
  };

  const handleCopy = (message) => {
    const value = message.content
      ? message.content
      : message.location
        ? `https://www.google.com/maps?q=${message.location.lat},${message.location.lng}`
        : (message.media_url ?? '');
    if (value) {
      navigator.clipboard.writeText(value);
      toast.success(lang === 'he' ? 'הועתק' : 'Copied');
    }
    setMenuOpenId(null);
  };

  const handlePin = async (message) => {
    const { error } = await supabase
      .from('chat_messages')
      .update({ pinned_at: message.pinned_at ? null : new Date().toISOString() })
      .eq('id', message.id);
    if (error) toast.error(lang === 'he' ? 'הפעולה נכשלה' : 'Action failed');
    setMenuOpenId(null);
  };

  const handleShareLocation = async () => {
    try {
      const current = await Geolocation.checkPermissions();
      let status = current.location;
      if (status === 'prompt' || status === 'prompt-with-rationale') {
        status = (await Geolocation.requestPermissions()).location;
      }
      if (status !== 'granted') {
        toast.error(lang === 'he' ? 'צריך הרשאת מיקום כדי לשתף' : 'Location permission is needed to share');
        return;
      }
      toast.info(lang === 'he' ? 'מאתר מיקום...' : 'Getting your location...');
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
      setPendingAttachment({ kind: 'location', lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      toast.error(lang === 'he' ? 'לא ניתן לקבל את המיקום' : 'Could not get your location');
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (file.size > 15 * 1024 * 1024) {
      toast.error(lang === 'he' ? 'הקובץ גדול מדי (מקסימום 15MB)' : 'File too large (max 15MB)');
      return;
    }
    setPendingAttachment({ kind: 'file', file });
  };

  const handleEdit = (message) => {
    setEditingId(message.id);
    setReplyingTo(null);
    setText(message.content || '');
    setMenuOpenId(null);
  };

  const handleReaction = async (messageId, emoji) => {
    const message = messages.find((m) => m.id === messageId);
    if (!message) return;
    const reactions = { ...(message.reactions || {}) };
    const current = reactions[emoji] || [];
    const next = current.includes(user.id) ? current.filter((id) => id !== user.id) : [...current, user.id];
    if (next.length === 0) delete reactions[emoji];
    else reactions[emoji] = next;

    const { error } = await supabase.from('chat_messages').update({ reactions }).eq('id', messageId);
    if (error) {
      console.error(error);
      toast.error(lang === 'he' ? 'הריאקציה נכשלה' : 'Reaction failed');
    }
  };

  const startPress = (id) => {
    pressMovedRef.current = false;
    pressTimerRef.current = setTimeout(() => {
      if (!pressMovedRef.current) setMenuOpenId(id);
    }, 500);
  };
  const cancelPress = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };
  const movePress = () => {
    pressMovedRef.current = true;
    cancelPress();
  };

  const visibleMessages = messages.filter((m) => {
    if (m.deleted_at) return false;
    if (!searchQuery) return true;
    return m.content?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const pinnedMessage = messages
    .filter((m) => m.pinned_at && !m.deleted_at)
    .sort((a, b) => new Date(b.pinned_at) - new Date(a.pinned_at))[0];

  return (
    <div className="flex h-[70vh] max-h-[720px] flex-col rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border p-2">
        <button type="button" onClick={onBack} className="shrink-0 rounded-lg p-2 hover:bg-muted" aria-label={lang === 'he' ? 'חזרה' : 'Back'}>
          <BackIcon className="h-4 w-4" />
        </button>
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback>{otherParticipant.name[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
        {searchOpen ? (
          <div className="flex flex-1 items-center gap-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === 'he' ? 'חיפוש בהודעות...' : 'Search messages...'}
              className="h-8 border-0 px-0 shadow-none focus-visible:ring-0"
            />
            <button
              type="button"
              onClick={() => {
                setSearchOpen(false);
                setSearchQuery('');
              }}
              className="shrink-0 rounded p-1 hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <span className="flex-1 truncate font-semibold text-foreground">{otherParticipant.name}</span>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-muted"
              aria-label={lang === 'he' ? 'חיפוש' : 'Search'}
            >
              <Search className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {pinnedMessage && (
        <button
          type="button"
          onClick={() => scrollToMessage(pinnedMessage.id)}
          className="flex items-center gap-2 border-b border-border bg-primary/5 px-3 py-2 text-start"
        >
          <Pin className="h-3.5 w-3.5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold text-primary">{lang === 'he' ? 'הודעה נעוצה' : 'Pinned message'}</div>
            <div className="truncate text-xs text-muted-foreground">{describeMessage(pinnedMessage)}</div>
          </div>
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              handlePin(pinnedMessage);
            }}
            className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        </button>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {!loading && visibleMessages.length === 0 && (
          <EmptyState
            icon={searchQuery ? '🔍' : '💬'}
            title={
              searchQuery
                ? lang === 'he'
                  ? 'לא נמצאו הודעות תואמות'
                  : 'No matching messages'
                : lang === 'he'
                  ? 'עדיין אין הודעות'
                  : 'No messages yet'
            }
          />
        )}
        <div className="flex flex-col gap-3">
          {visibleMessages.map((m) => {
            if (m.is_system) {
              return (
                <div key={m.id} id={`dm-${m.id}`} className="flex flex-col items-center gap-1 scroll-mt-4">
                  <div className="max-w-[85%] rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-center text-xs text-foreground">
                    <div className="mb-1 whitespace-pre-line font-medium">{m.content}</div>
                    <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
                      <span>{lang === 'he' ? 'הודעת מערכת אוטומטית' : 'Automatic system message'}</span>
                      <span>·</span>
                      <span>{formatChatTimestamp(m.created_at, lang)}</span>
                    </div>
                  </div>
                </div>
              );
            }

            const isMine = m.from_user_id === user.id;
            const repliedMessage = m.reply_to_id ? messages.find((x) => x.id === m.reply_to_id) : null;
            const isImage = m.media_url && isImageUrl(m.media_url, m.media_meta?.type);
            const isVideo = m.media_url && isVideoUrl(m.media_url, m.media_meta?.type);
            const canEditMine = isMine && m.content != null;

            return (
              <div key={m.id} id={`dm-${m.id}`} className={`flex flex-col gap-1 scroll-mt-4 ${isMine ? 'items-end' : 'items-start'}`}>
                <div className={`flex max-w-full items-end gap-1 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div
                    onPointerDown={() => startPress(m.id)}
                    onPointerUp={cancelPress}
                    onPointerLeave={cancelPress}
                    onPointerMove={movePress}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setMenuOpenId(m.id);
                    }}
                    className={`min-w-0 max-w-[min(75vw,22rem)] select-none rounded-2xl px-3.5 py-2 text-sm break-words ${
                      isMine ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                    } ${m.pinned_at ? 'ring-2 ring-primary/40' : ''}`}
                  >
                    {repliedMessage && (
                      <button
                        type="button"
                        onClick={() => scrollToMessage(repliedMessage.id)}
                        className={`mb-2 block w-full rounded-lg border-s-4 px-2 py-1 text-start text-xs ${
                          isMine ? 'border-primary-foreground/50 bg-black/10' : 'border-primary bg-black/5 dark:bg-white/10'
                        }`}
                      >
                        <div className={`font-semibold ${isMine ? 'text-primary-foreground/90' : 'text-primary'}`}>
                          {repliedMessage.from_user_id === user.id ? me.name : otherParticipant.name}
                        </div>
                        <div className="truncate opacity-80">{describeMessage(repliedMessage)}</div>
                      </button>
                    )}

                    {m.media_url &&
                      (isImage ? (
                        <button type="button" onClick={() => setLightboxMessage(m)} className="block w-full">
                          <img
                            src={m.media_url}
                            alt={m.media_meta?.name || 'shared image'}
                            className="max-h-64 w-full rounded-lg object-cover"
                            loading="lazy"
                          />
                        </button>
                      ) : isVideo ? (
                        <button type="button" onClick={() => setLightboxMessage(m)} className="relative block w-full">
                          <video src={m.media_url} className="max-h-64 w-full rounded-lg object-cover" muted />
                          <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/20">
                            <Play className="h-10 w-10 fill-white text-white" />
                          </span>
                        </button>
                      ) : (
                        <a
                          href={m.media_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 rounded-lg bg-black/10 px-3 py-2 dark:bg-white/10"
                        >
                          <Download className="h-4 w-4 shrink-0" />
                          <span className="min-w-0 flex-1 truncate text-xs">{m.media_meta?.name || 'file'}</span>
                          {m.media_meta?.size && <span className="shrink-0 text-[10px] opacity-70">{formatBytes(m.media_meta.size)}</span>}
                        </a>
                      ))}

                    {m.location && (
                      <a
                        href={`https://www.google.com/maps?q=${m.location.lat},${m.location.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-lg bg-black/10 px-3 py-2 dark:bg-white/10"
                      >
                        <MapPin className="h-4 w-4 shrink-0" />
                        <span className="text-xs">{lang === 'he' ? 'מיקום משותף' : 'Shared location'}</span>
                      </a>
                    )}

                    {m.content && <div className={m.media_url || m.location ? 'mt-2' : ''}>{renderMessageContent(m.content)}</div>}
                    {m.edited_at && <span className="ms-1 text-xs opacity-60">({lang === 'he' ? 'נערך' : 'edited'})</span>}
                  </div>

                  <div className="flex shrink-0 items-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="rounded p-1.5 text-muted-foreground hover:bg-muted" aria-label="React">
                          <SmilePlus className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align={isMine ? 'end' : 'start'}>
                        <div className="flex gap-1 p-1">
                          {REACTION_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => handleReaction(m.id, emoji)}
                              className="rounded p-1.5 text-lg transition-transform hover:scale-125"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu open={menuOpenId === m.id} onOpenChange={(v) => setMenuOpenId(v ? m.id : null)}>
                      <DropdownMenuTrigger asChild>
                        <button className="rounded p-1.5 text-muted-foreground hover:bg-muted" aria-label="More">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align={isMine ? 'end' : 'start'}>
                        {(m.content || m.media_url || m.location) && (
                          <DropdownMenuItem onClick={() => handleCopy(m)}>
                            <Copy className="me-2 h-4 w-4" />
                            {lang === 'he' ? 'העתקה' : 'Copy'}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => {
                            setReplyingTo(m);
                            setMenuOpenId(null);
                          }}
                        >
                          {lang === 'he' ? '↩ הגב' : '↩ Reply'}
                        </DropdownMenuItem>
                        {canEditMine && (
                          <DropdownMenuItem onClick={() => handleEdit(m)}>
                            <Edit2 className="me-2 h-4 w-4" />
                            {lang === 'he' ? 'ערוך' : 'Edit'}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handlePin(m)}>
                          <Pin className="me-2 h-4 w-4" />
                          {m.pinned_at ? (lang === 'he' ? 'בטל נעיצה' : 'Unpin') : lang === 'he' ? 'נעיצה' : 'Pin'}
                        </DropdownMenuItem>
                        {isMine && (
                          <DropdownMenuItem onClick={() => handleDelete(m.id)} className="text-destructive">
                            <Trash2 className="me-2 h-4 w-4" />
                            {lang === 'he' ? 'מחק' : 'Delete'}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {m.reactions && Object.keys(m.reactions).length > 0 && (
                  <div className="flex flex-wrap gap-1 px-1">
                    {Object.entries(m.reactions).map(([emoji, userIds]) => (
                      <button
                        key={emoji}
                        onClick={() => handleReaction(m.id, emoji)}
                        className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                          userIds.includes(user.id) ? 'bg-primary/20' : 'bg-muted hover:bg-muted/80'
                        }`}
                      >
                        {emoji} {userIds.length > 1 ? userIds.length : ''}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-1 px-1">
                  <span className="text-[10px] text-muted-foreground">{formatChatTimestamp(m.created_at, lang)}</span>
                  {isMine && <span className="text-xs text-muted-foreground">{m.read ? '✓✓' : '✓'}</span>}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      <form onSubmit={handleSend} className="flex flex-col gap-2 border-t border-border p-3">
        {editingId && (
          <div className="flex items-center justify-between rounded-lg bg-muted p-2 text-xs text-muted-foreground">
            <span>{lang === 'he' ? 'עריכת הודעה...' : 'Editing message...'}</span>
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setText('');
              }}
              className="underline hover:no-underline"
            >
              {lang === 'he' ? 'ביטול' : 'Cancel'}
            </button>
          </div>
        )}
        {replyingTo && (
          <div className="flex items-start gap-2 rounded-lg border-s-4 border-primary bg-primary/10 p-2 text-xs">
            <div className="min-w-0 flex-1">
              <div className="mb-0.5 font-semibold text-primary">
                {lang === 'he' ? 'בתגובה ל' : 'Replying to'} {replyingTo.from_user_id === user.id ? me.name : otherParticipant.name}
              </div>
              <div className="truncate text-muted-foreground">{describeMessage(replyingTo)}</div>
            </div>
            <button type="button" onClick={() => setReplyingTo(null)} className="shrink-0 rounded p-1 hover:bg-muted">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {typing && (
          <div className="px-1 text-xs italic text-muted-foreground">
            {otherParticipant.name} {lang === 'he' ? 'מקליד/ה...' : 'is typing...'}
          </div>
        )}
        {pendingAttachment && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted p-2 text-xs">
            {pendingAttachment.kind === 'file' ? (
              <>
                <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{pendingAttachment.file.name}</span>
                <span className="shrink-0 text-muted-foreground">{formatBytes(pendingAttachment.file.size)}</span>
              </>
            ) : (
              <>
                <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1">{lang === 'he' ? 'מיקום מוכן לשליחה' : 'Location ready to send'}</span>
              </>
            )}
            {sending ? (
              <span className="shrink-0 font-medium text-primary">{uploadProgress}%</span>
            ) : (
              <button type="button" onClick={() => setPendingAttachment(null)} className="shrink-0 rounded p-1 hover:bg-background">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" onChange={handleFileSelect} className="hidden" />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0"
            disabled={sending}
            onClick={() => fileInputRef.current?.click()}
            aria-label={lang === 'he' ? 'צרף קובץ' : 'Attach file'}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0"
            disabled={sending}
            onClick={handleShareLocation}
            aria-label={lang === 'he' ? 'שיתוף מיקום' : 'Share location'}
          >
            <MapPin className="h-4 w-4" />
          </Button>
          <Input
            value={text}
            onChange={(e) => handleTyping(e.target.value)}
            placeholder={lang === 'he' ? 'כתבו הודעה...' : 'Type a message...'}
            className="min-w-0 flex-1"
          />
          <Button
            type="submit"
            size="icon"
            className="shrink-0"
            disabled={sending || (!text.trim() && !pendingAttachment)}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </form>

      {lightboxMessage && (
        <MediaLightbox
          items={[
            {
              url: lightboxMessage.media_url,
              type: isVideoUrl(lightboxMessage.media_url, lightboxMessage.media_meta?.type) ? 'video' : 'image',
              name: lightboxMessage.media_meta?.name,
              size: lightboxMessage.media_meta?.size,
              uploaded_by_participant_id: lightboxMessage.from_participant_id,
              uploaded_at: lightboxMessage.created_at,
            },
          ]}
          index={0}
          onIndexChange={() => {}}
          onClose={() => setLightboxMessage(null)}
          onDownload={(item) => window.open(item.url, '_blank', 'noopener,noreferrer')}
          participantsById={{ [me?.id]: me, [otherParticipant.id]: otherParticipant }}
          canManage={false}
        />
      )}
    </div>
  );
}
