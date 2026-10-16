
import React, { useState, useEffect, useRef } from 'react';
import { SlideData, Rect, TextOverlay } from './types';
import { convertPdfToImages, downloadAsPdf } from './services/pdfService';
import EditorCanvas from './components/EditorCanvas';
import Sidebar from './components/Sidebar';
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
  Image as ImageIcon
} from 'lucide-react';

const ARROW_DELTA: Record<string, [number, number]> = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
};

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

  // 단축키: Delete = 선택한 텍스트 상자 삭제, Ctrl+Z = 실행 취소 (글자 입력 중에는 입력란 기본 동작에 맡긴다)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable) return;
      // e.code 로 판단해야 한글 입력 상태(ㅋ)에서도 동작한다
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.code === 'KeyZ') {
        e.preventDefault();
        handleUndo();
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
          <label className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg cursor-pointer transition-colors text-sm font-medium border border-slate-600">
            <FileUp size={18} /><span>파일 업로드</span>
            <input type="file" accept=".pdf,image/*" className="hidden" onChange={handleFileUpload} />
          </label>
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
        <aside className="w-20 border-r border-slate-800 bg-[#1e293b] flex flex-col items-center py-6 gap-6 shrink-0">
          <button onClick={handleUndo} disabled={!canUndo} className="p-3 rounded-xl hover:bg-slate-700 text-slate-400 disabled:opacity-30 disabled:hover:bg-transparent" title="실행 취소 (Ctrl+Z)"><History size={24} /></button>
          <button onClick={handleClearOverlays} className="p-3 rounded-xl hover:bg-red-900/20 hover:text-red-400 text-slate-400" title="이 슬라이드의 텍스트 상자 전체 삭제"><Trash2 size={24} /></button>
        </aside>
        <div className="flex-1 flex flex-col bg-slate-950 relative">
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
              />
              <div className="h-12 bg-[#1e293b] border-t border-slate-800 flex items-center justify-center gap-8 shrink-0">
                <button disabled={activeSlideIdx === 0} onClick={() => setActiveSlideIdx(prev => prev - 1)} className="p-1 hover:bg-slate-700 rounded-full disabled:opacity-20"><ChevronLeft /></button>
                <span className="text-sm font-black text-white">{activeSlideIdx + 1} / {slides.length}</span>
                <button disabled={activeSlideIdx === slides.length - 1} onClick={() => setActiveSlideIdx(prev => prev + 1)} className="p-1 hover:bg-slate-700 rounded-full disabled:opacity-20"><ChevronRight /></button>
              </div>
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
        <Sidebar 
          activeSlide={slides[activeSlideIdx]} 
          selection={selection} 
          selectedOverlayId={selectedOverlayId}
          onApplyOverlay={handleApplyOverlay}
          onUpdateOverlays={handleUpdateOverlays}
          onDeleteOverlay={handleDeleteOverlay}
        />
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
