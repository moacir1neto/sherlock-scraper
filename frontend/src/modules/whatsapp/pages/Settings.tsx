import { useState, useEffect } from 'react';
import { Bell, Volume2 } from 'lucide-react';
import { getNotificationSettings, setNotificationSettings, NotificationSettings } from '../utils/notificationSettings';

export function Settings() {
  const [settings, setSettings] = useState<NotificationSettings>(getNotificationSettings());
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | null>(
    typeof Notification !== 'undefined' ? Notification.permission : null
  );

  useEffect(() => {
    setNotificationSettings(settings);
  }, [settings]);

  const requestNotificationPermission = async () => {
    if (typeof Notification === 'undefined') return;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Configurações</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        Preferências do painel (salvas neste navegador).
      </p>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Bell size={20} className="text-primary-600 dark:text-primary-400" />
            Notificações
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Quando chegar nova mensagem no Chat (incluindo conversas em aguardando).
          </p>
        </div>
        <div className="p-6 space-y-6">
          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <div className="flex items-center gap-3">
              <Bell size={20} className="text-gray-600 dark:text-gray-400" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Ativar notificações</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Notificação do navegador e indicador na aba quando chegar nova mensagem.
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.notificationsEnabled}
              onChange={(e) => setSettings((s) => ({ ...s, notificationsEnabled: e.target.checked }))}
              className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
            />
          </label>

          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <div className="flex items-center gap-3">
              <Volume2 size={20} className="text-gray-600 dark:text-gray-400" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Reproduzir som</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Tocar um som ao receber nova mensagem (quando as notificações estiverem ativas).
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.soundEnabled}
              onChange={(e) => setSettings((s) => ({ ...s, soundEnabled: e.target.checked }))}
              className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
              disabled={!settings.notificationsEnabled}
            />
          </label>
          {!settings.notificationsEnabled && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Ative as notificações acima para poder usar o som.
            </p>
          )}

          {settings.notificationsEnabled && typeof Notification !== 'undefined' && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Notificações do navegador: {notifPermission === 'granted' ? 'Permitidas' : notifPermission === 'denied' ? 'Bloqueadas' : 'Não solicitadas'}
              </p>
              {notifPermission !== 'granted' && (
                <button
                  type="button"
                  onClick={requestNotificationPermission}
                  className="text-sm px-3 py-1.5 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 hover:bg-primary-200 dark:hover:bg-primary-800/40"
                >
                  {notifPermission === 'default' ? 'Solicitar permissão' : 'Verificar permissão'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
