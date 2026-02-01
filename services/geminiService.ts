
import { GoogleGenAI } from "@google/genai";

// Using gemini-3-flash-preview for significantly lower latency while maintaining storytelling quality.
const MODEL_ID = 'gemini-3-flash-preview';
const DEFAULT_THINKING_BUDGET = 2048;

/**
 * Executes a unary call to Gemini.
 * @param prompt The prompt string.
 * @param useJson Whether to enforce JSON response.
 * @param thinkingBudget Reasoning budget (set to 0 for fastest response on simple tasks).
 */
export const callGemini = async (
  prompt: string, 
  useJson: boolean = true, 
  thinkingBudget: number = DEFAULT_THINKING_BUDGET
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Using the explicit parts structure for better compatibility with proxy environments
  const response = await ai.models.generateContent({
    model: MODEL_ID,
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      thinkingConfig: { thinkingBudget: thinkingBudget },
      responseMimeType: useJson ? "application/json" : undefined
    }
  });

  let text = response.text || "";

  if (useJson) {
    // 1. Remove markdown code blocks if present
    text = text.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "");

    // 2. Extract JSON object substring
    const firstOpen = text.indexOf('{');
    const lastClose = text.lastIndexOf('}');
    
    if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
      text = text.substring(firstOpen, lastClose + 1);
    }
  }

  return text;
};

/**
 * Streams a response from Gemini.
 */
export const streamGemini = async function* (prompt: string) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const responseStream = await ai.models.generateContentStream({
    model: MODEL_ID,
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      thinkingConfig: { thinkingBudget: DEFAULT_THINKING_BUDGET }
    }
  });

  for await (const chunk of responseStream) {
    yield chunk.text || "";
  }
};
