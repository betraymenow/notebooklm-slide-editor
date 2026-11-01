
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { SlideData, Rect, Point, HandleType, TextOverlay } from '../types';
import { COLORS, HANDLE_SIZE, MIN_RECT_SIZE, MAX_ZOOM, MIN_ZOOM } from '../constants';
import { drawOverlayText, loadFont, fontStack, resolveWeight } from '../services/fontService';

// 사각형의 8개 손잡이 위치 (모서리 4 + 변 가운데 4)
const handlePoints = (r: Rect): Point[] => [
  { x: r.x, y: r.y },
  { x: r.x + r.width / 2, y: r.y },
  { x: r.x + r.width, y: r.y },
  { x: r.x + r.width, y: r.y + r.height / 2 },
  { x: r.x + r.width, y: r.y + r.height },
  { x: r.x + r.width / 2, y: r.y + r.height },
  { x: r.x, y: r.y + r.height },
  { x: r.x, y: r.y + r.height / 2 },
];

const handleCursor = (h: HandleType) =>
  h === 'n' || h === 's' ? 'ns-resize' : h === 'e' || h === 'w' ? 'ew-resize' : h === 'nw' || h === 'se' ? 'nwse-resize' : 'nesw-resize';

/**
 * 자르기 영역 손잡이를 끌었을 때의 새 영역. 이미지(W×H) 밖으로는 못 나가고,
 * 비율이 정해져 있으면 반대쪽 모서리(변 손잡이면 반대쪽 변의 가운데)를 고정한 채 비율을 지킨다.
 */
const resizeCrop = (r: Rect, handle: HandleType, dx: number, dy: number, ratio: number | null, W: number, H: number): Rect => {
  const east = handle.includes('e'), west = handle.includes('w');
  const south = handle.includes('s'), north = handle.includes('n');
  if (!ratio) {
    let left = r.x, top = r.y, right = r.x + r.width, bottom = r.y + r.height;
    if (west) left = Math.min(Math.max(0, left + dx), right - MIN_RECT_SIZE);
    if (east) right = Math.max(Math.min(W, right + dx), left + MIN_RECT_SIZE);
    if (north) top = Math.min(Math.max(0, top + dy), bottom - MIN_RECT_SIZE);
    if (south) bottom = Math.max(Math.min(H, bottom + dy), top + MIN_RECT_SIZE);
    return { x: left, y: top, width: right - left, height: bottom - top };
  }
  const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
  const anchorX = east ? r.x : r.x + r.width;
  const anchorY = south ? r.y : r.y + r.height;
  const wFromX = r.width + (east ? dx : west ? -dx : 0);
  const wFromY = (r.height + (south ? dy : north ? -dy : 0)) * ratio;
  let w = (east || west) && (north || south) ? Math.max(wFromX, wFromY) : east || west ? wFromX : wFromY;
  const maxW = Math.min(
    east ? W - anchorX : west ? anchorX : 2 * Math.min(cx, W - cx),
    (south ? H - anchorY : north ? anchorY : 2 * Math.min(cy, H - cy)) * ratio,
  );
  w = Math.min(maxW, Math.max(MIN_RECT_SIZE * Math.max(1, ratio), w));
  const h = w / ratio;
  return {
    x: east ? anchorX : west ? anchorX - w : cx - w / 2,
    y: south ? anchorY : north ? anchorY - h : cy - h / 2,
    width: w,
    height: h,
  };
};

const STAGE_ID = 'editor-stage';
const FIT_MARGIN = 80; // 화면 맞춤 때 이미지 둘레 여백 (전체화면에서는 0)

/** 이미지 편집 영역만 모니터 전체화면으로 켜고 끈다 (상단 버튼·우클릭) */
export const toggleEditorFullscreen = () => {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else document.getElementById(STAGE_ID)?.requestFullscreen().catch(() => {});
};

interface EditorCanvasProps {
  slide: SlideData;
  selectedOverlayId: string | null;
  onSelectionChange: (rect: Rect | null) => void;
  onOverlaySelect: (id: string | null) => void;
  onUpdateOverlays: (overlays: TextOverlay[]) => void;
  editRequestId?: string | null;        // 이 상자를 바로 글자 입력 상태로 연다 (붙여넣기 직후)
  onEditRequestHandled?: () => void;
  cropRect?: Rect | null;               // 자르기 중이면 자를 영역 (이미지 좌표)
  cropRatio?: number | null;            // 가로/세로 비율 고정 (null = 자유)
  onCropChange?: (rect: Rect) => void;
}

const EditorCanvas: React.FC<EditorCanvasProps> = ({ 
  slide, 
  selectedOverlayId,
  onSelectionChange, 
  onOverlaySelect,
  onUpdateOverlays,
  editRequestId,
  onEditRequestHandled,
  cropRect,
  cropRatio = null,
  onCropChange
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

  // 이미지를 편집 영역 가운데에 꽉 차게 맞춘다
  const fitToView = (img: HTMLImageElement) => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    const margin = document.fullscreenElement === containerRef.current ? 0 : FIT_MARGIN;
    // 창이 아주 작으면 여백을 빼고 음수가 될 수 있어 최소 배율로 막는다
    const scale = Math.max(MIN_ZOOM, Math.min(
      (clientWidth - margin) / img.width,
      (clientHeight - margin) / img.height
    ));
    setZoom(scale);
    setOffset({
      x: (clientWidth - img.width * scale) / 2,
      y: (clientHeight - img.height * scale) / 2
    });
  };

  useEffect(() => {
    const img = new Image();
    img.src = slide.dataUrl;
    img.onload = () => {
      setImage(img);
      fitToView(img);
    };
  }, [slide.dataUrl]);

  // 전체화면을 켜고 끌 때마다 바뀐 크기에 맞춰 다시 맞춤
  const imageRef = useRef(image);
  imageRef.current = image;
  useEffect(() => {
    const onChange = () => requestAnimationFrame(() => { if (imageRef.current) fitToView(imageRef.current); });
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

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

    const drawHandles = (rect: Rect) => {
      ctx.fillStyle = COLORS.handle;
      handlePoints(rect).forEach(h => {
        ctx.fillRect(h.x - (HANDLE_SIZE / 2) / zoom, h.y - (HANDLE_SIZE / 2) / zoom, HANDLE_SIZE / zoom, HANDLE_SIZE / zoom);
      });
    };

    // 자르기 중: 잘려 나갈 바깥은 어둡게, 남을 영역에는 3분할 안내선과 손잡이
    if (cropRect) {
      const c = cropRect;
      ctx.fillStyle = 'rgba(2, 6, 23, 0.65)';
      ctx.beginPath();
      ctx.rect(0, 0, image.width, image.height);
      ctx.rect(c.x, c.y, c.width, c.height);
      ctx.fill('evenodd');
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1 / zoom;
      ctx.beginPath();
      for (let i = 1; i < 3; i++) {
        ctx.moveTo(c.x + (c.width * i) / 3, c.y); ctx.lineTo(c.x + (c.width * i) / 3, c.y + c.height);
        ctx.moveTo(c.x, c.y + (c.height * i) / 3); ctx.lineTo(c.x + c.width, c.y + (c.height * i) / 3);
      }
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2 / zoom;
      ctx.strokeRect(c.x, c.y, c.width, c.height);
      drawHandles(c);
      ctx.restore();
      return;
    }

    // 선택한 텍스트 상자: 글자 위에 크기 조절 손잡이를 그린다
    const selectedOverlay = slide.overlays.find(o => o.id === selectedOverlayId);
    if (selectedOverlay) drawHandles(selectedOverlay.rect);

    if (selection) {
      ctx.strokeStyle = COLORS.primary;
      ctx.lineWidth = 2 / zoom;
      ctx.strokeRect(selection.x, selection.y, selection.width, selection.height);
      ctx.fillStyle = COLORS.overlay;
      ctx.fillRect(selection.x, selection.y, selection.width, selection.height);
      drawHandles(selection);
    }

    ctx.restore();
  }, [image, slide.overlays, selection, zoom, offset, selectedOverlayId, fontsVersion, editingId, cropRect]);

  // Esc = Ctrl + 드래그로 잡은 영역(아직 적용 전인 텍스트 상자) 취소
  useEffect(() => {
    if (!selection) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable) return;
      e.preventDefault();
      setIsDrawing(false);
      setIsResizingSelection(false);
      setStartPoint(null);
      setSelection(null);
      onSelectionChange(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selection]);

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

  // 붙여넣기 직후처럼 밖에서 "이 상자 바로 편집" 요청이 오면 입력창을 연다
  useEffect(() => {
    if (!editRequestId) return;
    const target = slide.overlays.find(o => o.id === editRequestId);
    if (target) {
      startEditing(target);
      onEditRequestHandled?.();
    }
  }, [editRequestId, slide.overlays]);

  const updateEditingText = (text: string) => {
    onUpdateOverlays(slide.overlays.map(o => (o.id === editingId ? { ...o, newText: text } : o)));
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (cropRect) return;
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

  // 편집툴을 열고 닫거나 창 크기가 바뀌면 캔버스 크기를 맞춰 다시 그린다
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => setFontsVersion(v => v + 1));
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

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

  // 텍스트 상자 크기 조절 중: 누른 순간의 상자·위치를 기준으로 계산해야 끌수록 어긋나지 않는다
  const overlayResizeRef = useRef<{ handle: HandleType; start: Point; rect: Rect } | null>(null);
  const [isResizingOverlay, setIsResizingOverlay] = useState(false);

  const resizedRect = (r: Rect, handle: HandleType, dx: number, dy: number): Rect => {
    let { x, y, width, height } = r;
    if (handle.includes('e')) width = r.width + dx;
    if (handle.includes('w')) { x = r.x + dx; width = r.width - dx; }
    if (handle.includes('s')) height = r.height + dy;
    if (handle.includes('n')) { y = r.y + dy; height = r.height - dy; }
    // 최소 크기 아래로는 줄지 않게, 반대쪽 변은 제자리에 둔다
    if (width < MIN_RECT_SIZE) { if (handle.includes('w')) x = r.x + r.width - MIN_RECT_SIZE; width = MIN_RECT_SIZE; }
    if (height < MIN_RECT_SIZE) { if (handle.includes('n')) y = r.y + r.height - MIN_RECT_SIZE; height = MIN_RECT_SIZE; }
    return { x, y, width, height };
  };

  const cropDragRef = useRef<{ kind: 'move' | HandleType; start: Point; rect: Rect } | null>(null);

  const startPan = (e: React.MouseEvent) => {
    setIsPanning(true);
    setStartPoint(getScreenCoords(e));
    panDistanceRef.current = 0;
  };

  // 조작: 드래그 = 이동, Ctrl + 드래그 = 영역 선택
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 2) return;
    const p = getCanvasCoords(e);

    // 자르기 중: 손잡이 = 크기 조절, 영역 안 = 옮기기, 나머지 = 이미지 이동
    if (cropRect) {
      if (isSpacePressed || e.button === 1) { startPan(e); return; }
      const handle = getHandleAt(p, cropRect);
      if (handle || isPointInRect(p, cropRect)) {
        cropDragRef.current = { kind: handle || 'move', start: p, rect: { ...cropRect } };
        return;
      }
      startPan(e);
      return;
    }

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

    // 선택한 텍스트 상자의 손잡이를 잡으면 크기 조절
    const selectedOverlay = slide.overlays.find(o => o.id === selectedOverlayId);
    if (selectedOverlay) {
      const handle = getHandleAt(p, selectedOverlay.rect);
      if (handle) {
        overlayResizeRef.current = { handle, start: p, rect: { ...selectedOverlay.rect } };
        setIsResizingOverlay(true);
        return;
      }
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

    if (cropRect) {
      const drag = cropDragRef.current;
      if (canvasRef.current) {
        const hover = drag ? drag.kind : getHandleAt(canvasP, cropRect) || (isPointInRect(canvasP, cropRect) ? 'move' : null);
        canvasRef.current.style.cursor = isPanning ? 'grabbing' : hover === 'move' ? 'move' : hover ? handleCursor(hover) : 'grab';
      }
      if (drag) {
        const dx = canvasP.x - drag.start.x;
        const dy = canvasP.y - drag.start.y;
        const r = drag.rect;
        onCropChange?.(drag.kind === 'move'
          ? { ...r, x: Math.min(Math.max(0, r.x + dx), slide.width - r.width), y: Math.min(Math.max(0, r.y + dy), slide.height - r.height) }
          : resizeCrop(r, drag.kind, dx, dy, cropRatio, slide.width, slide.height));
        return;
      }
    }

    if (canvasRef.current && !cropRect) {
      const selectedOverlay = slide.overlays.find(o => o.id === selectedOverlayId);
      const overlayHandle = selectedOverlay && !isSpacePressed ? getHandleAt(canvasP, selectedOverlay.rect) : null;
      let cursor = 'grab';
      if (isPanning || isDraggingOverlay) cursor = 'grabbing';
      else if (isResizingOverlay && overlayResizeRef.current) cursor = handleCursor(overlayResizeRef.current.handle);
      else if (isDrawing || ((e.ctrlKey || e.metaKey) && !isSpacePressed)) cursor = 'crosshair';
      else if (isResizingSelection && dragType && dragType !== 'move') cursor = handleCursor(dragType);
      else if (overlayHandle) cursor = handleCursor(overlayHandle);
      else if (selection && getHandleAt(canvasP, selection)) cursor = handleCursor(getHandleAt(canvasP, selection)!);
      else if (!isSpacePressed && slide.overlays.some(o => isPointInRect(canvasP, o.rect))) cursor = 'pointer';
      canvasRef.current.style.cursor = cursor;
    }

    const resize = overlayResizeRef.current;
    if (isResizingOverlay && resize && selectedOverlayId) {
      const rect = resizedRect(resize.rect, resize.handle, canvasP.x - resize.start.x, canvasP.y - resize.start.y);
      onUpdateOverlays(slide.overlays.map(ov => (ov.id === selectedOverlayId ? { ...ov, rect } : ov)));
      return;
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
    cropDragRef.current = null;
    if (isPanning && panDistanceRef.current < 3 && !cropRect) onOverlaySelect(null);
    setIsDrawing(false);
    setIsDraggingOverlay(false);
    setIsResizingSelection(false);
    setIsResizingOverlay(false);
    overlayResizeRef.current = null;
    setIsPanning(false);
    setStartPoint(null);
  };

  return (
    <div ref={containerRef} id={STAGE_ID} className="flex-1 relative overflow-hidden bg-[#0f172a] flex items-center justify-center select-none">
      <canvas ref={canvasRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onDoubleClick={handleDoubleClick} onContextMenu={(e) => { e.preventDefault(); toggleEditorFullscreen(); }} className="block w-full h-full" style={{ cursor: 'grab' }} />
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
    </div>
  );
};

export default EditorCanvas;
