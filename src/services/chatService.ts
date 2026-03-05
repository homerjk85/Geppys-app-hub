import { GoogleGenAI } from "@google/genai";
import { AppManifest } from "../types";

export const chatService = {
  createSession: (appContext?: AppManifest | null, customApiKey?: string) => {
    let apiKey = customApiKey || process.env.GEMINI_API_KEY || process.env.API_KEY;
    
    if (apiKey) {
      apiKey = apiKey.trim();
      while ((apiKey.startsWith('"') && apiKey.endsWith('"')) || (apiKey.startsWith("'") && apiKey.endsWith("'"))) {
        apiKey = apiKey.slice(1, -1);
      }
    }

    if (!apiKey) {
      console.warn("GEMINI_API_KEY not found. Chat features will be disabled.");
      return null;
    }
    
    const ai = new GoogleGenAI({ apiKey });

    let systemInstruction = `You are Geppy, an expert AI web developer, product designer, and prompt engineer. 
Your goal is to help the user design and architect web applications.
When the user shares an app idea, act as a 'Prompt Building Wizard'.
1. Flesh out the idea with good UX/UI suggestions.
2. Create a comprehensive 'Initial Request' prompt that the user can copy-paste into an AI coding assistant (like AI Studio) to build the app.
3. Provide step-by-step instructions on how to iterate on the app (e.g., 'Step 1: Ask for the basic UI. Step 2: Add database integration...').
4. Act as a "Master of Apps" - helping with accessibility, usability, feature functions, and design.
5. Help the user monitor and readjust their plan if things get out of whack.

Be friendly, enthusiastic, and use emojis. Keep your responses structured and easy to read.
Use markdown to format your responses. If you provide a prompt for the user to copy, put it in a markdown code block so it's easy to copy.

IMPORTANT: If you are suggesting a code change to an existing file, you MUST format the markdown code block with the filename like this:
\`\`\`tsx:src/App.tsx
// code here
\`\`\`
This allows the user to click "Apply to Codebase" to automatically update the file.`;

    if (appContext) {
      systemInstruction += `\n\nCURRENT CONTEXT: The user is currently viewing their app named "${appContext.name}".
Description: ${appContext.description}
Version: ${appContext.version}
Blueprint/DNA: ${appContext.blueprint ? JSON.stringify(appContext.blueprint) : "Not available yet."}

When the user asks questions about this app, use this context to provide specific, tailored advice, prompts, and analysis.`;
    }

    return ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction,
      },
    });
  }
};
