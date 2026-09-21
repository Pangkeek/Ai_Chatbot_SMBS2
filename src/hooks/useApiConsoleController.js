import { useEffect } from 'react';

export function useApiConsoleController() {
  useEffect(() => {
    import('../services/apiConsoleController.js');
  }, []);
}
