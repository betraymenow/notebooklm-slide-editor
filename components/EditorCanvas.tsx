
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { SlideData, Rect, Point, HandleType, TextOverlay } from '../types';
import { COLORS, HANDLE_SIZE, MIN_RECT_SIZE, MAX_ZOOM, MIN_ZOOM } from '../constants';
import { drawOverlayText, loadFont, fontStack, resolveWeight } from '../services/fontService';

interface EditorCanvasProps {
  slide: SlideData;
  selectedOverlayId: string | null;
  onSelectionChange: (rect: Rect | null) => void;
  onOverlaySelect: (id: string | null) => void;
  onUpdateOverlays: (overlays: TextOverlay[]) => void;
}

const EditorCanvas: React.FC<EditorCanvasProps> = ({ 
  slide, 
  selectedOverlayId,
  onSelectionChange, 
  onOverlaySelect,
  onUpdateOverlays 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [selection, setSelection] = useState<Rect | null>(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [isResizingSelection, setIsResizingSelection] = useState(false);
  const [isDraggingOverlay, setIsDraggingOverlay] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  
  const [dragType, setDragType] = useState<'move' | HandleType | null>(null);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [fontsVersion, setFontsVersion] = useState(0);

  // 더블클릭으로 캔버스 위에서 바로 글자를 고치는 중인 텍스트 상자
  const [editingId, setEditingId] = useState<string | null>(null);
  const editOriginalRef = useRef('');
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const editingOverlay = slide.overlays.find(o => o.id === editingId);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // Ctrl 을 누르는 순간 커서를 영역 선택 모양으로 (마우스를 안 움직여도)
      if ((e.key === 'Control' || e.key === 'Meta') && canvasRef.current) {
        const cur = canvasRef.current.style.cursor;
        if (e.type === 'keydown' && (cur === 'grab' || cur === '')) canvasRef.current.style.cursor = 'crosshair';
        if (e.type === 'keyup' && cur === 'crosshair') canvasRef.current.style.cursor = 'grab';
      }

      if (e.code === 'Space') {
        if (isInput) return;
        setIsSpacePressed(e.type === 'keydown');
        if (e.type === 'keydown') e.preventDefault();
        return;
      }
      // 방향키는 App 에서 선택한 텍스트 상자 위치 미세조정에 쓴다
    };
    window.addEventListener('keydown', handleKey);
    window.addEventListener('keyup', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('keyup', handleKey);
    };
  }, []);

  useEffect(() => {
    const img = new Image();
    img.src = slide.dataUrl;
    img.onload = () => {
      setImage(img);
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        // 창이 아주 작으면 여백(80px)을 빼고 음수가 될 수 있어 최소 배율로 막는다
        const scale = Math.max(MIN_ZOOM, Math.min(
          (clientWidth - 80) / img.width,
          (clientHeight - 80) / img.height
        ));
        setZoom(scale);
        setOffset({
          x: (clientWidth - img.width * scale) / 2,
          y: (clientHeight - img.height * scale) / 2
        });
      }
    };
  }, [slide.dataUrl]);

  // 휠 이벤트가 렌더보다 빠르게 연달아 와도 최신 배율을 쓰도록 ref 로 들고 있는다
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  // 휠 = 마우스 위치를 기준으로 확대/축소 (이동은 Space + 드래그 / 방향키)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      // 마우스 휠 한 칸(≈100px)에 약 15%, 트랙패드는 움직인 만큼 부드럽게
      const deltaPx = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      const prevZoom = zoomRef.current;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prevZoom * Math.exp(-deltaPx * 0.0015)));
      if (newZoom === prevZoom) return;
      zoomRef.current = newZoom;

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      setZoom(newZoom);
      setOffset(prev => ({
        x: mouseX - ((mouseX - prev.x) / prevZoom) * newZoom,
        y: mouseY - ((mouseY - prev.y) / prevZoom) * newZoom,
      }));
    };

    container.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => container.removeEventListener('wheel', handleWheelNative);
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !image) return;

    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(zoom, zoom);

    ctx.drawImage(image, 0, 0);

    slide.overlays.forEach(overlay => {
      ctx.fillStyle = overlay.backgroundColor;
      ctx.fillRect(overlay.rect.x, overlay.rect.y, overlay.rect.width, overlay.rect.height);
      
      if (overlay.id === selectedOverlayId) {
        ctx.strokeStyle = COLORS.primary;
        ctx.lineWidth = 2 / zoom;
        ctx.strokeRect(overlay.rect.x, overlay.rect.y, overlay.rect.width, overlay.rect.height);
      }

      if (overlay.id !== editingId) drawOverlayText(ctx, overlay); // 편집 중인 글자는 입력창이 대신 보여준다
    });

    if (selection) {
      ctx.strokeStyle = COLORS.primary;
      ctx.lineWidth = 2 / zoom;
      ctx.strokeRect(selection.x, selection.y, selection.width, selection.height);
      ctx.fillStyle = COLORS.overlay;
      ctx.fillRect(selection.x, selection.y, selection.width, selection.height);

      const handles: Point[] = [
        { x: selection.x, y: selection.y },
        { x: selection.x + selection.width / 2, y: selection.y },
        { x: selection.x + selection.width, y: selection.y },
        { x: selection.x + selection.width, y: selection.y + selection.height / 2 },
        { x: selection.x + selection.width, y: selection.y + selection.height },
        { x: selection.x + selection.width / 2, y: selection.y + selection.height },
        { x: selection.x, y: selection.y + selection.height },
        { x: selection.x, y: selection.y + selection.height / 2 },
      ];

      ctx.fillStyle = COLORS.handle;
      handles.forEach(h => {
        ctx.fillRect(h.x - (HANDLE_SIZE / 2) / zoom, h.y - (HANDLE_SIZE / 2) / zoom, HANDLE_SIZE / zoom, HANDLE_SIZE / zoom);
      });
    }

    ctx.restore();
  }, [image, slide.overlays, selection, zoom, offset, selectedOverlayId, fontsVersion, editingId]);

  // 텍스트 상자가 선택되면(적용 직후 포함) 영역 선택 표시는 지운다 — 남아 있으면 상자를 옮겨도 파란 영역이 제자리에 보인다
  useEffect(() => {
    if (selectedOverlayId) setSelection(null);
  }, [selectedOverlayId]);

  // 다른 상자를 고르거나 슬라이드가 바뀌면 편집 종료
  useEffect(() => {
    if (editingId && (selectedOverlayId !== editingId || !editingOverlay)) setEditingId(null);
  }, [selectedOverlayId, editingOverlay, editingId]);

  useEffect(() => {
    if (!editingId) return;
    const el = editorRef.current;
    if (el) { el.focus(); el.select(); }
  }, [editingId]);

  const startEditing = (overlay: TextOverlay) => {
    editOriginalRef.current = overlay.newText;
    onOverlaySelect(overlay.id);
    setEditingId(overlay.id);
  };

  const updateEditingText = (text: string) => {
    onUpdateOverlays(slide.overlays.map(o => (o.id === editingId ? { ...o, newText: text } : o)));
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    const p = getCanvasCoords(e);
    const hit = [...slide.overlays].reverse().find(o => isPointInRect(p, o.rect));
    if (hit) startEditing(hit);
  };

  const editorStyle = (() => {
    if (!editingOverlay) return undefined;
    const ov = editingOverlay;
    const size = ov.fontSize * zoom;
    const lineCount = ov.newText.split('\n').length;
    const textH = lineCount * size * 1.2;
    const boxH = ov.rect.height * zoom;
    const padTop = ov.vAlign === 'middle' ? Math.max(0, (boxH - textH) / 2) : ov.vAlign === 'bottom' ? Math.max(0, boxH - textH) : 0;
    return {
      left: offset.x + ov.rect.x * zoom,
      top: offset.y + ov.rect.y * zoom,
      width: ov.rect.width * zoom,
      height: boxH,
      paddingTop: padTop,
      fontFamily: fontStack(ov.fontFamily),
      fontWeight: resolveWeight(ov.fontFamily, ov.fontWeight).cssWeight,
      fontSize: size,
      lineHeight: 1.2,
      letterSpacing: (ov.letterSpacing || 0) * zoom,
      color: ov.fontColor,
      background: ov.backgroundColor === 'rgba(0,0,0,0)' ? 'transparent' : ov.backgroundColor,
      textAlign: (ov.hAlign || 'left') as React.CSSProperties['textAlign'],
    } as React.CSSProperties;
  })();

  useEffect(() => {
    draw();
  }, [draw]);

  // 웹폰트가 늦게 도착하면 다시 그린다
  useEffect(() => {
    const onLoaded = () => setFontsVersion(v => v + 1);
    document.fonts.addEventListener('loadingdone', onLoaded);
    window.addEventListener('fontcalibrated', onLoaded); // 두께 보정 폭 측정이 끝났을 때
    return () => {
      document.fonts.removeEventListener('loadingdone', onLoaded);
      window.removeEventListener('fontcalibrated', onLoaded);
    };
  }, []);

  useEffect(() => {
    slide.overlays.forEach(ov => loadFont(ov.fontFamily, ov.fontWeight, ov.newText));
  }, [slide.overlays]);

  const getCanvasCoords = (e: React.MouseEvent | any): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - offset.x) / zoom,
      y: (e.clientY - rect.top - offset.y) / zoom
    };
  };

  const getScreenCoords = (e: React.MouseEvent | any): Point => ({ x: e.clientX, y: e.clientY });

  const isPointInRect = (p: Point, rect: Rect) => {
    return p.x >= rect.x && p.x <= rect.x + rect.width && p.y >= rect.y && p.y <= rect.y + rect.height;
  };

  const getHandleAt = (p: Point, rect: Rect): HandleType | null => {
    const tolerance = HANDLE_SIZE / zoom;
    const hx = [rect.x, rect.x + rect.width / 2, rect.x + rect.width];
    const hy = [rect.y, rect.y + rect.height / 2, rect.y + rect.height];
    const types: (HandleType | null)[][] = [
      ['nw', 'n', 'ne'],
      ['w', null, 'e'],
      ['sw', 's', 'se']
    ];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const type = types[i][j];
        if (type && Math.abs(p.x - hx[j]) < tolerance && Math.abs(p.y - hy[i]) < tolerance) return type;
      }
    }
    return null;
  };

  // 드래그 없이 클릭만 했는지 판단용 (빈 곳 클릭 = 텍스트 선택 해제)
  const panDistanceRef = useRef(0);

  const startPan = (e: React.MouseEvent) => {
    setIsPanning(true);
    setStartPoint(getScreenCoords(e));
    panDistanceRef.current = 0;
  };

  // 조작: 드래그 = 이동, Ctrl + 드래그 = 영역 선택
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 2) return;
    const p = getCanvasCoords(e);

    if (e.button === 0 && (e.ctrlKey || e.metaKey) && !isSpacePressed) {
      onOverlaySelect(null);
      setIsDrawing(true);
      setSelection({ x: p.x, y: p.y, width: 0, height: 0 });
      setStartPoint(p);
      onSelectionChange(null);
      return;
    }

    if (isSpacePressed || e.button === 1) {
      startPan(e);
      return;
    }

    if (selection) {
      const handle = getHandleAt(p, selection);
      if (handle) {
        setIsResizingSelection(true);
        setDragType(handle);
        setStartPoint(p);
        return;
      }
    }

    const clickedOverlay = [...slide.overlays].reverse().find(o => isPointInRect(p, o.rect));
    if (clickedOverlay) {
      onOverlaySelect(clickedOverlay.id);
      setIsDraggingOverlay(true);
      setStartPoint(p);
      setSelection(null);
      onSelectionChange(null);
      return;
    }

    startPan(e);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const screenP = getScreenCoords(e);
    const canvasP = getCanvasCoords(e);

    if (canvasRef.current) {
      let cursor = 'grab';
      if (isPanning || isDraggingOverlay) cursor = 'grabbing';
      else if (isDrawing || ((e.ctrlKey || e.metaKey) && !isSpacePressed)) cursor = 'crosshair';
      else if (isResizingSelection) cursor = 'nwse-resize';
      else if (selection && getHandleAt(canvasP, selection)) cursor = 'nwse-resize';
      else if (!isSpacePressed && slide.overlays.some(o => isPointInRect(canvasP, o.rect))) cursor = 'pointer';
      canvasRef.current.style.cursor = cursor;
    }

    if (isPanning && startPoint) {
      const dx = screenP.x - startPoint.x;
      const dy = screenP.y - startPoint.y;
      panDistanceRef.current += Math.abs(dx) + Math.abs(dy);
      setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setStartPoint(screenP);
      return;
    }

    if (isDrawing && startPoint) {
      const x = Math.min(canvasP.x, startPoint.x);
      const y = Math.min(canvasP.y, startPoint.y);
      const width = Math.abs(canvasP.x - startPoint.x);
      const height = Math.abs(canvasP.y - startPoint.y);
      setSelection({ x, y, width, height });
    } else if (isResizingSelection && selection && startPoint && dragType) {
      const dx = canvasP.x - startPoint.x;
      const dy = canvasP.y - startPoint.y;
      let newRect = { ...selection };
      if (dragType.includes('e')) newRect.width += dx;
      if (dragType.includes('w')) { newRect.x += dx; newRect.width -= dx; }
      if (dragType.includes('s')) newRect.height += dy;
      if (dragType.includes('n')) { newRect.y += dy; newRect.height -= dy; }
      setSelection(newRect);
      setStartPoint(canvasP);
    } else if (isDraggingOverlay && selectedOverlayId && startPoint) {
      const dx = canvasP.x - startPoint.x;
      const dy = canvasP.y - startPoint.y;
      const newOverlays = slide.overlays.map(ov => ov.id === selectedOverlayId ? { ...ov, rect: { ...ov.rect, x: ov.rect.x + dx, y: ov.rect.y + dy } } : ov);
      onUpdateOverlays(newOverlays);
      setStartPoint(canvasP);
    }
  };

  const handleMouseUp = () => {
    if (isDrawing || isResizingSelection) {
      if (selection && (selection.width < MIN_RECT_SIZE || selection.height < MIN_RECT_SIZE)) {
        setSelection(null);
        onSelectionChange(null);
      } else {
        onSelectionChange(selection);
      }
    }
    if (isPanning && panDistanceRef.current < 3) onOverlaySelect(null);
    setIsDrawing(false);
    setIsDraggingOverlay(false);
    setIsResizingSelection(false);
    setIsPanning(false);
    setStartPoint(null);
  };

  return (
    <div ref={containerRef} className="flex-1 relative overflow-hidden bg-[#0f172a] flex items-center justify-center select-none">
      <canvas ref={canvasRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onDoubleClick={handleDoubleClick} onContextMenu={(e) => e.preventDefault()} className="block w-full h-full" style={{ cursor: 'grab' }} />
      {editingOverlay && (
        <textarea
          ref={editorRef}
          value={editingOverlay.newText}
          onChange={(e) => updateEditingText(e.target.value)}
          onBlur={() => setEditingId(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { updateEditingText(editOriginalRef.current); setEditingId(null); }
            else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) setEditingId(null);
          }}
          spellCheck={false}
          className="absolute m-0 p-0 border-0 resize-none overflow-hidden outline outline-2 outline-blue-500 whitespace-pre"
          style={editorStyle}
        />
      )}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-800/90 px-5 py-2.5 rounded-full text-xs font-medium text-slate-200 border border-slate-700 shadow-2xl pointer-events-none flex items-center gap-5 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="bg-slate-700 px-1.5 py-0.5 rounded text-[10px] text-blue-400 font-bold">Drag</span>
          <span>이미지 이동</span>
        </div>
        <div className="w-px h-3 bg-slate-600"></div>
        <div className="flex items-center gap-2">
          <span className="bg-slate-700 px-1.5 py-0.5 rounded text-[10px] text-blue-400 font-bold">Wheel</span>
          <span>확대 / 축소</span>
        </div>
        <div className="w-px h-3 bg-slate-600"></div>
        <div className="flex items-center gap-2">
          <span className="bg-slate-700 px-1.5 py-0.5 rounded text-[10px] text-blue-400 font-bold">Ctrl + Drag</span>
          <span>영역 선택</span>
        </div>
      </div>
    </div>
  );
};

export default EditorCanvas;
