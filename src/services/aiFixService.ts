import { GoogleGenAI } from "@google/genai";

export interface DiagnosticContext {
  errorMessage: string;
  filePath: string;
  fileContent: string;
  appBlueprint: any; // The DNA of the app
}

export const aiFixService = {
  async getFixFromAI(context: DiagnosticContext, apiKey: string) {
    const ai = new GoogleGenAI({ apiKey });
    
    // Using a capable model for code analysis
    const modelName = "gemini-3.1-pro-preview"; 

    const prompt = `
      You are Geppy, the Master Debugger for the Geppy App Hub. 
      An error has occurred in a live sandbox preview.
      
      --- APP CONTEXT (DNA) ---
      Description: ${context.appBlueprint.appDescription}
      Style Vibe: ${context.appBlueprint.style?.componentVibe}
      
      --- ERROR DETAILS ---
      File Path: ${context.filePath}
      Error Message: ${context.errorMessage}
      
      --- CURRENT FILE CONTENT ---
      \`\`\`tsx
      ${context.fileContent}
      \`\`\`
      
      INSTRUCTIONS:
      1. Analyze the error message and the code.
      2. Fix the error while preserving the original logic and styling.
      3. If the error is a "Module Not Found", suggest the missing dependency.
      4. Return ONLY a JSON object with this structure:
      {
        "fixedCode": "the entire updated file content",
        "explanation": "briefly what was wrong",
        "missingDependencies": ["list", "of", "pkgs", "if", "any"]
      }
    `;

    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      const text = response.text;
      if (!text) throw new Error("No response from AI");
      
      // Clean up the response (remove markdown code blocks if AI included them despite JSON mode)
      const jsonStr = text.replace(/```json|```/g, "").trim();
      return JSON.parse(jsonStr);
    } catch (error) {
      console.error("Geppy Fix Failed:", error);
      throw new Error("Could not generate a fix. Please try manual debugging.");
    }
  }
};
