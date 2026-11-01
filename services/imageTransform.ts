import { Rect, SlideData, TextOverlay } from '../types';

export type CropAspect = 'free' | '4:3' | '16:9';
export type ImageTransform = 'rotateLeft' | 'rotateRight' | 'flipH' | 'flipV';

export const CROP_ASPECTS: { id: CropAspect; label: string; ratio: number | null }[] = [
  { id: 'free', label: '자유롭게 자르기', ratio: null },
  { id: '4:3', label: '4 : 3 비율', ratio: 4 / 3 },
  { id: '16:9', label: '16 : 9 비율', ratio: 16 / 9 },
];

export const aspectRatio = (aspect: CropAspect) => CROP_ASPECTS.find(a => a.id === aspect)?.ratio ?? null;

// 비율을 지키면서 이미지 안에 들어가는 가장 큰 영역 (가운데 정렬)
export const initialCropRect = (width: number, height: number, ratio: number | null): Rect => {
  if (!ratio) return { x: 0, y: 0, width, height };
  const w = width / height > ratio ? height * ratio : width;
  const h = w / ratio;
  return { x: (width - w) / 2, y: (height - h) / 2, width: w, height: h };
};

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const makeCanvas = (width: number, height: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return { canvas, ctx: canvas.getContext('2d')! };
};

/** 자르기: 텍스트 상자는 같은 자리에 남도록 옮기고, 잘린 영역 밖으로 완전히 나간 상자는 지운다 */
export const cropSlide = async (slide: SlideData, rect: Rect): Promise<SlideData> => {
  const x = Math.round(Math.max(0, rect.x));
  const y = Math.round(Math.max(0, rect.y));
  const width = Math.round(Math.min(slide.width - x, rect.width));
  const height = Math.round(Math.min(slide.height - y, rect.height));
  const img = await loadImage(slide.dataUrl);
  const { canvas, ctx } = makeCanvas(width, height);
  ctx.drawImage(img, -x, -y);
  const overlays = slide.overlays
    .map(o => ({ ...o, rect: { ...o.rect, x: o.rect.x - x, y: o.rect.y - y } }))
    .filter(o => o.rect.x < width && o.rect.y < height && o.rect.x + o.rect.width > 0 && o.rect.y + o.rect.height > 0);
  return { ...slide, dataUrl: canvas.toDataURL('image/png'), width, height, overlays };
};

/**
 * 회전·대칭: 이미지만 돌리고, 텍스트 상자는 글자가 바로 서 있도록 크기는 그대로 둔 채
 * 상자 가운데 점만 같이 옮긴다.
 */
export const transformSlide = async (slide: SlideData, op: ImageTransform): Promise<SlideData> => {
  const { width: W, height: H } = slide;
  const rotated = op === 'rotateLeft' || op === 'rotateRight';
  const nw = rotated ? H : W;
  const nh = rotated ? W : H;
  const img = await loadImage(slide.dataUrl);
  const { canvas, ctx } = makeCanvas(nw, nh);
  ctx.translate(nw / 2, nh / 2);
  if (op === 'rotateRight') ctx.rotate(Math.PI / 2);
  else if (op === 'rotateLeft') ctx.rotate(-Math.PI / 2);
  else if (op === 'flipH') ctx.scale(-1, 1);
  else ctx.scale(1, -1);
  ctx.drawImage(img, -W / 2, -H / 2);

  const moveCenter = (cx: number, cy: number): [number, number] => {
    switch (op) {
      case 'rotateRight': return [H - cy, cx];
      case 'rotateLeft': return [cy, W - cx];
      case 'flipH': return [W - cx, cy];
      default: return [cx, H - cy];
    }
  };
  const overlays: TextOverlay[] = slide.overlays.map(o => {
    const [cx, cy] = moveCenter(o.rect.x + o.rect.width / 2, o.rect.y + o.rect.height / 2);
    return { ...o, rect: { ...o.rect, x: cx - o.rect.width / 2, y: cy - o.rect.height / 2 } };
  });
  return { ...slide, dataUrl: canvas.toDataURL('image/png'), width: nw, height: nh, overlays };
};
