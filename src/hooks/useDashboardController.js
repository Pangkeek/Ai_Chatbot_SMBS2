import { useEffect } from 'react';

export function useDashboardController() {
  useEffect(() => {
    import('../services/dashboardController.js');
  }, []);
}
