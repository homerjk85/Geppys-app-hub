import { GoogleGenAI, Type } from "@google/genai";
import { FeatureDNA, StyleDNA, AppBlueprint } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const auditService = {
  async analyzeCodebase(fileMap: Record<string, string>, oldFeatures?: FeatureDNA[]): Promise<AppBlueprint> {
    const oldFeaturesContext = oldFeatures && oldFeatures.length > 0
      ? `\nPrevious Features:\n${JSON.stringify(oldFeatures, null, 2)}\n\nIf a feature from the Previous Features is no longer present in the Codebase Map, mark it as 'graveyard'. For graveyard features, you MUST provide a 'removalReason' (one of: 'replaced', 'missing', 'user_requested', 'ai_assumed') and 'removalNotes' explaining why it was removed.`
      : `\nIf a feature is present in the code but seems deprecated or unused, mark it as 'graveyard'. For graveyard features, you MUST provide a 'removalReason' (one of: 'replaced', 'missing', 'user_requested', 'ai_assumed') and 'removalNotes' explaining why it was removed.`;

    const prompt = `You are the Geppy Architect. I am providing a JSON map of a codebase.

Your Task:
1. Identify every unique functional feature and extract its 'DNA' (the core logic).
2. Map out the StyleManifest based on the CSS/Tailwind classes found. Include primary and secondary colors (if no secondary color is obvious, use a complementary color or default to a dark blue/orange theme).
3. Write a detailed, webpage-ready 'appDescription' that thoroughly explains the app's purpose and features.
4. Write a 'recentChanges' summary explaining what is new or changed in this version compared to the previous features (if provided). If this is the first import, just summarize the initial state.
5. Provide 2-3 'featureSuggestions' (new features that would enhance the app) and 2-3 'functionalitySuggestions' (performance, refactoring, or effectiveness improvements). For each, provide a title, description, and a 'codeSnippet' (a prompt or code block I can paste into an AI assistant to implement it).
6. Analyze the app for buttons and assets. Identify all buttons that are needed or present, and what they are for. Also identify any images or logos.

Return a Single JSON Object with this structure:
{ "appDescription": string, "recentChanges": string, "features": [FeatureDNA], "style": StyleDNA, "currentPhase": string, "featureSuggestions": [AISuggestion], "functionalitySuggestions": [AISuggestion], "assets": [AppAsset] }

Constraint: Do not explain anything. Only return the JSON.
${oldFeaturesContext}

Codebase Map:
${JSON.stringify(fileMap, null, 2)}`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              appDescription: { type: Type.STRING },
              recentChanges: { type: Type.STRING },
              features: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    name: { type: Type.STRING },
                    behavior: { type: Type.STRING },
                    codeSnippet: { type: Type.STRING },
                    status: { type: Type.STRING },
                    removalReason: { type: Type.STRING },
                    removalNotes: { type: Type.STRING },
                    dependencies: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                  },
                  required: ["id", "name", "behavior", "codeSnippet", "status", "dependencies"],
                },
              },
              featureSuggestions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    codeSnippet: { type: Type.STRING },
                  },
                  required: ["id", "title", "description", "codeSnippet"],
                },
              },
              functionalitySuggestions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    codeSnippet: { type: Type.STRING },
                  },
                  required: ["id", "title", "description", "codeSnippet"],
                },
              },
              assets: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    type: { type: Type.STRING, enum: ['favicon', 'logo', 'button', 'image'] },
                    name: { type: Type.STRING },
                    url: { type: Type.STRING },
                    className: { type: Type.STRING },
                  },
                  required: ["id", "type", "name", "url"],
                },
              },
              style: {
                type: Type.OBJECT,
                properties: {
                  primaryColor: { type: Type.STRING },
                  secondaryColor: { type: Type.STRING },
                  borderRadius: { type: Type.STRING },
                  componentVibe: { type: Type.STRING },
                  tailwindConfigSnippet: { type: Type.STRING },
                },
                required: ["primaryColor", "secondaryColor", "borderRadius", "componentVibe", "tailwindConfigSnippet"],
              },
              currentPhase: { type: Type.STRING },
            },
            required: ["appDescription", "recentChanges", "features", "style", "currentPhase"],
          },
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error("No response from Gemini");
      }

      return JSON.parse(text) as AppBlueprint;
    } catch (error) {
      console.error("Failed to audit codebase:", error);
      throw error;
    }
  }
};
