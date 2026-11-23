import { RunStyle, StyleSpan, TextSelection } from '../types';

// 글자 일부만 다르게 꾸밀 수 있는 항목 (정렬·배경·자간·회전은 상자 전체에만 적용)
export const RUN_STYLE_KEYS = ['fontFamily', 'fontSize', 'fontWeight', 'fontColor', 'italic', 'outlineColor', 'outlineWidth'] as const;
export type RunStyleKey = typeof RUN_STYLE_KEYS[number];

export interface StyledBox extends Required<Pick<RunStyle, 'fontFamily' | 'fontSize' | 'fontWeight' | 'fontColor'>> {
  newText: string;
  italic?: boolean;
  outlineColor?: string;
  outlineWidth?: number;
  spans?: StyleSpan[];
}

export type ResolvedStyle = Required<RunStyle>;

export const baseStyle = (ov: StyledBox): ResolvedStyle => ({
  fontFamily: ov.fontFamily,
  fontSize: ov.fontSize,
  fontWeight: ov.fontWeight,
  fontColor: ov.fontColor,
  italic: !!ov.italic,
  outlineColor: ov.outlineColor || '#000000',
  outlineWidth: ov.outlineWidth || 0,
});

const sameStyle = (a: RunStyle, b: RunStyle) => RUN_STYLE_KEYS.every(k => a[k] === b[k]);

// 구간 목록 <-> 글자마다의 덧붙인 모양. 글자 수가 많지 않아 글자 단위로 다루는 편이 단순하고 틀릴 일이 적다
const toChars = (len: number, spans: StyleSpan[] = []): RunStyle[] => {
  const chars: RunStyle[] = Array.from({ length: len }, () => ({}));
  for (const s of spans) {
    const { start, end, ...style } = s;
    for (let i = Math.max(0, start); i < Math.min(len, end); i++) chars[i] = { ...chars[i], ...style };
  }
  return chars;
};

// 상자 기본값과 같은 항목은 지우고, 이웃한 같은 모양끼리 하나로 묶는다
const toSpans = (chars: RunStyle[], base: ResolvedStyle): StyleSpan[] | undefined => {
  const spans: StyleSpan[] = [];
  chars.forEach((c, i) => {
    const style: RunStyle = {};
    for (const k of RUN_STYLE_KEYS) if (c[k] !== undefined && c[k] !== base[k]) (style as any)[k] = c[k];
    if (!Object.keys(style).length) return;
    const last = spans[spans.length - 1];
    if (last && last.end === i && sameStyle(last, style)) last.end = i + 1;
    else spans.push({ start: i, end: i + 1, ...style });
  });
  return spans.length ? spans : undefined;
};

// 한 글자의 실제 모양
export const styleAt = (ov: StyledBox, index: number): ResolvedStyle => {
  const base = baseStyle(ov);
  const span = ov.spans?.find(s => index >= s.start && index < s.end);
  if (!span) return base;
  const { start, end, ...style } = span;
  return { ...base, ...style };
};

// [start, end) 에 모양을 준다. 고른 글자가 없으면 상자 전체 기본값을 바꾸고, 그 항목은 일부 꾸밈에서도 지운다
export const applyRunStyle = <T extends StyledBox>(ov: T, start: number, end: number, patch: RunStyle): T => {
  const keys = (Object.keys(patch) as RunStyleKey[]).filter(k => RUN_STYLE_KEYS.includes(k));
  if (start >= end) {
    const next = { ...ov, ...patch };
    const chars = toChars(ov.newText.length, ov.spans).map(c => {
      const copy = { ...c };
      keys.forEach(k => delete copy[k]);
      return copy;
    });
    return { ...next, spans: toSpans(chars, baseStyle(next)) };
  }
  const chars = toChars(ov.newText.length, ov.spans);
  for (let i = Math.max(0, start); i < Math.min(chars.length, end); i++) chars[i] = { ...chars[i], ...patch };
  return { ...ov, spans: toSpans(chars, baseStyle(ov)) };
};

// 글자를 고치면 꾸민 구간을 따라 옮긴다. 새로 친 글자는 바로 앞 글자의 모양을 이어받는다
export const withNewText = <T extends StyledBox>(ov: T, text: string): T => {
  if (!ov.spans?.length || text === ov.newText) return { ...ov, newText: text };
  const old = ov.newText;
  let p = 0;
  while (p < old.length && p < text.length && old[p] === text[p]) p++;
  let s = 0;
  while (s < old.length - p && s < text.length - p && old[old.length - 1 - s] === text[text.length - 1 - s]) s++;
  const chars = toChars(old.length, ov.spans);
  const inherit = p > 0 ? chars[p - 1] : chars[old.length - s] || {};
  const inserted = Array.from({ length: text.length - p - s }, () => ({ ...inherit }));
  const next = [...chars.slice(0, p), ...inserted, ...chars.slice(old.length - s)];
  return { ...ov, newText: text, spans: toSpans(next, baseStyle(ov)) };
};

// 입력칸의 선택 범위 → 글자 선택. 하나도 안 고르거나 전부 고르면 상자 전체(null)로 본다
export const makeTextSelection = (id: string, start: number, end: number, length: number): TextSelection | null => {
  if (start > end) [start, end] = [end, start];
  return start === end || (start === 0 && end >= length) ? null : { id, start, end };
};
export const toTextSelection = (id: string, el: HTMLTextAreaElement): TextSelection | null =>
  makeTextSelection(id, el.selectionStart, el.selectionEnd, el.value.length);

// 모양이 같은 글자끼리 묶는다 (줄바꿈도 그대로 포함)
export const styleRuns = (ov: StyledBox): { text: string; style: ResolvedStyle }[] => {
  const runs: { text: string; style: ResolvedStyle }[] = [];
  for (let i = 0; i < ov.newText.length; i++) {
    const style = styleAt(ov, i);
    const last = runs[runs.length - 1];
    if (last && sameStyle(last.style, style)) last.text += ov.newText[i];
    else runs.push({ text: ov.newText[i], style });
  }
  return runs;
};

// 줄마다 가장 큰 글자 크기 (줄 높이 계산용)
export const lineFontSizes = (ov: StyledBox): number[] => {
  const sizes: number[] = [];
  let offset = 0;
  for (const line of ov.newText.split('\n')) {
    let max = 0;
    for (let i = 0; i < line.length; i++) max = Math.max(max, styleAt(ov, offset + i).fontSize);
    sizes.push(max || styleAt(ov, Math.max(0, offset - 1)).fontSize);
    offset += line.length + 1;
  }
  return sizes;
};

// 이 상자를 그리는 데 필요한 글꼴·두께 조합과 그 글꼴로 쓰는 글자
export const overlayFontRequests = (ov: StyledBox): [string, string, string][] => {
  const base: [string, string, string] = [ov.fontFamily, ov.fontWeight, ov.newText];
  if (!ov.spans?.length) return [base];
  const extra = ov.spans
    .filter(s => s.fontFamily || s.fontWeight)
    .map(s => [s.fontFamily || ov.fontFamily, s.fontWeight || ov.fontWeight, ov.newText.slice(s.start, s.end)] as [string, string, string]);
  return [base, ...extra];
};
