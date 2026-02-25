
import { GoogleGenAI } from "@google/genai";
import { ChatMessage } from "../types";

/**
 * GeminiService handles communication with the Google Gemini API.
 */
export class GeminiService {
  async correctTranscript(transcript: string, metadata: any): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
    const prompt = `
      現在請執行「逐字稿校正」任務。
      
      【會議背景資訊】
      主題：${metadata.subject}
      關鍵字：${metadata.keywords}
      說話者：${metadata.speakers}
      術語：${metadata.terminology}
      長度：${metadata.length}

      【原始逐字稿內容】
      ${transcript}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: "你是一位專業的錄音逐字稿校正員。請根據校正規則進行處理。",
        temperature: 0.2,
      }
    });

    return response.text || "";
  }

  /**
   * 支持對話歷史的分析方法
   */
  async analyzeTranscript(
    transcript: string, 
    modulePrompt: string, 
    history: ChatMessage[] = []
  ): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
    
    // 將歷史紀錄轉換為對話格式
    const historyText = history.map(m => `${m.role === 'user' ? '使用者' : 'AI助手'}: ${m.text}`).join('\n\n');

    const prompt = `
      以下是已校正的會議逐字稿：
      ---
      ${transcript}
      ---
      
      【模組任務目標】
      ${modulePrompt}

      【先前的對話歷史】
      ${history.length > 0 ? historyText : "尚未有對話歷史，請生成初始解讀。"}

      【現在的任務】
      請根據逐字稿內容以及對話脈絡，進行深度的解讀或回應。
      
      輸出要求：
      1. 使用結構化的 Markdown (H1, H2, 點列式)。
      2. 保持洞察的銳利度與專業度。
      3. 針對使用者的疑問或後續要求提供具體證據。
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: "你是一位專業的「會議深度解讀專家」，擅長從逐字稿中提取氛圍、權力、潛台詞等高層次資訊。你的回應應極具洞察力且格式優雅。",
        temperature: 0.7,
      }
    });

    return response.text || "";
  }
}

export const geminiService = new GeminiService();
