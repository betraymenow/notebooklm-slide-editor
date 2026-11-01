
import React, { useState, useEffect, useRef } from 'react';
import { SlideData, Rect, TextOverlay } from './types';
import { convertPdfToImages, downloadAsPdf } from './services/pdfService';
import EditorCanvas, { toggleEditorFullscreen } from './components/EditorCanvas';
import Sidebar from './components/Sidebar';
import ImageTools from './components/ImageTools';
import { CropAspect, ImageTransform, aspectRatio, cropSlide, initialCropRect, transformSlide } from './services/imageTransform';
import { drawOverlayText, loadFont } from './services/fontService';
import { NUDGE_STEP, NUDGE_STEP_FAST } from './constants';
import { 
  FileUp, 
  Download, 
  FileText, 
  ChevronLeft, 
  ChevronRight, 
  Trash2, 
  History,
  Image as ImageIcon,
  Maximize
} from 'lucide-react';

const ARROW_DELTA: Record<string, [number, number]> = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
};

// 왼쪽 도구 열의 조작 안내 (자르기 중에는 자르기 조작으로 바뀐다)
const HINTS: [string, string][] = [['Drag', '이미지 이동'], ['Wheel', '확대 / 축소'], ['Ctrl + Drag', '영역 선택']];
const CROP_HINTS: [string, string][] = [['모서리 Drag', '크기 조절'], ['안쪽 Drag', '영역 옮기기'], ['Wheel', '확대 / 축소']];

// 상단 '파일 업로드'·'전체화면' 버튼 공통 모양 (크기·글씨 동일)
const HEADER_TOOL_BTN = 'w-[136px] flex items-center justify-center gap-2 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-sm font-medium whitespace-nowrap border border-slate-600';

const PASTE_OFFSET = 20; // 붙여넣은 텍스트 상자가 원본에서 비켜나는 거리 (이미지 픽셀)

const App: React.FC = () => {
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);
  const [selection, setSelection] = useState<Rect | null>(null);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // ---------- 실행 취소 기록 ----------
  // 바뀌기 전 슬라이드 상태를 쌓아 두고 Ctrl+Z 때 하나씩 되돌린다
  const slidesRef = useRef(slides);
  slidesRef.current = slides;
  const historyRef = useRef<{ slides: SlideData[]; slideIdx: number }[]>([]);
  const lastChangeRef = useRef({ key: '', time: 0 });
  const [canUndo, setCanUndo] = useState(false);

  /**
   * 슬라이드를 바꾸면서 직전 상태를 기록한다.
   * coalesce: 드래그·슬라이더·타이핑처럼 연속으로 들어오는 변경은 1초 안이면 한 번으로 묶는다.
   */
  const commitSlides = (next: (prev: SlideData[]) => SlideData[], key: string, coalesce = false) => {
    const prev = slidesRef.current;
    const now = Date.now();
    const last = lastChangeRef.current;
    if (!(coalesce && last.key === key && now - last.time < 1000)) {
      historyRef.current.push({ slides: prev, slideIdx: activeSlideIdx });
      if (historyRef.current.length > 100) historyRef.current.shift();
      setCanUndo(true);
    }
    lastChangeRef.current = { key, time: now };
    const updated = next(prev);
    slidesRef.current = updated; // 같은 틱에 연달아 호출돼도 이어서 적용되도록
    setSlides(updated);
  };

  const handleUndo = () => {
    const entry = historyRef.current.pop();
    if (!entry) return;
    slidesRef.current = entry.slides;
    setSlides(entry.slides);
    setActiveSlideIdx(entry.slideIdx);
    lastChangeRef.current = { key: '', time: 0 };
    setCanUndo(historyRef.current.length > 0);
    const restored = entry.slides[entry.slideIdx];
    if (!restored?.overlays.some(o => o.id === selectedOverlayId)) setSelectedOverlayId(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 같은 파일을 다시 골라도 change 이벤트가 나도록
    if (file) loadFile(file);
  };

  // 창 어디에 떨어뜨려도 받는다. 기본 동작(브라우저가 파일을 새로 여는 것)은 막는다
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files');
    const onDragEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth++;
      setIsDragging(true);
    };
    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.dataTransfer!.dropEffect = 'copy';
    };
    const onDragLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setIsDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setIsDragging(false);
      const file = e.dataTransfer?.files[0];
      if (file) loadFile(file);
    };
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  // 탐색기 "연결 프로그램"으로 열었을 때: 주소의 ?open=<토큰> 으로 넘겨받은 파일을 연다
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('open');
    if (!token || !/^[0-9a-f]{32}$/.test(token)) return;
    window.history.replaceState(null, '', window.location.pathname); // 새로고침해도 다시 받지 않도록
    fetch(`/__slide-editor/inbox/${token}`)
      .then(res => (res.ok ? res.blob() : Promise.reject(new Error(String(res.status)))))
      .then(blob => loadFile(new File([blob], blob.type === 'application/pdf' ? 'opened.pdf' : 'opened', { type: blob.type })))
      .catch(() => alert('연결 프로그램으로 연 파일을 불러오지 못했습니다. 다시 열어 주세요.'));
  }, []);

  const loadFile = async (file: File) => {
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    if (!isPdf && !file.type.startsWith('image/')) {
      alert('PDF 또는 이미지 파일만 불러올 수 있습니다.');
      return;
    }
    setIsProcessing(true);
    historyRef.current = []; // 새 파일이면 이전 기록은 버린다
    setCanUndo(false);
    try {
      if (isPdf) {
        const converted = await convertPdfToImages(file);
        setSlides(converted);
      } else if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const img = new Image();
          img.onload = () => {
            setSlides([{
              index: 0,
              dataUrl: ev.target?.result as string,
              width: img.width,
              height: img.height,
              overlays: []
            }]);
          };
          img.src = ev.target?.result as string;
        };
        reader.readAsDataURL(file);
      }
      setActiveSlideIdx(0);
      setSelectedOverlayId(null);
      setSelection(null);
    } catch (err) {
      console.error(err);
      alert('파일 변환 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  const updateActiveOverlays = (fn: (overlays: TextOverlay[]) => TextOverlay[]) => (prev: SlideData[]) =>
    prev.map((s, idx) => (idx === activeSlideIdx ? { ...s, overlays: fn(s.overlays) } : s));

  const handleApplyOverlay = (overlay: TextOverlay) => {
    commitSlides(updateActiveOverlays(ovs => [...ovs, overlay]), 'apply');
    setSelection(null);
    setSelectedOverlayId(overlay.id);
  };

  const handleUpdateOverlays = (overlays: TextOverlay[]) => {
    commitSlides(updateActiveOverlays(() => overlays), `update:${activeSlideIdx}`, true);
  };

  const handleDeleteOverlay = (id: string) => {
    commitSlides(updateActiveOverlays(ovs => ovs.filter(o => o.id !== id)), 'delete');
    setSelectedOverlayId(null);
  };

  const handleClearOverlays = () => {
    if (!slides[activeSlideIdx]?.overlays.length) return;
    commitSlides(updateActiveOverlays(() => []), 'clear');
    setSelectedOverlayId(null);
  };

  // ---------- 이미지 자르기·회전 ----------
  const activeSlide = slides[activeSlideIdx];
  const [cropAspect, setCropAspect] = useState<CropAspect | null>(null); // null = 자르기 안 함
  const [cropRect, setCropRect] = useState<Rect | null>(null);
  const [isTransforming, setIsTransforming] = useState(false);

  const resetCrop = () => {
    if (!cropAspect || !activeSlide) { setCropRect(null); return; }
    setCropRect(initialCropRect(activeSlide.width, activeSlide.height, aspectRatio(cropAspect)));
  };
  // 비율을 바꾸거나, 슬라이드를 넘기거나, 이미지가 바뀌면(자르기·회전·실행 취소) 자를 영역을 새로 잡는다
  useEffect(resetCrop, [cropAspect, activeSlideIdx, activeSlide?.dataUrl]);

  const handleCropAspectChange = (aspect: CropAspect | null) => {
    setCropAspect(aspect);
    if (aspect) { setSelection(null); setSelectedOverlayId(null); }
  };

  // 이미지를 바꾸는 작업은 비동기라, 끝났을 때의 슬라이드 번호에 넣는다
  const replaceActiveSlide = async (make: (s: SlideData) => Promise<SlideData>, key: string) => {
    if (!activeSlide || isTransforming) return;
    const idx = activeSlideIdx;
    setIsTransforming(true);
    try {
      const next = await make(activeSlide);
      commitSlides(prev => prev.map((s, i) => (i === idx ? next : s)), key);
      setSelectedOverlayId(null);
    } catch (err) {
      console.error(err);
      alert('이미지를 바꾸는 중 오류가 발생했습니다.');
    } finally {
      setIsTransforming(false);
    }
  };

  const handleApplyCrop = () => { if (cropRect) replaceActiveSlide(s => cropSlide(s, cropRect), 'crop'); };
  const handleTransform = (op: ImageTransform) => replaceActiveSlide(s => transformSlide(s, op), op);

  // ---------- 텍스트 상자 복사·붙여넣기 ----------
  // 앱 안에서만 쓰는 클립보드: 글자 설정과 상자 크기만 가져가고, 붙여넣으면 글자는 빈칸이다
  const copiedOverlayRef = useRef<TextOverlay | null>(null);
  const pasteCountRef = useRef(0);
  const [editRequestId, setEditRequestId] = useState<string | null>(null);

  const handleCopyOverlay = (id: string) => {
    const ov = slidesRef.current[activeSlideIdx]?.overlays.find(o => o.id === id);
    if (!ov) return;
    copiedOverlayRef.current = { ...ov, rect: { ...ov.rect } };
    pasteCountRef.current = 0;
  };

  const handlePasteOverlay = () => {
    const src = copiedOverlayRef.current;
    const slide = slidesRef.current[activeSlideIdx];
    if (!src || !slide) return;
    // 같은 자리에 겹치지 않게 붙일 때마다 20px 씩 오른쪽 아래로 (슬라이드 밖으로는 안 나가게)
    pasteCountRef.current += 1;
    const off = PASTE_OFFSET * pasteCountRef.current;
    const x = Math.min(src.rect.x + off, Math.max(0, slide.width - src.rect.width));
    const y = Math.min(src.rect.y + off, Math.max(0, slide.height - src.rect.height));
    const pasted: TextOverlay = {
      ...src,
      id: Math.random().toString(36).slice(2, 11),
      rect: { ...src.rect, x, y },
      newText: '',
      originalText: '',
    };
    commitSlides(updateActiveOverlays(ovs => [...ovs, pasted]), 'paste');
    setSelection(null);
    setSelectedOverlayId(pasted.id);
    setEditRequestId(pasted.id); // 붙이자마자 그 자리에서 글자를 입력하도록
  };

  // 단축키: Delete = 선택한 텍스트 상자 삭제, Ctrl+Z = 실행 취소, Ctrl+C/V = 상자 복사·붙여넣기
  // (글자 입력 중에는 입력란 기본 동작에 맡긴다)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable) return;
      const mod = (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey;
      // e.code 로 판단해야 한글 입력 상태(ㅋ, ㅊ, ㅍ)에서도 동작한다
      if (mod && e.code === 'KeyZ') {
        e.preventDefault();
        handleUndo();
      } else if (mod && e.code === 'KeyC' && selectedOverlayId) {
        e.preventDefault();
        handleCopyOverlay(selectedOverlayId);
      } else if (mod && e.code === 'KeyV' && copiedOverlayRef.current) {
        e.preventDefault();
        handlePasteOverlay();
      } else if (e.key === 'PageUp' || e.key === 'PageDown') {
        e.preventDefault();
        const last = slidesRef.current.length - 1;
        setActiveSlideIdx(i => Math.min(last, Math.max(0, i + (e.key === 'PageDown' ? 1 : -1))));
      } else if (e.key === 'Delete' && selectedOverlayId) {
        e.preventDefault();
        handleDeleteOverlay(selectedOverlayId);
      } else if (selectedOverlayId && ARROW_DELTA[e.code]) {
        // 방향키 = 선택한 텍스트 상자 1px 이동 (Shift 는 10px). 누르고 있는 동안은 실행 취소 한 번으로 묶인다
        e.preventDefault();
        const step = e.shiftKey ? NUDGE_STEP_FAST : NUDGE_STEP;
        const [dx, dy] = ARROW_DELTA[e.code];
        commitSlides(
          updateActiveOverlays(ovs => ovs.map(o => o.id === selectedOverlayId
            ? { ...o, rect: { ...o.rect, x: o.rect.x + dx * step, y: o.rect.y + dy * step } }
            : o)),
          `nudge:${selectedOverlayId}`,
          true,
        );
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedOverlayId, activeSlideIdx]);

  const handleDownloadImages = async () => {
    await Promise.all(slides.flatMap(s => s.overlays.map(ov => loadFont(ov.fontFamily, ov.fontWeight, ov.newText))));
    slides.forEach((slide, i) => {
      const canvas = document.createElement('canvas');
      canvas.width = slide.width;
      canvas.height = slide.height;
      const ctx = canvas.getContext('2d')!;
      const img = new Image();
      img.src = slide.dataUrl;
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        
        slide.overlays.forEach(ov => {
          ctx.fillStyle = ov.backgroundColor;
          ctx.fillRect(ov.rect.x, ov.rect.y, ov.rect.width, ov.rect.height);
          
          drawOverlayText(ctx, ov);
        });

        setTimeout(() => {
          const link = document.createElement('a');
          link.href = canvas.toDataURL('image/png');
          link.download = `edited_slide_${i + 1}.png`;
          link.click();
        }, 100);
      };
    });
  };

  const handleDownloadPdf = () => {
    if (slides.length === 0) return;
    downloadAsPdf(slides, 'edited_slides.pdf');
  };

  return (
    <div className="flex flex-col h-screen bg-[#0f172a] text-slate-100 font-sans">
      <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-[#1e293b] shrink-0">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600 p-2 rounded-lg"><FileText size={20} /></div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Slide Editor</h1>
            <p className="text-[9px] text-slate-500 uppercase tracking-widest font-black">AI Power</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className={`${HEADER_TOOL_BTN} cursor-pointer`}>
            <FileUp size={18} /><span>파일 업로드</span>
            <input type="file" accept=".pdf,image/*" className="hidden" onChange={handleFileUpload} />
          </label>
          <button onClick={toggleEditorFullscreen} disabled={slides.length === 0} title="이미지를 모니터 전체화면으로 (에디터에서 우클릭해도 전환)" className={`${HEADER_TOOL_BTN} disabled:opacity-50 disabled:hover:bg-slate-700`}>
            <Maximize size={18} /><span>전체화면</span>
          </button>
          <div className="w-px h-6 bg-slate-700 mx-2"></div>
          <button onClick={handleDownloadImages} disabled={slides.length === 0} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded-lg text-sm border border-slate-700 transition-all">
            <Download size={18} /><span>이미지 저장</span>
          </button>
          <button onClick={handleDownloadPdf} disabled={slides.length === 0} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-bold shadow-lg border border-blue-500/50">
            <FileText size={18} /><span>PDF 다운로드</span>
          </button>
        </div>
      </header>
      <main className="flex flex-1 overflow-hidden">
        <aside className="w-[120px] border-r border-slate-700 bg-[#1e293b] flex flex-col p-3 gap-4 shrink-0">
          <div className="flex flex-col gap-2">
            <button onClick={handleUndo} disabled={!canUndo} className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700 hover:bg-slate-700 text-slate-300 text-xs font-medium disabled:opacity-30 disabled:hover:bg-slate-800/50" title="실행 취소 (Ctrl+Z)"><History size={18} />실행 취소</button>
            <button onClick={handleClearOverlays} className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700 hover:bg-red-900/20 hover:text-red-400 text-slate-300 text-xs font-medium" title="이 슬라이드의 텍스트 상자 전체 삭제"><Trash2 size={18} />전체 삭제</button>
          </div>
          {slides.length > 1 && (
            // 여러 장(PDF)일 때만 페이지 이동. PageUp / PageDown 키로도 넘긴다
            <div className="flex items-center justify-center gap-4 text-slate-300">
              <button disabled={activeSlideIdx === 0} onClick={() => setActiveSlideIdx(prev => prev - 1)} className="p-1 hover:bg-slate-700 rounded-full disabled:opacity-20" title="이전 페이지 (PageUp)"><ChevronLeft size={20} /></button>
              <span className="text-sm font-black text-white">{activeSlideIdx + 1} / {slides.length}</span>
              <button disabled={activeSlideIdx === slides.length - 1} onClick={() => setActiveSlideIdx(prev => prev + 1)} className="p-1 hover:bg-slate-700 rounded-full disabled:opacity-20" title="다음 페이지 (PageDown)"><ChevronRight size={20} /></button>
            </div>
          )}
          {slides.length > 0 && (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 px-3 py-3 flex flex-col gap-3">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">조작 방법</h3>
              {(cropRect ? CROP_HINTS : HINTS).map(([key, label]) => (
                <div key={key} className="flex flex-col items-start gap-1 text-xs">
                  <span className="bg-slate-700 px-1.5 py-0.5 rounded text-[10px] text-blue-400 font-bold whitespace-nowrap">{key}</span>
                  <span className="text-slate-300">{label}</span>
                </div>
              ))}
            </div>
          )}
        </aside>
        <div className="flex-1 min-w-0 flex flex-col bg-slate-950 relative">
          {isProcessing ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-slate-400 font-medium">변환 중...</p>
            </div>
          ) : slides.length > 0 ? (
            <>
              <EditorCanvas 
                slide={slides[activeSlideIdx]} 
                selectedOverlayId={selectedOverlayId}
                onSelectionChange={(rect) => { setSelection(rect); if (rect) setSelectedOverlayId(null); }} 
                onOverlaySelect={setSelectedOverlayId}
                onUpdateOverlays={handleUpdateOverlays}
                editRequestId={editRequestId}
                onEditRequestHandled={() => setEditRequestId(null)}
                cropRect={cropRect}
                cropRatio={cropAspect ? aspectRatio(cropAspect) : null}
                onCropChange={setCropRect}
              />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 text-center">
              <div className="w-40 h-40 mb-10 bg-slate-900 rounded-[2.5rem] flex items-center justify-center border-2 border-dashed border-slate-800"><ImageIcon size={64} className="opacity-10" /></div>
              <h3 className="text-2xl font-black text-slate-200 mb-3 tracking-tight">AI 슬라이드 에디터</h3>
              <p className="text-slate-500 max-w-xs mx-auto text-sm leading-relaxed mb-10">PDF 또는 이미지를 업로드하거나 이 창에 끌어다 놓아 지능형 텍스트 교체를 시작하세요.</p>
              <label className="px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black cursor-pointer shadow-2xl">
                파일 선택
                <input type="file" accept=".pdf,image/*" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
          )}
        </div>
        <div className="w-72 h-full bg-[#1e293b] border-l border-slate-700 flex flex-col shrink-0">
        {activeSlide && (
          <ImageTools
            slide={activeSlide}
            cropAspect={cropAspect}
            cropRect={cropRect}
            busy={isTransforming}
            onCropAspectChange={handleCropAspectChange}
            onCropChange={setCropRect}
            onApplyCrop={handleApplyCrop}
            onResetCrop={resetCrop}
            onTransform={handleTransform}
          />
        )}
        <Sidebar 
          activeSlide={slides[activeSlideIdx]} 
          selection={selection} 
          selectedOverlayId={selectedOverlayId}
          onApplyOverlay={handleApplyOverlay}
          onUpdateOverlays={handleUpdateOverlays}
          onDeleteOverlay={handleDeleteOverlay}
        />
        </div>
      </main>
      {isDragging && (
        <div className="fixed inset-0 z-50 pointer-events-none bg-blue-600/15 backdrop-blur-[2px] flex items-center justify-center p-6">
          <div className="w-full h-full rounded-3xl border-4 border-dashed border-blue-400 flex flex-col items-center justify-center gap-4">
            <FileUp size={56} className="text-blue-300" />
            <p className="text-xl font-black text-white">여기에 놓으면 파일을 불러옵니다</p>
            <p className="text-sm text-blue-200">PDF 또는 이미지{slides.length > 0 ? ' · 지금 작업 중인 슬라이드는 새 파일로 바뀝니다' : ''}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
