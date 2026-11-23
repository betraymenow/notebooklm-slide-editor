
export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type VerticalAlign = 'top' | 'middle' | 'bottom';
export type HorizontalAlign = 'left' | 'center' | 'right';

export interface TextOverlay {
  id: string;
  rect: Rect;
  originalText: string;
  newText: string;
  fontSize: number;
  fontWeight: string;
  fontColor: string;
  fontFamily: string;
  backgroundColor: string;
  vAlign: VerticalAlign;
  hAlign: HorizontalAlign;
  letterSpacing?: number;
  italic?: boolean;
  outlineColor?: string; // 글자 외곽선 색
  outlineWidth?: number; // 글자 외곽선 두께 (px, 0 이면 없음)
  rotation?: number; // 상자 가운데를 축으로 시계 방향 각도 (도)
  imageUrl?: string; // 있으면 글자 대신 이 그림을 상자 크기에 맞춰 그린다 (슬라이드 위에 끌어다 놓은 이미지)
}

export interface SlideData {
  index: number;
  dataUrl: string;
  width: number;
  height: number;
  overlays: TextOverlay[];
}

export type HandleType = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export interface OCRResult {
  text: string;
  fontSize: number;
  fontWeight: string;
  fontColor: string;
  fontFamily: string;
  backgroundColor: string;
  fontCandidates: string[];
}
