
// 한글 웹폰트 카탈로그 + 로더 + 이미지 기반 글씨체 매칭

export interface FontDef {
  id: string;          // CSS font-family 이름
  name: string;        // 표시 이름
  category: 'sans' | 'serif' | 'display' | 'hand' | 'mono';
  weights: number[];   // 제공되는 두께
  hangul: boolean;     // 한글 글리프 포함 여부
  hint: string;        // AI에게 주는 생김새 설명
  css?: string;        // Google Fonts 가 아닌 경우 @font-face CSS 주소
  variable?: [number, number]; // 가변 글꼴이면 연속으로 지원하는 두께 범위
}

export const FONT_CATALOG: FontDef[] = [
  { id: 'Pretendard Variable', name: '프리텐다드', category: 'sans', weights: [300, 400, 500, 600, 700, 800, 900], variable: [100, 900], hangul: true, hint: 'modern neutral geometric-grotesque sans, very common in Korean UI and slides', css: 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css' },
  { id: 'NanumSquare', name: '나눔스퀘어', category: 'sans', weights: [300, 400, 700, 800], hangul: true, hint: 'squarish geometric gothic with flat horizontal strokes, popular for presentation titles', css: 'https://cdn.jsdelivr.net/gh/moonspam/NanumSquare@2.0/nanumsquare.css' },
  { id: 'SUIT Variable', name: 'SUIT', category: 'sans', weights: [300, 400, 500, 600, 700, 800, 900], variable: [100, 900], hangul: true, hint: 'clean modern sans with slightly narrow hangul', css: 'https://cdn.jsdelivr.net/gh/sun-typeface/SUIT@2/fonts/variable/woff2/SUIT-Variable.css' },
  { id: 'Spoqa Han Sans Neo', name: '스포카 한 산스 Neo', category: 'sans', weights: [300, 400, 500, 700], hangul: true, hint: 'compact modern gothic with tight, even hangul', css: 'https://spoqa.github.io/spoqa-han-sans/css/SpoqaHanSansNeo.css' },
  { id: 'Wanted Sans Variable', name: '원티드 산스', category: 'sans', weights: [400, 500, 600, 700, 800, 900, 1000], variable: [400, 1000], hangul: true, hint: 'contemporary grotesque sans with crisp hangul', css: 'https://cdn.jsdelivr.net/gh/wanteddev/wanted-sans@v1.0.3/packages/wanted-sans/fonts/webfonts/variable/split/WantedSansVariable.min.css' },
  { id: 'Noto Sans KR', name: '본고딕 (Noto Sans KR)', category: 'sans', weights: [300, 400, 500, 700, 900], variable: [100, 900], hangul: true, hint: 'standard clean gothic sans (Source Han Sans), used by Google products and NotebookLM' },
  { id: 'Nanum Gothic', name: '나눔고딕', category: 'sans', weights: [400, 700, 800], hangul: true, hint: 'classic rounded-ish gothic sans, slightly wider, older look' },
  { id: 'Gothic A1', name: 'Gothic A1', category: 'sans', weights: [300, 400, 500, 700, 900], hangul: true, hint: 'neutral gothic sans with compact proportions' },
  { id: 'IBM Plex Sans KR', name: 'IBM Plex Sans KR', category: 'sans', weights: [300, 400, 500, 700], hangul: true, hint: 'technical sans with angular latin and slightly square hangul' },
  { id: 'Gowun Dodum', name: '고운돋움', category: 'sans', weights: [400], hangul: true, hint: 'soft humanist sans with gentle curves' },
  { id: 'Sunflower', name: 'Sunflower', category: 'sans', weights: [300, 500, 700], hangul: true, hint: 'tall condensed sans with narrow letters' },
  { id: 'Noto Serif KR', name: '본명조 (Noto Serif KR)', category: 'serif', weights: [400, 600, 700, 900], variable: [200, 900], hangul: true, hint: 'standard myeongjo serif with brush-like stroke ends' },
  { id: 'Nanum Myeongjo', name: '나눔명조', category: 'serif', weights: [400, 700, 800], hangul: true, hint: 'classic thin myeongjo serif, high contrast' },
  { id: 'Gowun Batang', name: '고운바탕', category: 'serif', weights: [400, 700], hangul: true, hint: 'soft calligraphic batang serif' },
  { id: 'Hahmlet', name: '함렛', category: 'serif', weights: [400, 700], variable: [100, 900], hangul: true, hint: 'contemporary serif with sharp wedges' },
  { id: 'Song Myung', name: '송명', category: 'serif', weights: [400], hangul: true, hint: 'traditional heavy-ended myeongjo, old print style' },
  { id: 'Black Han Sans', name: '검은고딕', category: 'display', weights: [400], hangul: true, hint: 'extremely heavy, blocky headline gothic' },
  { id: 'Do Hyeon', name: '도현체', category: 'display', weights: [400], hangul: true, hint: 'bold, squared, condensed headline font (Baemin style)' },
  { id: 'Jua', name: '주아체', category: 'display', weights: [400], hangul: true, hint: 'bold rounded cute headline font (Baemin style)' },
  { id: 'Gugi', name: '구기', category: 'display', weights: [400], hangul: true, hint: 'decorative geometric display font' },
  { id: 'Dongle', name: '동글', category: 'display', weights: [300, 400, 700], hangul: true, hint: 'very rounded, short and wide bubbly font' },
  { id: 'Nanum Pen Script', name: '나눔손글씨 펜', category: 'hand', weights: [400], hangul: true, hint: 'casual pen handwriting, narrow and slanted' },
  { id: 'Nanum Brush Script', name: '나눔손글씨 붓', category: 'hand', weights: [400], hangul: true, hint: 'brush handwriting with thick-thin strokes' },
  { id: 'Gaegu', name: '개구체', category: 'hand', weights: [300, 400, 700], hangul: true, hint: 'playful childlike handwriting' },
  { id: 'Hi Melody', name: '하이멜로디', category: 'hand', weights: [400], hangul: true, hint: 'neat rounded handwriting' },
  { id: 'Nanum Gothic Coding', name: '나눔고딕코딩', category: 'mono', weights: [400, 700], hangul: true, hint: 'monospaced gothic for code' },
  { id: 'Inter', name: 'Inter', category: 'sans', weights: [300, 400, 500, 600, 700, 800, 900], variable: [100, 900], hangul: false, hint: 'latin-only neutral UI sans' },
  { id: 'Roboto', name: 'Roboto', category: 'sans', weights: [300, 400, 500, 700, 900], variable: [100, 900], hangul: false, hint: 'latin-only Google/Android sans' },
];

const GENERIC = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui']);

export const getFontDef = (id: string) => FONT_CATALOG.find(f => f.id === id);

// 캔버스 ctx.font 에 넣을 font-family 문자열
export const fontStack = (family: string) => {
  if (GENERIC.has(family)) return family;
  const fallback = getFontDef(family)?.category === 'serif' ? 'serif' : 'sans-serif';
  return `"${family}", ${fallback}`;
};

export const canvasFont = (weight: string | number, size: number, family: string) =>
  `${weight} ${size}px ${fontStack(family)}`;

// ---------- 두께 미세조정 ----------

export const MIN_WEIGHT = 100;
export const MAX_WEIGHT = 1000;

export const parseWeight = (weight: string | number) => {
  if (weight === 'bold') return 700;
  const n = typeof weight === 'number' ? weight : parseInt(weight, 10);
  return Number.isFinite(n) ? n : 400;
};

/**
 * 요청한 두께를 실제로 그릴 방법으로 바꾼다.
 * - 가변 글꼴: 범위 안에서는 그 값 그대로
 * - 고정 두께 글꼴: 요청값 이하에서 가장 가까운 두께로 그리고, 모자란 만큼은 글자 외곽선으로 덧칠
 * 그래서 어떤 글꼴이든 슬라이더로 10 단위까지 굵기를 맞출 수 있다.
 */
export const resolveWeight = (family: string, weight: string | number): { cssWeight: number; extra: number; next?: number; prev?: number } => {
  const target = parseWeight(weight);
  const def = getFontDef(family);
  if (!def) return { cssWeight: target, extra: 0 };
  if (def.variable) {
    const [min, max] = def.variable;
    const css = Math.min(max, Math.max(min, target));
    // 최대치를 넘는 부분은 외곽선으로 보정 — 마지막 100 구간의 굵기 변화로 보정 폭을 잰다
    return { cssWeight: css, extra: Math.max(0, target - css), prev: target > max ? max - 100 : undefined };
  }
  const sorted = [...def.weights].sort((a, b) => a - b);
  const base = [...sorted].reverse().find(w => w <= target) ?? sorted[0];
  const next = sorted.find(w => w > base);
  const prev = [...sorted].reverse().find(w => w < base);
  return { cssWeight: base, extra: Math.max(0, target - base), next, prev };
};

/**
 * 고정 두께 글꼴의 "한 단계 위 두께"를 외곽선 몇 px 로 흉내낼 수 있는지 실제로 그려서 잰다.
 * 결과: 글자 크기 1px 당, 두께 1 당 외곽선 폭. 글꼴마다 획 구조가 달라 고정 비율로는 어긋난다.
 */
const strokeCalib = new Map<string, number>();
const DEFAULT_STROKE_PER_WEIGHT = 0.016 / 100;
const CALIB_TEXT = '가나다라마바사아자차';

const inkAmount = (family: string, weight: number, stroke: number) => {
  const size = 100;
  const c = document.createElement('canvas');
  c.width = size * CALIB_TEXT.length + 40;
  c.height = size * 1.5;
  const ctx = c.getContext('2d')!;
  ctx.font = canvasFont(weight, size, family);
  ctx.textBaseline = 'top';
  ctx.fillStyle = ctx.strokeStyle = '#000';
  ctx.fillText(CALIB_TEXT, 20, 20);
  if (stroke > 0) {
    ctx.lineWidth = stroke;
    ctx.lineJoin = 'round';
    ctx.strokeText(CALIB_TEXT, 20, 20);
  }
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  let s = 0;
  for (let i = 3; i < d.length; i += 4) s += d[i];
  return s / 255;
};

const calibrate = (family: string, base: number, next: number) => {
  const key = `${family}|${base}`;
  if (strokeCalib.has(key)) return;
  const inkBase = inkAmount(family, base, 0);
  const inkNext = inkAmount(family, next, 0);
  const perPx = (inkAmount(family, base, 4) - inkBase) / 4; // 외곽선 1px 당 늘어나는 잉크
  if (perPx <= 0 || inkNext <= inkBase) return;
  const strokePx = (inkNext - inkBase) / perPx;              // 100px 글자에서 base → next 에 필요한 폭
  strokeCalib.set(key, strokePx / 100 / (next - base));
  window.dispatchEvent(new Event('fontcalibrated'));
};

const strokePerWeight = (family: string, cssWeight: number, prev?: number) =>
  strokeCalib.get(`${family}|${cssWeight}`)
  ?? (prev !== undefined ? strokeCalib.get(`${family}|${prev}`) : undefined)
  ?? DEFAULT_STROKE_PER_WEIGHT;

const extraStrokeWidth = (family: string, weight: string | number, fontSize: number) => {
  const { cssWeight, extra, prev } = resolveWeight(family, weight);
  return extra > 0 ? extra * fontSize * strokePerWeight(family, cssWeight, prev) : 0;
};

export interface TextStyle {
  newText: string;
  fontSize: number;
  fontWeight: string;
  fontColor: string;
  fontFamily: string;
  letterSpacing?: number;
  hAlign?: 'left' | 'center' | 'right';
  vAlign?: 'top' | 'middle' | 'bottom';
  rect: { x: number; y: number; width: number; height: number };
  pixelScale?: number; // 1 = 원래 해상도, 0.5 = 절반 해상도로 그린 뒤 키움 (원본 이미지의 뭉개진 글자에 맞추기)
}

// 픽셀 조절의 실제 최저 배율. 슬라이더 0~100% 가 이 값~100% 에 대응한다
export const PIXEL_SCALE_MIN = 0.97;

// 편집 화면·이미지 저장·PDF 저장이 모두 이 함수로 글자를 그린다
export const drawOverlayText = (ctx: CanvasRenderingContext2D, ov: TextStyle) => {
  const scale = Math.min(1, Math.max(PIXEL_SCALE_MIN, ov.pixelScale ?? 1));
  if (scale >= 1) return drawTextCrisp(ctx, ov);

  // 100%에 아주 가까운 배율은 픽셀 격자와 맞물리는 위치에 따라 뭉개짐이 들쭉날쭉하다.
  // 그래서 "원래 해상도"와 "최저 배율(97%)" 두 장을 그려 비율대로 섞는다 → 슬라이더에 비례해 고르게 변한다.
  const t = (scale - PIXEL_SCALE_MIN) / (1 - PIXEL_SCALE_MIN); // 1 = 원래 해상도, 0 = 97%

  // 상자보다 글자가 삐져나올 수 있어 글자 크기만큼 여유를 두고, 정수 좌표에 맞춰 1:1 로 붙인다
  const pad = Math.ceil(ov.fontSize);
  const ox = Math.floor(ov.rect.x - pad);
  const oy = Math.floor(ov.rect.y - pad);
  const W = Math.ceil(ov.rect.x + ov.rect.width + pad) - ox;
  const H = Math.ceil(ov.rect.y + ov.rect.height + pad) - oy;
  const layer = (draw: (c: CanvasRenderingContext2D) => void) => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    draw(c.getContext('2d')!);
    return c;
  };

  // 저해상도: 97% 크기로 그린 뒤 원래 크기로 부드럽게 키운다
  const s = PIXEL_SCALE_MIN;
  const small = document.createElement('canvas');
  small.width = Math.ceil(W * s);
  small.height = Math.ceil(H * s);
  const sctx = small.getContext('2d')!;
  sctx.scale(s, s);
  sctx.translate(-ox, -oy);
  drawTextCrisp(sctx, ov);
  const soft = layer(c => {
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    c.drawImage(small, 0, 0, W * s, H * s, 0, 0, W, H);
  });

  // 'lighter' 합성은 (미리 곱한 알파 기준) 더하기라, 가중치 t / 1-t 로 그리면 정확한 선형 혼합이 된다
  const mixed = layer(c => {
    c.globalCompositeOperation = 'lighter';
    if (t > 0) {
      const crisp = layer(cc => { cc.translate(-ox, -oy); drawTextCrisp(cc, ov); });
      c.globalAlpha = t;
      c.drawImage(crisp, 0, 0);
    }
    c.globalAlpha = 1 - t;
    c.drawImage(soft, 0, 0);
  });

  ctx.drawImage(mixed, ox, oy);
};

const drawTextCrisp = (ctx: CanvasRenderingContext2D, ov: TextStyle) => {
  const { cssWeight } = resolveWeight(ov.fontFamily, ov.fontWeight);
  ctx.save();
  ctx.fillStyle = ov.fontColor;
  ctx.font = canvasFont(cssWeight, ov.fontSize, ov.fontFamily);
  if (ctx.letterSpacing !== undefined) ctx.letterSpacing = `${ov.letterSpacing || 0}px`;

  const lines = ov.newText.split('\n');
  const lineHeight = ov.fontSize * 1.2;
  const totalTextHeight = lines.length * lineHeight;

  ctx.textAlign = (ov.hAlign || 'left') as CanvasTextAlign;
  ctx.textBaseline = 'top';

  let tx = ov.rect.x;
  if (ov.hAlign === 'center') tx = ov.rect.x + ov.rect.width / 2;
  else if (ov.hAlign === 'right') tx = ov.rect.x + ov.rect.width;

  let ty = ov.rect.y;
  if (ov.vAlign === 'middle') ty = ov.rect.y + (ov.rect.height - totalTextHeight) / 2;
  else if (ov.vAlign === 'bottom') ty = ov.rect.y + ov.rect.height - totalTextHeight;

  const stroke = extraStrokeWidth(ov.fontFamily, ov.fontWeight, ov.fontSize);
  if (stroke > 0) {
    ctx.strokeStyle = ov.fontColor;
    ctx.lineWidth = stroke;
    ctx.lineJoin = 'round';
  }
  lines.forEach((line, index) => {
    ctx.fillText(line, tx, ty + index * lineHeight);
    if (stroke > 0) ctx.strokeText(line, tx, ty + index * lineHeight);
  });
  ctx.restore();
};

// ---------- 폰트 CSS 로드 ----------

const googleFontsUrl = () => {
  const families = FONT_CATALOG
    .filter(f => !f.css)
    .map(f => {
      const fam = f.id.replace(/ /g, '+');
      if (f.variable) return `family=${fam}:wght@${f.variable[0]}..${f.variable[1]}`;
      return f.weights.length === 1 && f.weights[0] === 400 ? `family=${fam}` : `family=${fam}:wght@${f.weights.join(';')}`;
    });
  return `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`;
};

let cssReady: Promise<void> | null = null;

// @font-face 선언만 불러온다. 실제 글리프 파일은 사용될 때 unicode-range 단위로 받는다.
export const ensureFontCss = () => {
  if (cssReady) return cssReady;
  const addLink = (href: string) => new Promise<void>(resolve => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = () => resolve();
    link.onerror = () => { console.warn('Font CSS failed to load', href); resolve(); };
    document.head.appendChild(link);
  });
  const urls = [googleFontsUrl(), ...FONT_CATALOG.flatMap(f => (f.css ? [f.css] : []))];
  cssReady = Promise.all(urls.map(addLink)).then(() => undefined);
  return cssReady;
};

export const loadFont = async (family: string, weight: string | number = 400, text = '가A') => {
  if (GENERIC.has(family)) return;
  await ensureFontCss();
  try {
    const { cssWeight, extra, next, prev } = resolveWeight(family, weight);
    await document.fonts.load(canvasFont(cssWeight, 32, family), text || '가A');
    // 고정 두께 사이 값이면 위·아래 단계를 불러와 외곽선 보정 폭을 잰다
    if (extra > 0) {
      const upper = next ?? cssWeight;
      const lower = next !== undefined ? cssWeight : prev;
      if (lower !== undefined && upper > lower) {
        await Promise.all([lower, upper].map(w => document.fonts.load(canvasFont(w, 32, family), CALIB_TEXT)));
        calibrate(family, lower, upper);
      }
    }
  } catch (e) {
    console.warn('Font load failed', family, e);
  }
};

/**
 * 후보 폰트들로 같은 문장을 그린 번호 붙은 견본 이미지 (AI 비교용).
 * 원본과 같은 색 조합으로 그려 모양만 비교되게 한다.
 */
export const renderSampleSheet = (text: string, matches: { fontFamily: string; fontWeight: string }[], fg = '#000000', bg = '#ffffff') => {
  const line = text.split('\n').reduce((a, b) => (b.length > a.length ? b : a), '').trim();
  const size = 40, rowH = 70, labelW = 60, width = 1000;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = rowH * matches.length;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textBaseline = 'middle';
  matches.forEach((m, i) => {
    const y = i * rowH + rowH / 2;
    ctx.fillStyle = '#e11d48';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(String(i + 1), 14, y);
    ctx.fillStyle = fg;
    ctx.font = canvasFont(m.fontWeight, size, m.fontFamily);
    const w = ctx.measureText(line).width;
    const fit = Math.min(1, (width - labelW - 20) / w);
    ctx.font = canvasFont(m.fontWeight, size * fit, m.fontFamily);
    ctx.fillText(line, labelW, y);
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(0, (i + 1) * rowH - 1, width, 1);
  });
  return canvas.toDataURL('image/png');
};

// ---------- 이미지 기반 글씨체 매칭 ----------

export interface FontMatch {
  fontFamily: string;
  fontWeight: string;
  fontSize: number;
  letterSpacing: number;
  score: number; // 0~1 (픽셀 비교 점수)
  aiRank?: number; // AI가 견본을 보고 매긴 순위 (0 = 가장 비슷)
}

type RGB = [number, number, number];

const hexToRgb = (hex: string): RGB => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(full.slice(0, 6), 16);
  return isNaN(n) ? [255, 255, 255] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const rgbToHex = ([r, g, b]: RGB) => '#' + [r, g, b].map(c => Math.round(c).toString(16).padStart(2, '0')).join('');

const dist2 = (a: RGB, b: RGB) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

const averageOf = (list: RGB[]): RGB => {
  const sum = list.reduce<RGB>((acc, c) => [acc[0] + c[0], acc[1] + c[1], acc[2] + c[2]], [0, 0, 0]);
  return [sum[0] / list.length, sum[1] / list.length, sum[2] / list.length];
};

/**
 * 글자 색 추정.
 * hint(AI가 본 글자색)가 있으면 그 근처 픽셀 중 가장 진한 쪽을 평균내고,
 * 없거나 근처 픽셀이 너무 적으면 배경색에서 가장 먼 픽셀들의 평균을 쓴다.
 */
export const estimateTextColor = (img: ImageData, bgHex: string, hintHex?: string): string => {
  const bg = hexToRgb(bgHex);
  const d = img.data;
  const pixels: RGB[] = [];
  for (let i = 0; i < d.length; i += 4) pixels.push([d[i], d[i + 1], d[i + 2]]);

  if (hintHex) {
    const hint = hexToRgb(hintHex);
    const near = pixels.filter(c => dist2(c, hint) < 90 * 90 && dist2(c, bg) > dist2(hint, bg) * 0.25);
    if (near.length > pixels.length * 0.01) {
      near.sort((a, b) => dist2(b, bg) - dist2(a, bg));
      return rgbToHex(averageOf(near.slice(0, Math.max(1, Math.floor(near.length * 0.3)))));
    }
  }

  pixels.sort((a, b) => dist2(b, bg) - dist2(a, bg));
  return rgbToHex(averageOf(pixels.slice(0, Math.max(1, Math.floor(pixels.length * 0.02)))));
};

interface Box { x: number; y: number; w: number; h: number }

/**
 * 0~1 잉크 농도 맵 (글자=1, 배경=0).
 * "배경과 다른 정도"가 아니라 "글자색과 가까운 정도"로 계산해서
 * 사진·그라데이션 배경이나 글자 테두리/그림자가 있어도 글자 획만 남긴다.
 * 판정 반경은 글자색-배경색 거리에 비례시켜, 렌더링한 후보 글자와 같은 기준이 되게 한다.
 */
const inkFromImage = (img: ImageData, fg: RGB, bg: RGB): Float32Array => {
  const out = new Float32Array(img.width * img.height);
  const d = img.data;
  const fill = (radius: number) => {
    const solid = radius * 0.4;
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      const dist = Math.sqrt(dist2([d[i], d[i + 1], d[i + 2]], fg));
      out[p] = dist <= solid ? 1 : dist >= radius ? 0 : (radius - dist) / (radius - solid);
    }
  };
  fill(Math.max(40, Math.sqrt(dist2(fg, bg)) * 0.6));

  // 글자 획 바로 바깥 색(테두리·그림자·글로우 포함)을 실제 배경으로 보고 판정 반경을 다시 잡는다
  const w = img.width, h = img.height;
  const ring: RGB[] = [];
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      const p = y * w + x;
      if (out[p] !== 0) continue;
      if (out[p - 2] === 1 || out[p + 2] === 1 || out[p - 2 * w] === 1 || out[p + 2 * w] === 1) {
        ring.push([d[p * 4], d[p * 4 + 1], d[p * 4 + 2]]);
      }
    }
  }
  if (ring.length > 20) {
    const local = averageOf(ring);
    const r = Math.max(Math.sqrt(dist2(fg, bg)), Math.sqrt(dist2(fg, local)));
    fill(Math.max(40, r * 0.6));
  }
  return out;
};

// 행/열 투영으로 글자 영역을 찾는다. 배경에 흩어진 잡티 몇 개는 무시된다.
const inkBox = (ink: Float32Array, w: number, h: number, thresh = 0.5): Box | null => {
  const rows = new Array(h).fill(0);
  const cols = new Array(w).fill(0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (ink[y * w + x] > thresh) { rows[y]++; cols[x]++; }
    }
  }
  const span = (arr: number[]) => {
    const max = Math.max(...arr);
    if (max === 0) return null;
    const cut = Math.max(1, max * 0.04);
    let a = 0, b = arr.length - 1;
    while (a < b && arr[a] < cut) a++;
    while (b > a && arr[b] < cut) b--;
    return [a, b];
  };
  const ys = span(rows), xs = span(cols);
  if (!ys || !xs) return null;
  return { x: xs[0], y: ys[0], w: xs[1] - xs[0] + 1, h: ys[1] - ys[0] + 1 };
};

// 잉크 맵의 box 부분을 outW x outH 로 리샘플
const normalize = (ink: Float32Array, w: number, box: Box, outW: number, outH: number): Float32Array => {
  const src = document.createElement('canvas');
  src.width = box.w;
  src.height = box.h;
  const sctx = src.getContext('2d')!;
  const id = sctx.createImageData(box.w, box.h);
  for (let y = 0; y < box.h; y++) {
    for (let x = 0; x < box.w; x++) {
      const v = Math.round(ink[(box.y + y) * w + box.x + x] * 255);
      const o = (y * box.w + x) * 4;
      id.data[o] = id.data[o + 1] = id.data[o + 2] = v;
      id.data[o + 3] = 255;
    }
  }
  sctx.putImageData(id, 0, 0);

  const dst = document.createElement('canvas');
  dst.width = outW;
  dst.height = outH;
  const dctx = dst.getContext('2d')!;
  dctx.imageSmoothingQuality = 'high';
  dctx.drawImage(src, 0, 0, outW, outH);
  const dd = dctx.getImageData(0, 0, outW, outH).data;
  const out = new Float32Array(outW * outH);
  for (let i = 0; i < out.length; i++) out[i] = dd[i * 4] / 255;
  return out;
};

const correlation = (a: Float32Array, b: Float32Array) => {
  let ma = 0, mb = 0;
  for (let i = 0; i < a.length; i++) { ma += a[i]; mb += b[i]; }
  ma /= a.length; mb /= b.length;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] - ma, y = b[i] - mb;
    num += x * y; da += x * x; db += y * y;
  }
  return da && db ? num / Math.sqrt(da * db) : 0;
};

const RENDER_SIZE = 80;

// 후보 폰트로 텍스트를 그려 잉크 맵을 만든다 (EditorCanvas 와 같은 줄간격 1.2)
const renderInk = (text: string, family: string, weight: number, spacing: number, size = RENDER_SIZE, blurPx = 0) => {
  const lines = text.split('\n');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  ctx.font = canvasFont(weight, size, family);
  if (ctx.letterSpacing !== undefined) ctx.letterSpacing = `${spacing}px`;
  const maxW = Math.max(...lines.map(l => ctx.measureText(l).width));
  canvas.width = Math.ceil(maxW + size);
  canvas.height = Math.ceil(lines.length * size * 1.2 + size * 0.5);
  ctx.font = canvasFont(weight, size, family);
  if (ctx.letterSpacing !== undefined) ctx.letterSpacing = `${spacing}px`;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'top';
  if (blurPx > 0) ctx.filter = `blur(${blurPx}px)`;
  lines.forEach((l, i) => ctx.fillText(l, size * 0.25, size * 0.25 + i * size * 1.2));
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const ink = inkFromImage(img, [255, 255, 255], [0, 0, 0]);
  return { ink, w: canvas.width, h: canvas.height, box: inkBox(ink, canvas.width, canvas.height) };
};

// 글자 영역을 가로 줄 단위로 나눈다 (빈 행이 줄 높이의 일부 이상 이어지면 줄 경계)
const splitLines = (ink: Float32Array, w: number, box: Box): Box[] => {
  const rows: number[] = [];
  for (let y = box.y; y < box.y + box.h; y++) {
    let n = 0;
    for (let x = box.x; x < box.x + box.w; x++) if (ink[y * w + x] > 0.5) n++;
    rows.push(n);
  }
  const cut = Math.max(1, Math.max(...rows) * 0.02);
  const raw: [number, number][] = [];
  let start = -1;
  rows.forEach((n, i) => {
    if (n >= cut && start < 0) start = i;
    if (n < cut && start >= 0) { raw.push([start, i - 1]); start = -1; }
  });
  if (start >= 0) raw.push([start, rows.length - 1]);
  if (raw.length === 0) return [];

  // 받침·점 등으로 잘게 쪼개진 띠는 합친다
  const tallest = Math.max(...raw.map(([a, b]) => b - a + 1));
  const merged: [number, number][] = [];
  for (const band of raw) {
    const last = merged[merged.length - 1];
    if (last && (band[0] - last[1] < tallest * 0.2 || band[1] - band[0] + 1 < tallest * 0.3)) last[1] = band[1];
    else merged.push([...band]);
  }

  return merged.map(([a, b]) => {
    let x0 = box.x + box.w, x1 = box.x - 1;
    const cols = new Array(box.w).fill(0);
    for (let y = box.y + a; y <= box.y + b; y++) {
      for (let x = box.x; x < box.x + box.w; x++) if (ink[y * w + x] > 0.5) cols[x - box.x]++;
    }
    const cmax = Math.max(...cols);
    cols.forEach((n, i) => { if (n >= Math.max(1, cmax * 0.04)) { x0 = Math.min(x0, box.x + i); x1 = Math.max(x1, box.x + i); } });
    return { x: x0, y: box.y + a, w: Math.max(1, x1 - x0 + 1), h: b - a + 1 };
  });
};

// 한 줄(또는 한 덩어리)을 특정 폰트·두께로 그려서 비교
const scoreUnit = (
  t: { text: string; box: Box; aspect: number; outW: number; outH: number; soft: boolean; norm: Float32Array; coverage: number },
  family: string,
  weight: number,
  blurPx = 0,
) => {
  const base = renderInk(t.text, family, weight, 0);
  if (!base.box) return null;
  const scale = t.box.h / base.box.h;          // 렌더 크기 → 실제 크기 배율
  const longest = t.text.split('\n').reduce((a, b) => (b.length > a.length ? b : a), '');
  const gaps = Math.max(1, [...longest].length - 1);

  const fontSize = RENDER_SIZE * scale;

  // 폭 차이를 자간으로 보정 (em 단위, -0.15em ~ +0.3em)
  let spacingEm = (t.box.w / scale - base.box.w) / gaps / RENDER_SIZE;
  spacingEm = Math.max(-0.15, Math.min(0.3, spacingEm));

  // 크게 그려서 원본 크기로 줄여 비교한다. 원본의 흐림 정도(blurPx, 원본 px)는 렌더 배율만큼 키워 적용
  const r = renderInk(t.text, family, weight, spacingEm * RENDER_SIZE, RENDER_SIZE, blurPx / scale);
  if (!r.box) return null;

  const candNorm = normalize(r.ink, r.w, r.box, t.outW, t.outH);
  const cand = t.soft ? blur(candNorm, t.outW, t.outH) : candNorm;
  let score = correlation(t.norm, cand);
  // 디자인에서 흔한 정도(±0.04em)를 넘는 자간 보정, 남은 비율 차이는 감점
  score -= Math.max(0, Math.abs(spacingEm) - 0.04) * 1.5;
  score -= Math.abs(Math.log((r.box.w / r.box.h) / t.aspect)) * 0.5;
  // 획 두께 차이 감점 (같은 해상도의 맵끼리 비교)
  score -= Math.abs(Math.log(mean(candNorm) / t.coverage)) * 0.8;

  return { score, fontSize, letterSpacing: spacingEm * fontSize };
};

const mean = (a: Float32Array) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i];
  return Math.max(1e-4, s / a.length);
};

// 3x3 박스 블러 — 1px 정도의 위치 오차나 AI 이미지의 뭉개짐을 흡수한다
const blur = (src: Float32Array, w: number, h: number) => {
  const out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx >= 0 && xx < w && yy >= 0 && yy < h) { s += src[yy * w + xx]; n++; }
        }
      }
      out[y * w + x] = s / n;
    }
  }
  return out;
};

const hasHangul = (s: string) => /[가-힣ㄱ-ㆎ]/.test(s);

/**
 * 선택 영역 이미지와 OCR 텍스트를 받아, 카탈로그의 각 폰트·두께로 같은 텍스트를 그려 비교한 뒤
 * 가장 비슷한 순서로 돌려준다. 글자 크기와 자간도 함께 추정한다.
 */
export const matchFont = async (
  crop: ImageData,
  text: string,
  fgHex: string,
  bgHex: string,
  aiHints: string[] = [],
): Promise<FontMatch[]> => {
  const cleanText = text.trim();
  if (!cleanText) return [];

  const targetInk = inkFromImage(crop, hexToRgb(fgHex), hexToRgb(bgHex));
  const tBox = inkBox(targetInk, crop.width, crop.height);
  if (!tBox || tBox.w < 4 || tBox.h < 4) return [];

  // 줄마다 정렬(가운데/오른쪽)이 다를 수 있으니, 이미지의 줄과 텍스트의 줄이 맞으면 줄 단위로 비교한다
  const textLines = cleanText.split('\n').map(l => l.trim()).filter(Boolean);
  const bands = splitLines(targetInk, crop.width, tBox);
  const units: { text: string; box: Box }[] =
    bands.length === textLines.length && textLines.length > 1
      ? textLines.map((t, i) => ({ text: t, box: bands[i] }))
      : [{ text: textLines.join('\n'), box: tBox }];

  const targets = units.map(u => {
    // 원본보다 키워서 비교하지 않는다 (업샘플링은 가짜 디테일만 만든다)
    const outH = Math.max(12, Math.min(48, u.box.h));
    const aspect = u.box.w / u.box.h;
    const outW = Math.max(8, Math.min(1000, Math.round(outH * aspect)));
    const soft = outH < 30; // 작은 글씨만 흐림 처리 (큰 글씨는 디테일로 구분)
    const norm = normalize(targetInk, crop.width, u.box, outW, outH);
    return {
      ...u,
      aspect, outW, outH, soft,
      norm: soft ? blur(norm, outW, outH) : norm,
      coverage: mean(norm),
      weight: [...u.text].length,
    };
  });
  const totalWeight = targets.reduce((s, t) => s + t.weight, 0);

  const korean = hasHangul(cleanText);
  const candidates = FONT_CATALOG.filter(f => f.hangul || !korean);
  await Promise.all(candidates.flatMap(f => f.weights.map(w => loadFont(f.id, w, cleanText))));

  const scoreAll = (family: string, weight: number, blurPx: number) => {
    let score = 0, sizeSum = 0, spacingSum = 0;
    for (const t of targets) {
      const s = scoreUnit(t, family, weight, blurPx);
      if (!s) return null;
      score += s.score * t.weight;
      sizeSum += s.fontSize * t.weight;
      spacingSum += s.letterSpacing * t.weight;
    }
    return { score: score / totalWeight, fontSize: sizeSum / totalWeight, letterSpacing: spacingSum / totalWeight };
  };

  const runPass = (blurPx: number) => {
    const out: FontMatch[] = [];
    for (const f of candidates) {
      for (const w of f.weights) {
        const s = scoreAll(f.id, w, blurPx);
        if (!s) continue;
        const score = s.score + (aiHints.includes(f.id) ? 0.03 : 0);
        out.push({
          fontFamily: f.id,
          fontWeight: String(w),
          fontSize: Math.round(s.fontSize * 2) / 2,
          letterSpacing: Math.round(s.letterSpacing * 10) / 10,
          score: Math.max(0, Math.min(1, score)),
        });
      }
    }
    return out.sort((a, b) => b.score - a.score);
  };

  // 1차: 선명하게 비교 → 상위 후보로 원본의 흐림 정도를 추정 → 2차: 같은 흐림으로 다시 비교
  let results = runPass(0);
  const probe = results.slice(0, 3);
  const blurScore = (b: number) =>
    probe.reduce((s, m) => s + (scoreAll(m.fontFamily, Number(m.fontWeight), b)?.score ?? 0), 0);
  let bestBlur = 0, bestBlurScore = blurScore(0);
  for (const b of [0.5, 1, 1.5, 2]) {
    const s = blurScore(b);
    if (s > bestBlurScore + 0.01) { bestBlur = b; bestBlurScore = s; }
  }
  if (bestBlur > 0) results = runPass(bestBlur);

  // 같은 폰트는 가장 잘 맞는 두께 하나만 남긴다
  const seen = new Set<string>();
  return results.filter(m => (seen.has(m.fontFamily) ? false : (seen.add(m.fontFamily), true)));
};
