
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const callGemini = async (prompt: string, useJson: boolean = true): Promise<string> => {
  const modelId = 'gemini-3-pro-preview';

  const response = await ai.models.generateContent({
    model: modelId,
    contents: prompt,
    config: {
      thinkingConfig: { thinkingBudget: 32768 },
      responseMimeType: useJson ? "application/json" : undefined
    }
  });

  let text = response.text || "";

  if (useJson) {
    // 1. Remove markdown code blocks (e.g. ```json ... ```)
    text = text.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "");

    // 2. Find the JSON object substring (handles preamble text)
    const firstOpen = text.indexOf('{');
    const lastClose = text.lastIndexOf('}');
    
    if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
      text = text.substring(firstOpen, lastClose + 1);
    }
  }

  return text;
};

export const streamGemini = async function* (prompt: string) {
  const modelId = 'gemini-3-pro-preview';
  
  const responseStream = await ai.models.generateContentStream({
    model: modelId,
    contents: prompt,
    config: {
      thinkingConfig: { thinkingBudget: 16000 }
    }
  });

  for await (const chunk of responseStream) {
    yield chunk.text || "";
  }
};
