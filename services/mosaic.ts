// 브러시 모자이크: 이미지 전체를 칸 단위로 뭉갠 그림을 미리 만들어 두고, 브러시가 지나간 자리에만 그 그림을 찍는다.
// 칸은 항상 이미지 왼쪽 위 기준이라 여러 번 나눠 칠해도 칸 경계가 어긋나지 않는다.

export interface MosaicSettings {
  brush: number; // 브러시 지름 (이미지 픽셀)
  block: number; // 모자이크 한 칸 크기 (이미지 픽셀)
}

export const DEFAULT_MOSAIC: MosaicSettings = { brush: 60, block: 14 };
export const MOSAIC_BRUSH_RANGE = { min: 5, max: 400 };
export const MOSAIC_BLOCK_RANGE = { min: 3, max: 80 };

export const copyToCanvas = (src: CanvasImageSource, width: number, height: number) => {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  c.getContext('2d')!.drawImage(src, 0, 0);
  return c;
};

// 칸마다 평균 색 하나로 채운 그림
export const makePixelated = (src: CanvasImageSource, width: number, height: number, block: number) => {
  const b = Math.max(1, Math.round(block));
  const cols = Math.ceil(width / b);
  const rows = Math.ceil(height / b);
  // 칸 수만큼으로 줄였다가(칸 안 색이 평균으로 섞인다) 매끈하게 하지 않고 다시 키운다.
  // 오른쪽·아래 끝의 덜 찬 칸까지 칸 수에 넣어 빈 곳이 생기지 않게 한다
  const small = document.createElement('canvas');
  small.width = cols;
  small.height = rows;
  const sctx = small.getContext('2d')!;
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(src, 0, 0, width, height, 0, 0, cols, rows);

  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const octx = out.getContext('2d')!;
  octx.imageSmoothingEnabled = false;
  octx.drawImage(small, 0, 0, cols, rows, 0, 0, cols * b, rows * b);
  return out;
};

// from → to 를 지나가며 원 모양으로 모자이크를 찍는다 (빠르게 끌어도 끊기지 않게 사이를 메운다)
export const paintMosaic = (work: HTMLCanvasElement, pixelated: HTMLCanvasElement, from: { x: number; y: number }, to: { x: number; y: number }, brush: number) => {
  const ctx = work.getContext('2d')!;
  const r = Math.max(1, brush / 2);
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(1, Math.ceil(dist / (r / 3)));
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const x = from.x + ((to.x - from.x) * i) / steps;
    const y = from.y + ((to.y - from.y) * i) / steps;
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, Math.PI * 2);
  }
  ctx.clip();
  ctx.drawImage(pixelated, 0, 0);
  ctx.restore();
};
