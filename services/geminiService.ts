
import { GoogleGenAI, Type } from "@google/genai";

// Using gemini-3-flash-preview for significantly lower latency while maintaining storytelling quality.
const MODEL_ID = 'gemini-3-flash-preview';
const DEFAULT_THINKING_BUDGET = 2048;

/**
 * Formal schema for the game engine's JSON response.
 * This ensures the model always returns structured data that matches our types.
 */
export const GAME_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    thoughtProcess: {
      type: Type.STRING,
      description: "Internal reasoning about the player's action and state changes."
    },
    markdownOutput: {
      type: Type.STRING,
      description: "The narrative story text to be displayed to the player. Use Markdown for formatting."
    },
    newLocationId: {
      type: Type.STRING,
      description: "The ID of the new location if the player moved."
    },
    inventoryUpdate: {
      type: Type.OBJECT,
      properties: {
        add: { type: Type.ARRAY, items: { type: Type.STRING } },
        remove: { type: Type.ARRAY, items: { type: Type.STRING } }
      }
    },
    dispositionUpdate: {
      type: Type.OBJECT,
      properties: {
        holmes: { type: Type.OBJECT, properties: { trust: { type: Type.NUMBER }, annoyance: { type: Type.NUMBER } } },
        abberline: { type: Type.OBJECT, properties: { trust: { type: Type.NUMBER }, annoyance: { type: Type.NUMBER } } },
        bond: { type: Type.OBJECT, properties: { trust: { type: Type.NUMBER }, annoyance: { type: Type.NUMBER } } },
        edmund: { type: Type.OBJECT, properties: { trust: { type: Type.NUMBER }, annoyance: { type: Type.NUMBER } } },
        lusk: { type: Type.OBJECT, properties: { trust: { type: Type.NUMBER }, annoyance: { type: Type.NUMBER } } }
      }
    },
    flagsUpdate: {
      type: Type.OBJECT,
      description: "Key-value pairs of flags to update in the global state."
    },
    sanityUpdate: {
      type: Type.NUMBER,
      description: "Amount to change sanity by (e.g., -5 or +10)."
    },
    medicalPointsUpdate: {
      type: Type.NUMBER,
      description: "Amount to change medical points by."
    },
    moralPointsUpdate: {
      type: Type.NUMBER,
      description: "Amount to change moral points by."
    },
    locationMutations: {
      type: Type.OBJECT,
      description: "Updates to specific location states, keyed by locationId."
    },
    npcMutations: {
      type: Type.OBJECT,
      description: "Updates to specific NPC states, keyed by npcId."
    },
    npcMemoryUpdate: {
      type: Type.OBJECT,
      description: "A 10-word summary of the interaction to add to an NPC's memory, keyed by npcId."
    },
    discoveredClues: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          clueId: { type: Type.STRING },
          name: { type: Type.STRING },
          description: { type: Type.STRING },
          discoveredAt: { type: Type.STRING },
          locationFound: { type: Type.STRING },
          connections: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["clueId", "name", "description", "discoveredAt"]
      }
    },
    gameOver: {
      type: Type.BOOLEAN,
      description: "Whether the investigation has concluded."
    }
  },
  required: ["markdownOutput"]
};

/**
 * Executes a unary call to Gemini.
 * @param prompt The prompt string.
 * @param useJson Whether to enforce JSON response.
 * @param thinkingBudget Reasoning budget (set to 0 for fastest response on simple tasks).
 * @param systemInstruction Optional system instruction to guide the model.
 */
export const callGemini = async (
  prompt: string, 
  useJson: boolean = true, 
  thinkingBudget: number = DEFAULT_THINKING_BUDGET,
  systemInstruction?: string
): Promise<string> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing. Please check your environment variables.");
  }
  const ai = new GoogleGenAI({ apiKey });

  // Using the explicit parts structure for better compatibility with proxy environments
  const response = await ai.models.generateContent({
    model: MODEL_ID,
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      systemInstruction: systemInstruction,
      thinkingConfig: { thinkingBudget: thinkingBudget },
      responseMimeType: useJson ? "application/json" : undefined,
      responseSchema: useJson ? GAME_RESPONSE_SCHEMA : undefined
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
 * Streams a response from Gemini, yielding only the narrative text (markdownOutput)
 * as it arrives.
 * @param prompt The prompt string.
 * @param systemInstruction Optional system instruction.
 */
export const streamGemini = async function* (prompt: string, systemInstruction?: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing. Please check your environment variables.");
  }
  const ai = new GoogleGenAI({ apiKey });
  
  const responseStream = await ai.models.generateContentStream({
    model: MODEL_ID,
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      systemInstruction: systemInstruction,
      thinkingConfig: { thinkingBudget: DEFAULT_THINKING_BUDGET },
      responseMimeType: "application/json",
      responseSchema: GAME_RESPONSE_SCHEMA
    }
  });

  let fullJsonText = "";
  let lastNarrative = "";

  for await (const chunk of responseStream) {
    fullJsonText += chunk.text || "";
    
    // Attempt to extract the markdownOutput field from the partial JSON
    const currentNarrative = extractMarkdownFromPartialJson(fullJsonText);
    
    if (currentNarrative && currentNarrative !== lastNarrative) {
      // Yield only the new parts of the narrative for the UI
      // Actually, yielding the full current narrative is easier for the UI to handle by replacement
      yield {
        narrative: currentNarrative,
        fullJson: fullJsonText,
        isComplete: false
      };
      lastNarrative = currentNarrative;
    }
  }

  yield {
    narrative: lastNarrative,
    fullJson: fullJsonText,
    isComplete: true
  };
};

/**
 * Helper to extract the value of "markdownOutput" from a potentially incomplete JSON string.
 * Handles basic escaping.
 */
/**
 * Helper to extract the value of "markdownOutput" from a potentially incomplete JSON string.
 * Handles escaping correctly by using a more robust state machine.
 */
function extractMarkdownFromPartialJson(json: string): string {
  const marker = '"markdownOutput":';
  const startIdx = json.indexOf(marker);
  if (startIdx === -1) return "";

  // Find the start of the string value
  let valueStart = json.indexOf('"', startIdx + marker.length);
  if (valueStart === -1) return "";
  valueStart += 1; // Move past the opening quote

  let result = "";
  let i = valueStart;
  
  while (i < json.length) {
    const char = json[i];
    if (char === '\\') {
      // Look ahead for escape sequence
      if (i + 1 < json.length) {
        const nextChar = json[i + 1];
        if (nextChar === 'n') result += '\n';
        else if (nextChar === 'r') result += '\r';
        else if (nextChar === 't') result += '\t';
        else if (nextChar === '"') result += '"';
        else if (nextChar === '\\') result += '\\';
        else result += nextChar;
        i += 2;
        continue;
      } else {
        // Incomplete escape sequence at the end of chunk
        break;
      }
    } else if (char === '"') {
      // Potential end of string
      // Check if it's followed by a comma or closing brace to be sure
      // But in streaming, we might not have that yet.
      // For now, we assume the first unescaped quote is the end.
      break;
    } else {
      result += char;
      i++;
    }
  }

  return result;
}
