
import React, { useState, useEffect, useCallback } from 'react';
import { Rect, SlideData, TextOverlay, OCRResult, VerticalAlign, HorizontalAlign } from '../types';
import { analyzeTextInImage, rankFontSamples } from '../services/geminiService';
import { FONT_CATALOG, FontDef, FontMatch, getFontDef, fontStack, loadFont, matchFont, estimateTextColor, ensureFontCss, renderSampleSheet, parseWeight, MIN_WEIGHT, MAX_WEIGHT, PIXEL_SCALE_MIN } from '../services/fontService';
import { 
  Loader2, 
  Type as TypeIcon, 
  Info, 
  CheckCircle2, 
  Sliders, 
  Palette, 
  Bold, 
  Sparkles,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  MoveHorizontal,
  Trash2
} from 'lucide-react';

interface SidebarProps {
  activeSlide: SlideData | undefined;
  selection: Rect | null;
  selectedOverlayId: string | null;
  onApplyOverlay: (overlay: TextOverlay) => void;
  onUpdateOverlays: (overlays: TextOverlay[]) => void;
  onDeleteOverlay: (id: string) => void;
}

const FONT_GROUPS: { label: string; category: FontDef['category'] }[] = [
  { label: '고딕 (Sans)', category: 'sans' },
  { label: '명조 (Serif)', category: 'serif' },
  { label: '제목용 (Display)', category: 'display' },
  { label: '손글씨', category: 'hand' },
  { label: '고정폭', category: 'mono' },
];

const WEIGHT_LABELS: Record<string, string> = {
  '100': 'Thin', '200': 'ExtraLight', '300': 'Light', '400': 'Regular', '500': 'Medium',
  '600': 'SemiBold', '700': 'Bold', '800': 'ExtraBold', '900': 'Black', '1000': 'ExtraBlack', normal: 'Regular', bold: 'Bold',
};

const Sidebar: React.FC<SidebarProps> = ({ 
  activeSlide, 
  selection, 
  selectedOverlayId,
  onApplyOverlay,
  onUpdateOverlays,
  onDeleteOverlay
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  
  const [replacementText, setReplacementText] = useState('');
  const [fontSize, setFontSize] = useState(16);
  const [fontWeight, setFontWeight] = useState('400');
  const [fontColor, setFontColor] = useState('#000000');
  const [fontFamily, setFontFamily] = useState('Noto Sans KR');
  const [fontMatches, setFontMatches] = useState<FontMatch[]>([]);
  const [isMatching, setIsMatching] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  useEffect(() => { ensureFontCss(); }, []);
  const [vAlign, setVAlign] = useState<VerticalAlign>('top');
  const [hAlign, setHAlign] = useState<HorizontalAlign>('left');
  const [letterSpacing, setLetterSpacing] = useState(0);
  const [pixelScale, setPixelScale] = useState(1); // 실제 해상도 배율, 1 = 원래 해상도

  // 픽셀 조절 슬라이더 0~100% 는 실제 배율 97~100% 에 대응 (미세한 차이만 필요해서 이 구간을 넓게 펼친다)
  const sliderToPixelScale = (v: number) => PIXEL_SCALE_MIN + (1 - PIXEL_SCALE_MIN) * (v / 100);
  const pixelSlider = Math.round(Math.min(100, Math.max(0, ((pixelScale - PIXEL_SCALE_MIN) / (1 - PIXEL_SCALE_MIN)) * 100)));

  // 배경 관련 상태
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [isTransparent, setIsTransparent] = useState(false);

  const selectedOverlay = activeSlide?.overlays.find(o => o.id === selectedOverlayId);

  useEffect(() => {
    if (!selection && !selectedOverlayId) {
      setOcrResult(null);
      setFontMatches([]);
      setAnalyzeError(null);
      setReplacementText('');
      setBackgroundColor('#ffffff');
      setIsTransparent(false);
    }
  }, [selection, selectedOverlayId]);

  useEffect(() => {
    if (selectedOverlay) {
      setReplacementText(selectedOverlay.newText);
      setFontSize(selectedOverlay.fontSize);
      setFontWeight(selectedOverlay.fontWeight);
      setFontColor(selectedOverlay.fontColor);
      setFontFamily(selectedOverlay.fontFamily);
      setVAlign(selectedOverlay.vAlign || 'top');
      setHAlign(selectedOverlay.hAlign || 'left');
      setLetterSpacing(selectedOverlay.letterSpacing || 0);
      setPixelScale(selectedOverlay.pixelScale ?? 1);

      const bg = selectedOverlay.backgroundColor;
      if (bg === 'rgba(0,0,0,0)' || bg === 'transparent') {
        setIsTransparent(true);
      } else {
        setIsTransparent(false);
        setBackgroundColor(bg || '#ffffff');
      }
    }
    // 상자 자체가 바뀔 때마다(다른 상자 선택, 캔버스에서 더블클릭 수정, 실행 취소) 입력란을 맞춘다
  }, [selectedOverlayId, selectedOverlay]);

  // 로컬 캔버스에서 주변 배경색 추출 (Mode 알고리즘 사용)
  const detectBackgroundColor = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number): string => {
    try {
      const data = ctx.getImageData(0, 0, width, height).data;
      const colorCounts: { [key: string]: { count: number, r: number, g: number, b: number } } = {};
      
      const addPixel = (x: number, y: number) => {
        const i = (y * width + x) * 4;
        const r = data[i];
        const g = data[i+1];
        const b = data[i+2];
        const a = data[i+3];

        // 투명하거나 반투명한 픽셀 무시 (검정색으로 오인 방지)
        if (a < 50) return;

        // 색상 양자화 (Quantization) - 노이즈 제거 및 유사 색상 그룹화
        const bucket = 10; // 버킷 크기 줄임 (더 정밀하게)
        const key = `${Math.round(r / bucket)},${Math.round(g / bucket)},${Math.round(b / bucket)}`;

        if (!colorCounts[key]) {
          colorCounts[key] = { count: 0, r: 0, g: 0, b: 0 };
        }
        colorCounts[key].count++;
        colorCounts[key].r += r;
        colorCounts[key].g += g;
        colorCounts[key].b += b;
      };

      // 테두리 픽셀 샘플링 (깊이 5px - padding 영역을 커버)
      const depth = 5; 

      // 상하 테두리
      for (let x = 0; x < width; x++) {
        for (let y = 0; y < Math.min(depth, height); y++) addPixel(x, y);
        for (let y = Math.max(0, height - depth); y < height; y++) addPixel(x, y);
      }
      
      // 좌우 테두리
      for (let y = depth; y < height - depth; y++) {
        for (let x = 0; x < Math.min(depth, width); x++) addPixel(x, y);
        for (let x = Math.max(0, width - depth); x < width; x++) addPixel(x, y);
      }

      let maxCount = 0;
      let dominantColor = null;

      for (const key in colorCounts) {
        if (colorCounts[key].count > maxCount) {
          maxCount = colorCounts[key].count;
          dominantColor = {
            r: Math.round(colorCounts[key].r / maxCount),
            g: Math.round(colorCounts[key].g / maxCount),
            b: Math.round(colorCounts[key].b / maxCount)
          };
        }
      }

      // 유효한 색상이 없으면(모두 투명) 흰색 반환
      if (!dominantColor) return '#ffffff';

      const toHex = (c: number) => {
        const hex = c.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      };

      return `#${toHex(dominantColor.r)}${toHex(dominantColor.g)}${toHex(dominantColor.b)}`;
    } catch (e) {
      console.error("Color detection failed", e);
      return '#ffffff';
    }
  }, []);

  // 공통 이미지 크롭 및 캔버스 생성 함수 (Padding 옵션 추가)
  const getCroppedCanvas = async (usePadding = false) => {
    if (!selection || !activeSlide) return null;

    const padding = usePadding ? 10 : 0;
    
    // 이미지 범위 내로 좌표 제한 (Math.floor/ceil로 정수 좌표 보장)
    const startX = Math.max(0, Math.floor(selection.x - padding));
    const startY = Math.max(0, Math.floor(selection.y - padding));
    const endX = Math.min(activeSlide.width, Math.ceil(selection.x + selection.width + padding));
    const endY = Math.min(activeSlide.height, Math.ceil(selection.y + selection.height + padding));
    
    const width = endX - startX;
    const height = endY - startY;

    if (width <= 0 || height <= 0) return null;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const img = new Image();
    img.src = activeSlide.dataUrl;
    await new Promise(resolve => img.onload = resolve);

    ctx.drawImage(img, startX, startY, width, height, 0, 0, width, height);
    return { canvas, ctx, width, height };
  };

  // 선택 영역이 변경될 때마다 배경색 자동 감지
  useEffect(() => {
    if (selection && activeSlide && !selectedOverlayId) {
      const detect = async () => {
        try {
          // 배경색 감지 시에는 Padding을 사용하여 주변부를 샘플링
          const result = await getCroppedCanvas(true);
          if (!result) return;
          
          const detectedBg = detectBackgroundColor(result.ctx, result.width, result.height);
          setBackgroundColor(detectedBg);
          setIsTransparent(false); 
        } catch (e) {
          console.error(e);
        }
      };
      detect();
    }
  }, [selection, activeSlide, selectedOverlayId, detectBackgroundColor]);

  const handleAnalyze = async () => {
    if (!selection || !activeSlide) return;
    setIsAnalyzing(true);
    setAnalyzeError(null);
    try {
      // 1. 배경색 재확인 (Padding 포함)
      let detectedBg = backgroundColor;
      const bgResult = await getCroppedCanvas(true);
      if (bgResult) {
        detectedBg = detectBackgroundColor(bgResult.ctx, bgResult.width, bgResult.height);
        setBackgroundColor(detectedBg);
        setIsTransparent(false);
      }

      // 2. OCR 분석용 (Padding 없이 정확한 텍스트 영역)
      const ocrResultCanvas = await getCroppedCanvas(false);
      if (!ocrResultCanvas) return;

      const cropDataUrl = ocrResultCanvas.canvas.toDataURL('image/png');
      const cropPixels = ocrResultCanvas.ctx.getImageData(0, 0, ocrResultCanvas.width, ocrResultCanvas.height);
      const result = await analyzeTextInImage(cropDataUrl);
      const textColor = estimateTextColor(cropPixels, detectedBg, result.fontColor);

      setOcrResult(result);
      setReplacementText(result.text);
      setFontSize(result.fontSize);
      setFontColor(textColor);

      // AI가 고른 1순위 폰트를 먼저 적용해 두고, 픽셀 비교로 다시 고른다
      const aiFont = result.fontCandidates.find(id => getFontDef(id)) || 'Noto Sans KR';
      setFontFamily(aiFont);
      setFontWeight(result.fontWeight);
      loadFont(aiFont, result.fontWeight, result.text);

      setVAlign('middle');
      setHAlign('center');
      setLetterSpacing(0);
      setIsAnalyzing(false);

      // 3. 글씨체 매칭: 픽셀 비교로 후보를 추리고, AI가 견본과 원본을 눈으로 비교해 순서를 정한다
      setIsMatching(true);
      const matches = await matchFont(cropPixels, result.text, textColor, detectedBg, result.fontCandidates);
      // 후보 = 픽셀 비교 상위 4개 + AI가 처음에 짚은 폰트(AI가 본 두께에 가장 가까운 두께로)
      const nearestWeight = (id: string) => {
        const target = parseInt(result.fontWeight) || 400;
        const ws = getFontDef(id)?.weights || [400];
        return String(ws.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a)));
      };
      const hinted = result.fontCandidates
        .filter(id => getFontDef(id))
        .map(id => {
          const px = matches.find(m => m.fontFamily === id);
          return {
            fontSize: px?.fontSize ?? matches[0]?.fontSize ?? result.fontSize,
            letterSpacing: px?.letterSpacing ?? 0,
            fontFamily: id,
            fontWeight: nearestWeight(id),
            score: px?.score ?? 0,
          };
        });
      let shortlist = [...matches.slice(0, 4), ...hinted]
        .filter((m, i, arr) => arr.findIndex(o => o.fontFamily === m.fontFamily && o.fontWeight === m.fontWeight) === i)
        .slice(0, 7);
      await Promise.all(shortlist.map(m => loadFont(m.fontFamily, m.fontWeight, result.text)));
      if (shortlist.length > 1) {
        const sheet = renderSampleSheet(result.text, shortlist, textColor, detectedBg);
        const ranking = await rankFontSamples(cropDataUrl, sheet, shortlist.length);
        if (ranking.length) {
          const ranked = ranking.map((i, rank) => ({ ...shortlist[i], aiRank: rank }));
          shortlist = [...ranked, ...shortlist.filter((_, i) => !ranking.includes(i))];
        }
      }
      setFontMatches(shortlist.slice(0, 5));
      if (shortlist[0]) applyMatch(shortlist[0]);
    } catch (err) {
      console.error(err);
      const msg = String((err as Error)?.message ?? err);
      setAnalyzeError(
        /PerDay/i.test(msg) ? 'Gemini 하루 사용량 한도를 넘었어요. 무료 등급은 하루 20회까지라 내일 다시 시도하거나 API 결제 설정이 필요해요.'
        : /RESOURCE_EXHAUSTED|quota|429/i.test(msg) ? '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.'
        : /UNAVAILABLE|503|high demand/i.test(msg) ? 'Gemini 서버가 혼잡해요. 잠시 후 다시 시도해 주세요.'
        : /API key|API_KEY|401|403/i.test(msg) ? 'API 키가 올바르지 않아요. .env.local 의 GEMINI_API_KEY 를 확인해 주세요.'
        : 'AI 분석에 실패했어요. 잠시 후 다시 시도해 주세요.'
      );
    } finally {
      setIsAnalyzing(false);
      setIsMatching(false);
    }
  };

  const applyMatch = (m: FontMatch) => {
    setFontFamily(m.fontFamily);
    setFontWeight(m.fontWeight);
    setFontSize(m.fontSize);
    setLetterSpacing(m.letterSpacing);
    if (selectedOverlayId) {
      updateSelectedOverlay({ fontFamily: m.fontFamily, fontWeight: m.fontWeight, fontSize: m.fontSize, letterSpacing: m.letterSpacing });
    }
  };

  const weightValue = parseWeight(fontWeight);
  const fontDef = getFontDef(fontFamily);
  const weightLabel = WEIGHT_LABELS[String(Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, Math.round(weightValue / 100) * 100)))];

  const changeWeight = (value: number) => {
    const w = String(Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, Math.round(value / 10) * 10)));
    setFontWeight(w);
    loadFont(fontFamily, w, replacementText);
    if (isEditing) updateSelectedOverlay({ fontWeight: w });
    return w;
  };

  const updateSelectedOverlay = (updates: Partial<TextOverlay>) => {
    if (!selectedOverlayId || !activeSlide) return;
    const newOverlays = activeSlide.overlays.map(ov => 
      ov.id === selectedOverlayId ? { ...ov, ...updates } : ov
    );
    onUpdateOverlays(newOverlays);
  };

  const handleApply = () => {
    if (!selection) return;
    onApplyOverlay({
      id: Math.random().toString(36).substr(2, 9),
      rect: { ...selection },
      originalText: ocrResult?.text || '',
      newText: replacementText,
      fontSize,
      fontWeight,
      fontColor,
      fontFamily,
      backgroundColor: isTransparent ? 'rgba(0,0,0,0)' : backgroundColor,
      vAlign,
      hAlign,
      letterSpacing,
      pixelScale
    });
  };

  const isEditing = !!selectedOverlayId;

  return (
    <div className="w-80 h-full bg-[#1e293b] border-l border-slate-700 flex flex-col p-6 overflow-y-auto">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <TypeIcon size={16} className="text-blue-400" />
          {isEditing ? '텍스트 수정' : '텍스트 교체'}
        </h2>
        {isEditing && selectedOverlayId && (
          <button
            onClick={() => onDeleteOverlay(selectedOverlayId)}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-slate-400 hover:text-rose-400 hover:bg-rose-900/20 transition-colors"
            title="텍스트 상자 삭제 (Delete)"
          >
            <Trash2 size={13} /> 삭제
          </button>
        )}
      </div>
      {isEditing && (
        <p className="-mt-4 mb-5 text-[11px] text-slate-500 leading-relaxed">
          글자를 더블클릭하면 그 자리에서 바로 고칠 수 있어요. <span className="text-slate-400">방향키</span>로 1px, <span className="text-slate-400">Shift+방향키</span>로 10px씩 옮기고, <span className="text-slate-400">Delete</span> 키로 삭제해요.
        </p>
      )}

      {!selection && !isEditing ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400">
          <div className="w-16 h-16 rounded-xl bg-slate-800 flex items-center justify-center mb-4 border border-slate-700">
            <Info size={32} className="opacity-50" />
          </div>
          <p className="text-sm"><span className="text-blue-400 font-bold">Ctrl + 드래그</span>로 교체할 영역을 선택하거나<br/>교체된 텍스트를 클릭하세요</p>
        </div>
      ) : (
        <div className="space-y-6">
          {!isEditing && (
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">AI 텍스트 분석</h3>
              {isAnalyzing ? (
                <div className="flex items-center gap-3 py-4 text-blue-400">
                  <Loader2 className="animate-spin" size={18} />
                  <span className="text-sm">분석 중...</span>
                </div>
              ) : ocrResult ? (
                <div className="space-y-3">
                  <div className="p-3 bg-slate-900 rounded text-sm text-slate-300 italic border border-slate-800 whitespace-pre-wrap">"{ocrResult.text}"</div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">비슷한 글씨체</div>
                    {isMatching ? (
                      <div className="flex items-center gap-2 text-xs text-blue-400 py-2">
                        <Loader2 className="animate-spin" size={14} /> 글씨체 비교 중...
                      </div>
                    ) : fontMatches.length === 0 ? (
                      <div className="text-xs text-slate-500">매칭 결과가 없습니다</div>
                    ) : (
                      <div className="space-y-1.5">
                        {Math.max(...fontMatches.map(m => m.score)) < 0.6 && (
                          <p className="text-[11px] leading-snug text-amber-400/90 pb-1">
                            배경이 복잡하거나 글씨가 작아서 정확도가 낮을 수 있어요. 아래 견본을 원본과 눈으로 비교해 골라 보세요.
                          </p>
                        )}
                        {fontMatches.map(m => {
                          const active = m.fontFamily === fontFamily && m.fontWeight === fontWeight;
                          return (
                            <button
                              key={m.fontFamily}
                              onClick={() => applyMatch(m)}
                              className={`w-full text-left px-3 py-2 rounded-lg border transition-all ${active ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 bg-slate-900 hover:border-slate-500'}`}
                            >
                              <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                                <span className="flex items-center gap-1.5">
                                  {getFontDef(m.fontFamily)?.name} · {WEIGHT_LABELS[m.fontWeight] || m.fontWeight}
                                  {m.aiRank === 0 && <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[9px] font-bold">AI 추천</span>}
                                </span>
                                <span className={active ? 'text-blue-400' : ''} title="픽셀 비교 일치율">{Math.round(m.score * 100)}%</span>
                              </div>
                              <div
                                className="text-base text-slate-100 truncate"
                                style={{ fontFamily: fontStack(m.fontFamily), fontWeight: Number(m.fontWeight) }}
                              >
                                {ocrResult.text.split('\n')[0]}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={handleAnalyze}
                    className="w-full bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all"
                  >
                    <Sparkles size={14} className="text-blue-400" /> AI 분석 (OCR) 실행
                  </button>
                  {analyzeError && <p className="text-[11px] leading-snug text-rose-400">{analyzeError}</p>}
                </div>
              )}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">내용</label>
              <textarea 
                value={replacementText} 
                onChange={(e) => {
                  setReplacementText(e.target.value);
                  if (isEditing) updateSelectedOverlay({ newText: e.target.value });
                }} 
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm h-24 resize-none focus:outline-none focus:border-blue-500 text-slate-200" 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">수평 정렬</label>
                <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
                  <button onClick={() => { setHAlign('left'); if (isEditing) updateSelectedOverlay({ hAlign: 'left' }); }} className={`flex-1 p-1.5 rounded flex justify-center ${hAlign === 'left' ? 'bg-slate-700 text-blue-400' : 'text-slate-500'}`}><AlignLeft size={16} /></button>
                  <button onClick={() => { setHAlign('center'); if (isEditing) updateSelectedOverlay({ hAlign: 'center' }); }} className={`flex-1 p-1.5 rounded flex justify-center ${hAlign === 'center' ? 'bg-slate-700 text-blue-400' : 'text-slate-500'}`}><AlignCenter size={16} /></button>
                  <button onClick={() => { setHAlign('right'); if (isEditing) updateSelectedOverlay({ hAlign: 'right' }); }} className={`flex-1 p-1.5 rounded flex justify-center ${hAlign === 'right' ? 'bg-slate-700 text-blue-400' : 'text-slate-500'}`}><AlignRight size={16} /></button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">수직 정렬</label>
                <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
                  <button onClick={() => { setVAlign('top'); if (isEditing) updateSelectedOverlay({ vAlign: 'top' }); }} className={`flex-1 p-1.5 rounded flex justify-center ${vAlign === 'top' ? 'bg-slate-700 text-blue-400' : 'text-slate-500'}`} title="위쪽"><AlignVerticalJustifyStart size={16} /></button>
                  <button onClick={() => { setVAlign('middle'); if (isEditing) updateSelectedOverlay({ vAlign: 'middle' }); }} className={`flex-1 p-1.5 rounded flex justify-center ${vAlign === 'middle' ? 'bg-slate-700 text-blue-400' : 'text-slate-500'}`} title="가운데"><AlignVerticalJustifyCenter size={16} /></button>
                  <button onClick={() => { setVAlign('bottom'); if (isEditing) updateSelectedOverlay({ vAlign: 'bottom' }); }} className={`flex-1 p-1.5 rounded flex justify-center ${vAlign === 'bottom' ? 'bg-slate-700 text-blue-400' : 'text-slate-500'}`} title="아래쪽"><AlignVerticalJustifyEnd size={16} /></button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">글꼴</label>
              <select 
                value={fontFamily}
                onChange={(e) => {
                  // 두께는 슬라이더 값을 그대로 유지 (고정 두께 글꼴은 그리는 쪽에서 보정)
                  const family = e.target.value;
                  setFontFamily(family);
                  loadFont(family, fontWeight, replacementText);
                  if (isEditing) updateSelectedOverlay({ fontFamily: family });
                }}
                style={{ fontFamily: fontStack(fontFamily) }}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              >
                {!getFontDef(fontFamily) && <option value={fontFamily}>{fontFamily}</option>}
                {FONT_GROUPS.map(g => (
                  <optgroup key={g.category} label={g.label}>
                    {FONT_CATALOG.filter(f => f.category === g.category).map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">크기</label>
                <input 
                  type="number" 
                  value={fontSize} 
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setFontSize(val);
                    if (isEditing) updateSelectedOverlay({ fontSize: val });
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" 
                />
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">글자 색상</label>
                <div className="flex gap-2 items-center bg-slate-900 border border-slate-700 rounded-lg px-2 py-1">
                  <input 
                    type="color" 
                    value={fontColor} 
                    onChange={(e) => {
                      setFontColor(e.target.value);
                      if (isEditing) updateSelectedOverlay({ fontColor: e.target.value });
                    }}
                    className="w-8 h-8 bg-transparent cursor-pointer"
                  />
                  <span className="text-[10px] font-mono text-slate-400 uppercase">{fontColor}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
               <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">배경 색상 (Background)</label>
               <div className="flex items-center justify-between bg-slate-900 border border-slate-700 rounded-lg px-3 py-2">
                 <div className="flex items-center gap-3">
                   <div className="relative flex items-center">
                     <input 
                       type="color" 
                       value={backgroundColor}
                       disabled={isTransparent}
                       onChange={(e) => {
                         setBackgroundColor(e.target.value);
                         if (isEditing) updateSelectedOverlay({ backgroundColor: e.target.value });
                       }}
                       className={`w-6 h-6 bg-transparent border-none p-0 cursor-pointer ${isTransparent ? 'opacity-20 cursor-not-allowed' : ''}`}
                     />
                     {isTransparent && <div className="absolute inset-0 bg-slate-900/50 pointer-events-none" />}
                   </div>
                   <span className={`text-xs font-mono uppercase ${isTransparent ? 'text-slate-600' : 'text-slate-300'}`}>
                     {backgroundColor}
                   </span>
                 </div>
                 
                 <label className="flex items-center gap-2 cursor-pointer group select-none">
                   <input 
                     type="checkbox" 
                     checked={isTransparent}
                     onChange={(e) => {
                       const checked = e.target.checked;
                       setIsTransparent(checked);
                       if (isEditing) {
                         updateSelectedOverlay({ backgroundColor: checked ? 'rgba(0,0,0,0)' : backgroundColor });
                       }
                     }}
                     className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-0 focus:ring-offset-0 transition-colors group-hover:border-slate-500"
                   />
                   <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors">투명</span>
                 </label>
               </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">두께</label>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400">{weightLabel}</span>
                  {/* 입력 중에는 그대로 두고 Enter·포커스 아웃 때 적용 (한 글자마다 범위 보정되면 입력이 안 됨) */}
                  <input
                    key={weightValue}
                    type="number"
                    min={MIN_WEIGHT}
                    max={MAX_WEIGHT}
                    step={10}
                    defaultValue={weightValue}
                    onBlur={(e) => { const v = parseInt(e.target.value, 10); e.target.value = Number.isFinite(v) ? changeWeight(v) : String(weightValue); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-right text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <input
                type="range"
                min={MIN_WEIGHT}
                max={MAX_WEIGHT}
                step={10}
                value={weightValue}
                onChange={(e) => changeWeight(Number(e.target.value))}
                className="w-full accent-blue-500 cursor-pointer"
                aria-label="글자 두께"
              />
              {/* 글꼴이 원래 가진 두께 위치 — 누르면 그 값으로 맞춘다 */}
              <div className="relative h-4 mx-[7px]">
                {(fontDef?.weights || []).map(w => (
                  <button
                    key={w}
                    onClick={() => changeWeight(w)}
                    title={`${WEIGHT_LABELS[String(w)] || w} (${w})`}
                    className={`absolute -translate-x-1/2 top-0 w-2 h-2 rounded-full transition-colors ${w === weightValue ? 'bg-blue-400' : 'bg-slate-600 hover:bg-slate-400'}`}
                    style={{ left: `${((w - MIN_WEIGHT) / (MAX_WEIGHT - MIN_WEIGHT)) * 100}%` }}
                  />
                ))}
              </div>
              <p className="text-[10px] text-slate-500 leading-snug">
                {fontDef?.variable
                  ? '가변 글꼴이라 모든 값이 그대로 적용돼요.'
                  : '점은 글꼴의 기본 두께예요. 사이 값은 획을 덧칠해 보정해요.'}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">픽셀 조절</label>
                <span className="text-xs text-slate-300 tabular-nums">
                  {pixelSlider}%
                  <span className="text-slate-500"> · {pixelScale >= 1 ? '원래 해상도' : `실제 ${(pixelScale * 100).toFixed(2)}%`}</span>
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={pixelSlider}
                onChange={(e) => {
                  const v = sliderToPixelScale(Number(e.target.value));
                  setPixelScale(v);
                  if (isEditing) updateSelectedOverlay({ pixelScale: v });
                }}
                className="w-full accent-blue-500 cursor-pointer"
                aria-label="픽셀 조절"
              />
              <p className="text-[10px] text-slate-500 leading-snug">
                낮출수록 글자를 낮은 해상도로 그려서 원본 이미지의 뭉개진 글자처럼 보여요. 0%가 실제 해상도 97%예요.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">자간 (Spacing)</label>
                <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg px-2">
                  <MoveHorizontal size={14} className="text-slate-500 mr-2" />
                  <input 
                    type="number" 
                    step="0.1"
                    value={letterSpacing} 
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setLetterSpacing(val);
                      if (isEditing) updateSelectedOverlay({ letterSpacing: val });
                    }}
                    className="w-full bg-transparent py-2 text-sm focus:outline-none" 
                  />
                </div>
              </div>
            </div>

            {!isEditing && (
              <button 
                onClick={handleApply} 
                disabled={!selection} 
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 mt-2 shadow-lg active:scale-95 transition-all"
              >
                <CheckCircle2 size={18} /> 텍스트 적용
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
