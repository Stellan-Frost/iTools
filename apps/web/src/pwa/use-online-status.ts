import { useEffect, useState } from 'react';

/** Unknown until hydration completes so server and client initially render alike. */
export function useOnlineStatus(): boolean | undefined {
  const [isOnline, setIsOnline] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    function updateStatus() {
      setIsOnline(navigator.onLine);
    }

    updateStatus();
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  return isOnline;
}
