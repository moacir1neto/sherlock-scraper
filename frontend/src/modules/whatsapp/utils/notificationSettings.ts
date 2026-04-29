const STORAGE_KEY = 'miauwhats_notification_settings';

export interface NotificationSettings {
  notificationsEnabled: boolean;
  soundEnabled: boolean;
}

const defaults: NotificationSettings = {
  notificationsEnabled: true,
  soundEnabled: true,
};

export function getNotificationSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw) as Partial<NotificationSettings>;
    return {
      notificationsEnabled: parsed.notificationsEnabled ?? defaults.notificationsEnabled,
      soundEnabled: parsed.soundEnabled ?? defaults.soundEnabled,
    };
  } catch {
    return { ...defaults };
  }
}

export function setNotificationSettings(settings: Partial<NotificationSettings>): void {
  const current = getNotificationSettings();
  const next = { ...current, ...settings };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
