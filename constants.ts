
export const COLORS = {
  primary: '#3b82f6',
  sidebar: '#1e293b',
  canvasBg: '#0f172a',
  overlay: 'rgba(59, 130, 246, 0.2)',
  handle: '#3b82f6',
};

export const HANDLE_SIZE = 8;
export const MIN_RECT_SIZE = 10;
export const ZOOM_STEP = 0.1;
export const MAX_ZOOM = 5;
export const MIN_ZOOM = 0.1;
export const NUDGE_STEP = 1;       // 방향키 한 번에 텍스트 상자가 움직이는 거리 (이미지 픽셀)
export const NUDGE_STEP_FAST = 10; // Shift + 방향키
export const ROTATE_HANDLE_GAP = 28; // 상자 위쪽 변과 회전 손잡이 사이 거리 (화면 픽셀)
export const ROTATE_SNAP = 15;       // Shift + 회전 드래그 때 맞출 각도 단위

/** 각도를 -180 ~ 180 범위, 소수 첫째 자리로 맞춘다 */
export const normalizeAngle = (deg: number) => {
  const v = Math.round(((((deg + 180) % 360) + 360) % 360 - 180) * 10) / 10;
  return v === -180 ? 180 : v;
};
