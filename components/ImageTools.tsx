import React, { useState, useEffect } from 'react';
import { Rect, SlideData } from '../types';
import { CROP_ASPECTS, CropAspect, ImageTransform, aspectRatio } from '../services/imageTransform';
import { MIN_RECT_SIZE } from '../constants';
import { Crop, RotateCcw, RotateCw, FlipHorizontal2, FlipVertical2, ChevronDown, ChevronUp, RefreshCw, Loader2 } from 'lucide-react';

interface ImageToolsProps {
  slide: SlideData;
  cropAspect: CropAspect | null;        // null = 자르기 패널이 닫혀 있음
  cropRect: Rect | null;
  busy: boolean;
  onCropAspectChange: (aspect: CropAspect | null) => void;
  onCropChange: (rect: Rect) => void;
  onApplyCrop: () => void;
  onResetCrop: () => void;
  onTransform: (op: ImageTransform) => void;
}

// 입력 중에는 그대로 두고 Enter·포커스 이동 때 반영하는 숫자 칸
const PxInput: React.FC<{ value: number; onCommit: (v: number) => void; label: string }> = ({ value, onCommit, label }) => {
  const [text, setText] = useState(String(Math.round(value)));
  useEffect(() => setText(String(Math.round(value))), [value]);
  const commit = () => {
    const v = parseInt(text, 10);
    if (Number.isFinite(v)) onCommit(v);
    else setText(String(Math.round(value)));
  };
  return (
    <label className="flex-1 flex items-center bg-slate-900 border border-slate-700 rounded-md px-2 focus-within:border-blue-500">
      <input
        aria-label={label}
        value={text}
        onChange={e => setText(e.target.value.replace(/[^0-9]/g, ''))}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        className="w-full bg-transparent py-1.5 text-xs text-slate-100 outline-none"
      />
      <span className="text-[10px] text-slate-500">px</span>
    </label>
  );
};

const Section: React.FC<{ title: string; icon: React.ReactNode; open: boolean; onToggle: () => void; children: React.ReactNode }> = ({ title, icon, open, onToggle, children }) => (
  <div className="bg-slate-800/50 rounded-xl border border-slate-700">
    <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold text-slate-200 hover:text-white">
      <span className="flex items-center gap-2">{icon}{title}</span>
      {open ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
    </button>
    {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
  </div>
);

const ImageTools: React.FC<ImageToolsProps> = ({ slide, cropAspect, cropRect, busy, onCropAspectChange, onCropChange, onApplyCrop, onResetCrop, onTransform }) => {
  const [rotateOpen, setRotateOpen] = useState(false);
  const ratio = cropAspect ? aspectRatio(cropAspect) : null;

  // 숫자로 크기를 바꾸면 왼쪽 위는 그대로 두고, 이미지 밖으로 나가지 않게 줄인다
  const setCropSize = (width: number, height: number) => {
    if (!cropRect) return;
    let w = Math.max(MIN_RECT_SIZE, Math.min(slide.width, width));
    let h = Math.max(MIN_RECT_SIZE, Math.min(slide.height, height));
    if (ratio) {
      if (w / ratio > slide.height) w = slide.height * ratio;
      h = w / ratio;
    }
    onCropChange({
      x: Math.min(cropRect.x, slide.width - w),
      y: Math.min(cropRect.y, slide.height - h),
      width: w,
      height: h,
    });
  };

  const rotateButtons: { op: ImageTransform; icon: React.ReactNode; title: string }[] = [
    { op: 'rotateLeft', icon: <RotateCcw size={16} />, title: '왼쪽으로 90° 회전' },
    { op: 'rotateRight', icon: <RotateCw size={16} />, title: '오른쪽으로 90° 회전' },
    { op: 'flipH', icon: <FlipHorizontal2 size={16} />, title: '좌우 대칭' },
    { op: 'flipV', icon: <FlipVertical2 size={16} />, title: '상하 대칭' },
  ];

  return (
    <div className="p-4 pb-0 space-y-2">
      <Section
        title="자르기"
        icon={<Crop size={14} className="text-blue-400" />}
        open={cropAspect !== null}
        onToggle={() => onCropAspectChange(cropAspect ? null : 'free')}
      >
        <select
          value={cropAspect ?? 'free'}
          onChange={e => onCropAspectChange(e.target.value as CropAspect)}
          className="w-full bg-slate-900 border border-slate-700 rounded-md px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-blue-500"
        >
          {CROP_ASPECTS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
        {cropRect && (
          <div className="flex items-center gap-2">
            <PxInput label="자를 너비" value={cropRect.width} onCommit={w => setCropSize(w, ratio ? w / ratio : cropRect.height)} />
            <span className="text-slate-500 text-xs">×</span>
            <PxInput label="자를 높이" value={cropRect.height} onCommit={h => setCropSize(ratio ? h * ratio : cropRect.width, h)} />
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={onApplyCrop}
            disabled={busy || !cropRect}
            className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold py-2 rounded-lg"
          >
            {busy && <Loader2 size={12} className="animate-spin" />}적용
          </button>
          <button onClick={onResetCrop} className="flex items-center gap-1 px-3 py-2 text-xs text-slate-400 hover:text-slate-200" title="자를 영역을 처음 크기로">
            <RefreshCw size={12} /> 초기화
          </button>
        </div>
      </Section>

      <Section title="회전" icon={<RotateCw size={14} className="text-blue-400" />} open={rotateOpen} onToggle={() => setRotateOpen(o => !o)}>
        <div className="grid grid-cols-4 gap-2">
          {rotateButtons.map(b => (
            <button
              key={b.op}
              onClick={() => onTransform(b.op)}
              disabled={busy}
              title={b.title}
              className="flex items-center justify-center py-2 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:border-blue-500 hover:text-white disabled:opacity-50"
            >
              {b.icon}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-slate-500">누르면 바로 적용돼요. 되돌리려면 Ctrl+Z</p>
      </Section>
    </div>
  );
};

export default ImageTools;
