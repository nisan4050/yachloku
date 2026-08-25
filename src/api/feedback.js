import { supabase } from '@/api/supabaseClient';
import { buildStoragePath } from '@/lib/utils';

export async function submitFeedback({ userId, senderEmail, senderName, message, file }) {
  let attachmentUrl = null;
  if (file) {
    const path = buildStoragePath(userId, file);
    const { error: uploadError } = await supabase.storage.from('feedback').upload(path, file);
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from('feedback').getPublicUrl(path);
    attachmentUrl = data.publicUrl;
  }

  const { error } = await supabase.from('developer_feedback').insert({
    user_id: userId,
    sender_email: senderEmail,
    sender_name: senderName,
    message,
    attachment_url: attachmentUrl,
  });
  if (error) throw error;
  return attachmentUrl;
}
