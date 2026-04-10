import { useEffect, useRef } from 'react';
import { instanceService } from '../services/api';

export function useRealtime<T>(
  fetchFn: () => Promise<T>,
  interval: number = 5000,
  enabled: boolean = true
) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const fetchData = async () => {
      try {
        await fetchFn();
      } catch (error) {
        console.error('Realtime fetch error:', error);
      }
    };

    // Fetch immediately
    fetchData();

    // Then set up interval
    intervalRef.current = setInterval(fetchData, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchFn, interval, enabled]);
}

export function useInstanceStatus(instanceId: string | null, enabled: boolean = true) {
  const fetchStatus = async () => {
    if (!instanceId) return;
    return instanceService.status(instanceId);
  };

  useRealtime(fetchStatus, 3000, enabled && !!instanceId);
}

