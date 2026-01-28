
import { GoogleGenAI, Type, Chat } from "@google/genai";
import { ColorType, DiagnosisResult, UserInfo } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function getDiagnosis(userInfo: UserInfo, color: ColorType): Promise<DiagnosisResult> {
  const prompt = `
    당신은 전문적인 색채 심리 상담가이자 웰니스 코치입니다.
    사용자 정보:
    - 이름/호칭: ${userInfo.nickname || userInfo.name}
    - 연령대: ${userInfo.ageGroup}
    - 성별: ${userInfo.gender}
    - 현재 상황: ${userInfo.situation?.join(', ')}
    - 현재 고민: ${userInfo.concern}
    - 선택한 컬러: ${color}
    
    요구사항:
    1. 모든 답변은 한국어로 작성하세요.
    2. 사용자의 연령대(${userInfo.ageGroup})와 상황(${userInfo.situation?.join(', ')})에 맞는 말투와 예시를 사용하세요.
    3. 답변 내에서 가장 중요한 핵심 단어나 키워드에는 반드시 **강조** (예: **심리적 안정**) 표시를 하세요.
    4. 'message': 현재 심리 상태 분석 (3-4문장).
    5. 'needs': 현재 무의식적으로 갈망하고 있는 핵심적인 욕구.
    6. 'tips': 생활 속 구체적인 실천 팁 3가지.
    7. 'flower', 'scent', 'garden', 'comfortMessage', 'quote', 'instagramSummary' 필드를 포함하세요.
    8. 'hashtags': 5개의 키워드.
    9. 모든 결과는 JSON 스키마를 엄격히 따르세요.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          message: { type: Type.STRING },
          needs: { type: Type.STRING },
          tips: { type: Type.STRING },
          flower: { type: Type.STRING },
          scent: { type: Type.STRING },
          garden: { type: Type.STRING },
          comfortMessage: { type: Type.STRING },
          quote: { type: Type.STRING },
          instagramSummary: { type: Type.STRING },
          hashtags: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["message", "needs", "tips", "flower", "scent", "garden", "comfortMessage", "quote", "instagramSummary", "hashtags"],
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

export function createCounselingChat(userInfo: UserInfo, color: string, diagnosis: string): Chat {
  return ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: `당신은 '컬러하트캔'의 따뜻한 AI 심리 상담가입니다. 
      사용자 정보: 호칭(${userInfo.nickname}), 연령(${userInfo.ageGroup}), 고민(${userInfo.concern}).
      사용자의 상황에 깊이 공감하며 대화하세요.
      답변 시 핵심 단어는 **강조** 표시를 사용하세요. 
      문장마다 줄바꿈을 하여 가독성을 높여주세요.`,
    },
  });
}
