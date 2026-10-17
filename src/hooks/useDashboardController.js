import { useEffect } from 'react';

export function useDashboardController() {
  useEffect(() => {
    let cancelled = false;
    let dispose;

    // import ถูก cache แต่ DOM เป็นชุดใหม่ทุกครั้งที่กลับจากหน้าแรก
    import('../services/dashboardController.js').then(({ initializeDashboard }) => {
      if (!cancelled) dispose = initializeDashboard();
    });

    return () => {
      cancelled = true;
      dispose?.();
    };
  }, []);
}
