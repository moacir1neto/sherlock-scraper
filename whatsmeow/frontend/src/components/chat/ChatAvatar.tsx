import { useState, useEffect } from 'react';
import { chatService } from '../../services/api';

interface ChatAvatarProps {
  instanceId: string;
  remoteJid: string;
  displayLetter: string;
  size?: 'sm' | 'md' | 'lg';
}

export function ChatAvatar({
  instanceId,
  remoteJid,
  displayLetter,
  size = 'md',
}: ChatAvatarProps) {
  const [src, setSrc] = useState<string | null>(null);
  const sizeClass = size === 'sm' ? 'w-8 h-8 text-sm' : size === 'lg' ? 'w-14 h-14 text-xl' : 'w-10 h-10 text-base';

  useEffect(() => {
    if (!instanceId || !remoteJid) return;
    let objectUrl: string | null = null;
    chatService.getProfilePicture(instanceId, remoteJid).then((blob: Blob | null) => {
      if (blob) {
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      }
    });
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [instanceId, remoteJid]);

  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={`flex-shrink-0 rounded-2xl bg-primary-100 dark:bg-primary-900/40 object-cover shadow-sm ${sizeClass}`}
      />
    );
  }
  return (
    <div
      className={`flex-shrink-0 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 text-white flex items-center justify-center font-bold shadow-md ${sizeClass}`}
    >
      {displayLetter}
    </div>
  );
}
