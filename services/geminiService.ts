
import { GoogleGenAI, Type } from "@google/genai";
import { ColorType, DiagnosisResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function getDiagnosis(name: string, color: ColorType): Promise<DiagnosisResult> {
  const prompt = `
    당신은 전문적인 색채 심리 상담가입니다.
    사용자 '${name}'님이 이번 심리 진단 세션에서 '${color}' 색상을 선택했습니다.
    
    요구사항:
    1. 답변은 반드시 한국어로 작성하세요.
    2. 전문적인 심리 상담가 특유의 따뜻하고 공감적인 말투(심리 상담 스타일)를 유지하세요.
    3. 선택한 색상을 통해 현재의 무의식적인 상태, 욕구, 그리고 앞으로의 실천 팁을 제안하세요.
    4. 추천 꽃과 향기를 포함하고 그 이유를 심리학적으로 설명하세요.
    5. 인스타그램에 공유하기 좋은 감성적이고 짧은 문구(quote)를 포함하세요.
    
    결과는 반드시 제공된 JSON 스키마를 엄격히 따라야 합니다.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          message: { type: Type.STRING, description: "심리 상담사 스타일의 상세 분석 메시지 (따뜻한 말투)" },
          needs: { type: Type.STRING, description: "현재 무의식적인 욕구나 결핍" },
          tips: { type: Type.STRING, description: "생활 속 실천 가능한 구체적인 팁" },
          flower: { type: Type.STRING, description: "추천 꽃과 그 꽃이 주는 심리적 의미" },
          scent: { type: Type.STRING, description: "추천 향기와 그 향기의 치유 효과" },
          comfortMessage: { type: Type.STRING, description: "상담사가 전하는 마지막 위로의 한마디" },
          quote: { type: Type.STRING, description: "오늘을 위한 짧고 감성적인 명언" },
        },
        required: ["message", "needs", "tips", "flower", "scent", "comfortMessage", "quote"],
      },
    },
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Failed to parse Gemini response", error);
    throw new Error("진단 결과를 불러오는 중 오류가 발생했습니다.");
  }
}
