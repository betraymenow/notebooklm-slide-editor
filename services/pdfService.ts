
import { SlideData } from '../types';
import { drawOverlayText, loadFont } from './fontService';

declare const pdfjsLib: any;
declare const jspdf: any;

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

export const convertPdfToImages = async (file: File): Promise<SlideData[]> => {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const slides: SlideData[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: context, viewport }).promise;
    
    slides.push({
      index: i - 1,
      dataUrl: canvas.toDataURL('image/png'),
      width: viewport.width,
      height: viewport.height,
      overlays: []
    });
  }

  return slides;
};

export const downloadAsPdf = (slides: SlideData[], filename: string) => {
  const { jsPDF } = jspdf;
  const doc = new jsPDF({
    orientation: slides[0].width > slides[0].height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [slides[0].width, slides[0].height]
  });

  const processSlide = async (slide: SlideData, idx: number) => {
    if (idx > 0) doc.addPage([slide.width, slide.height]);
    
    const canvas = document.createElement('canvas');
    canvas.width = slide.width;
    canvas.height = slide.height;
    const ctx = canvas.getContext('2d')!;
    
    const img = new Image();
    img.src = slide.dataUrl;
    await new Promise(resolve => img.onload = resolve);
    
    ctx.drawImage(img, 0, 0);

    slide.overlays.forEach(overlay => {
      ctx.fillStyle = overlay.backgroundColor;
      ctx.fillRect(overlay.rect.x, overlay.rect.y, overlay.rect.width, overlay.rect.height);
      
      drawOverlayText(ctx, overlay);
    });
    
    const finalDataUrl = canvas.toDataURL('image/jpeg', 0.95);
    doc.addImage(finalDataUrl, 'JPEG', 0, 0, slide.width, slide.height);
  };

  const saveAll = async () => {
    await Promise.all(slides.flatMap(s => s.overlays.map(ov => loadFont(ov.fontFamily, ov.fontWeight, ov.newText))));
    for (let i = 0; i < slides.length; i++) {
      await processSlide(slides[i], i);
    }
    doc.save(filename);
  };

  saveAll();
};
