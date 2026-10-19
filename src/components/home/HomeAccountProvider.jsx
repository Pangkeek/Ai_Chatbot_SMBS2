import { createContext, useContext, useEffect, useState } from 'react';
import { createApiClient } from '../../services/dashboard/apiClient.js';

const TOKEN_KEY = 'smb_access_token';
const AccountContext = createContext(null);

// เมนูบัญชีและปุ่มหลักใช้ผลตรวจ session เดียวกัน ไม่เรียก API ซ้ำคนละชุด
export default function HomeAccountProvider({ children }) {
  const [account, setAccount] = useState({ status: 'checking', user: null, error: '' });

  useEffect(() => {
    const controller = new AbortController();
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) {
      setAccount({ status: 'guest', user: null, error: '' });
    } else {
      createApiClient(() => token)('/users/me', { signal: controller.signal }).then(user => {
        if (!controller.signal.aborted && sessionStorage.getItem(TOKEN_KEY) === token) {
          setAccount({ status: 'signed-in', user, error: '' });
        }
      }).catch(error => {
        if (controller.signal.aborted || sessionStorage.getItem(TOKEN_KEY) !== token) return;
        if (error.status === 401) {
          sessionStorage.removeItem(TOKEN_KEY);
          setAccount({ status: 'guest', user: null, error: '' });
        } else {
          // ปัญหาเครือข่ายไม่ใช่การออกจากระบบ จึงยังให้เข้าจัดการร้านได้
          setAccount({ status: 'signed-in', user: null, error: 'โหลดชื่อบัญชีไม่สำเร็จ กรุณาลองเปิดหน้านี้ใหม่' });
        }
      });
    }
    return () => controller.abort();
  }, []);

  async function signOut() {
    const token = sessionStorage.getItem(TOKEN_KEY);
    try {
      await createApiClient(() => token)('/auth/logout', { method: 'POST' });
    } catch {
      // ออกจากระบบในเครื่องได้แม้ server ติดต่อไม่ได้
    } finally {
      if (sessionStorage.getItem(TOKEN_KEY) === token) {
        sessionStorage.removeItem(TOKEN_KEY);
        setAccount({ status: 'guest', user: null, error: '' });
      }
    }
  }

  return <AccountContext.Provider value={{ account, signOut }}>{children}</AccountContext.Provider>;
}

export function useHomeAccount() {
  const value = useContext(AccountContext);
  if (!value) throw new Error('Home account controls require HomeAccountProvider');
  return value;
}
