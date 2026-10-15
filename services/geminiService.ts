
import { GoogleGenAI, Type } from "@google/genai";
import { OCRResult } from "../types";
import { FONT_CATALOG } from "./fontService";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

// 모델 과부하(503)·일시 오류(429/500)는 잠시 기다렸다가 다시 시도한다
const generateWithRetry = async (params: Parameters<typeof ai.models.generateContent>[0], tries = 4) => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await ai.models.generateContent(params);
    } catch (error: any) {
      const message = String(error?.message);
      const status = error?.status ?? Number(message.match(/"code":\s*(\d+)/)?.[1]);
      const dailyQuota = /PerDay/i.test(message); // 하루 할당량 소진은 기다려도 소용없다
      if (attempt >= tries || dailyQuota || ![429, 500, 503].includes(status)) throw error;
      await new Promise(r => setTimeout(r, 1000 * 2 ** (attempt - 1)));
    }
  }
};

export const analyzeTextInImage = async (base64Image: string): Promise<OCRResult> => {
  const response = await generateWithRetry({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'image/png',
            data: base64Image.split(',')[1],
          },
        },
        {
          text: `Identify the Korean text in this image snippet.
          Estimate the following typography properties:
          1. The exact text content. Keep line breaks exactly as they appear in the image.
          2. Approximate font size in pixels.
          3. Font weight as a CSS number (100-900).
          4. Dominant text color in hex.
          5. Closest font family (sans-serif, serif, monospace).
          6. Dominant background color in hex behind the text.
          7. fontCandidates: up to 3 font ids from the list below that look most like the lettering, best first.
          Font list (id: look):
          ${FONT_CATALOG.map(f => `- ${f.id}: ${f.hint}`).join('\n')}
          Return ONLY a JSON object with keys: text, fontSize, fontWeight, fontColor, fontFamily, backgroundColor, fontCandidates.`
        }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING },
          fontSize: { type: Type.NUMBER },
          fontWeight: { type: Type.STRING },
          fontColor: { type: Type.STRING },
          fontFamily: { type: Type.STRING },
          backgroundColor: { type: Type.STRING },
          fontCandidates: {
            type: Type.ARRAY,
            items: { type: Type.STRING, enum: FONT_CATALOG.map(f => f.id) },
          },
        },
        required: ["text", "fontSize", "fontWeight", "fontColor", "fontFamily", "backgroundColor"]
      }
    }
  });

  try {
    const data = JSON.parse(response.text || "{}");
    return {
      text: data.text || "",
      fontSize: data.fontSize || 16,
      fontWeight: String(data.fontWeight || "400"),
      fontColor: data.fontColor || "#000000",
      fontFamily: data.fontFamily || "sans-serif",
      backgroundColor: data.backgroundColor || "#ffffff",
      fontCandidates: Array.isArray(data.fontCandidates) ? data.fontCandidates : []
    };
  } catch (error) {
    console.error("Failed to parse Gemini response", error);
    return {
      text: "OCR Error",
      fontSize: 16,
      fontWeight: "normal",
      fontColor: "#000000",
      fontFamily: "sans-serif",
      backgroundColor: "#ffffff",
      fontCandidates: []
    };
  }
};

/**
 * 원본 글씨 이미지와 번호 붙은 폰트 견본 이미지를 보여주고, 비슷한 순서대로 번호를 받는다.
 * 실패하면 빈 배열을 돌려준다 (호출한 쪽은 픽셀 비교 순서를 그대로 쓴다).
 */
export const rankFontSamples = async (cropDataUrl: string, sheetDataUrl: string, count: number): Promise<number[]> => {
  try {
    const response = await generateWithRetry({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { text: 'Image A is lettering cropped from a slide:' },
          { inlineData: { mimeType: 'image/png', data: cropDataUrl.split(',')[1] } },
          { text: `Image B shows the same words set in ${count} candidate fonts, numbered 1-${count} in red:` },
          { inlineData: { mimeType: 'image/png', data: sheetDataUrl.split(',')[1] } },
          {
            text: `Rank the numbered samples by how closely their typeface matches the lettering in image A.
            Compare letter shapes (stroke endings, roundness of ㅇ/ㅎ, angle of ㅅ/ㅈ), stroke thickness, and width/proportions.
            Ignore color, size, outline, glow and shadow effects. Return JSON: {"ranking": [numbers best first]}.`
          },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: { ranking: { type: Type.ARRAY, items: { type: Type.INTEGER } } },
          required: ['ranking'],
        },
      },
    });
    const data = JSON.parse(response.text || '{}');
    const seen = new Set<number>();
    return (Array.isArray(data.ranking) ? data.ranking : [])
      .map((n: unknown) => Number(n) - 1)
      .filter((i: number) => Number.isInteger(i) && i >= 0 && i < count && !seen.has(i) && (seen.add(i), true));
  } catch (error) {
    console.error('Font ranking failed', error);
    return [];
  }
};
