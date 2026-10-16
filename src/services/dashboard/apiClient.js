const API_BASE = "/api/v1";

const errorMessages = {
  EMAIL_EXISTS: "อีเมลนี้ถูกสมัครสมาชิกไว้แล้ว",
  INVALID_CREDENTIALS: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
  UNAUTHORIZED: "Session หมดอายุ กรุณาเข้าสู่ระบบใหม่",
  VALIDATION_ERROR: "กรุณาตรวจสอบข้อมูลที่กรอกอีกครั้ง",
  RATE_LIMITED: "ลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอประมาณ 1 นาที",
  FORBIDDEN: "บัญชีนี้ไม่มีสิทธิ์แก้ไขข้อมูลร้าน",
  NOT_FOUND: "ไม่พบข้อมูล หรือคุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้",
};

// อ่าน token ล่าสุดทุกครั้ง เพื่อให้ใช้ได้ทั้งก่อนและหลังเข้าสู่ระบบ
export function createApiClient(getToken) {
async function apiRequest(
  path,
  { method = "GET", body, signal, withMeta = false } = {}
) {
  const headers = {};

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (getToken()) {
    headers.Authorization = `Bearer ${getToken()}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    signal,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) {
    return null;
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const code = payload.error?.code;
    const message =
      errorMessages[code] ||
      payload.error?.message ||
      `เกิดข้อผิดพลาด HTTP ${response.status}`;

    const error = new Error(message);
    error.code = code;
    error.status = response.status;
    error.details = payload.error?.details || [];

    throw error;
  }

  return withMeta ? payload : payload.data;
}
  return apiRequest;
}
