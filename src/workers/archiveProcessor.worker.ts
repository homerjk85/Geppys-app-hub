import JSZip from 'jszip';
import { AppBlueprint, FeatureDNA, AISuggestion, StyleDNA } from "../types";
import { generateFallbackBlueprint } from "../utils/blueprintUtils";

// Dynamic imports for GenAI to avoid top-level failures
let GoogleGenAI: any;
let Type: any;

// Define message types
export type WorkerMessage = 
  | { type: 'START'; file: ArrayBuffer | Blob; apiKey: string; oldFeatures?: FeatureDNA[]; analyze?: boolean }
  | { type: 'PROGRESS'; status: string; progress: number }
  | { type: 'SUCCESS'; fileMap: Record<string, string>; blueprint?: AppBlueprint; analysisError?: string }
  | { type: 'ERROR'; error: string };

// --- Logic from extractionService.ts ---
const IGNORED_DIRECTORIES = [
  'node_modules', '.git', 'dist', 'build', '.next', 'out', 'coverage', 
  '.vscode', '.idea', '.DS_Store', '__MACOSX', 
  'vendor', 'tmp', 'temp', 'logs', 'bin', 'obj', 'jspm_packages', 'bower_components'
];

const ALLOWED_EXTENSIONS = [
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', 
  '.css', '.scss', '.sass', '.less', 
  '.html', '.htm', 
  '.json', '.json5', '.jsonc', 
  '.md', '.mdx', '.txt', 
  '.yml', '.yaml', 
  '.xml', '.svg', 
  '.vue', '.svelte', '.astro',
  '.sql', '.graphql', '.prisma',
  '.py', '.rb', '.php', '.java', '.go', '.rs', '.c', '.cpp', '.h', '.cs', '.sh', '.bat',
  '.toml', '.ini', '.conf'
];

const ALLOWED_FILENAMES = [
  'Dockerfile', 'LICENSE', 'README', 'Makefile', 
  '.env', '.env.example', '.gitignore', '.dockerignore', '.editorconfig',
  'Procfile', 'netlify.toml', 'vercel.json', 'now.json'
];

const MAX_FILE_SIZE = 1000000; // 1MB limit per file for AI analysis

const processZipUpload = async (file: ArrayBuffer | Blob): Promise<Record<string, string>> => {
  const zip = new JSZip();
  const contents = await zip.loadAsync(file);
  const rawFileMap: Record<string, string> = {};

  const fileEntries = Object.entries(contents.files);
  const totalFiles = fileEntries.length;
  let processedCount = 0;

  for (const [path, fileEntry] of fileEntries) {
    // Skip directories
    if (fileEntry.dir) {
        processedCount++;
        continue;
    }

    // Check for ignored directories
    const isIgnored = IGNORED_DIRECTORIES.some(dir => path.includes(`/${dir}/`) || path.startsWith(`${dir}/`));
    if (isIgnored) {
        processedCount++;
        continue;
    }

    // Check extension or exact filename
    const lastDotIndex = path.lastIndexOf('.');
    const extension = lastDotIndex !== -1 ? path.substring(lastDotIndex).toLowerCase() : '';
    const filename = path.split('/').pop() || '';
    
    const isAllowedExtension = ALLOWED_EXTENSIONS.includes(extension);
    const isAllowedFilename = ALLOWED_FILENAMES.includes(filename) || ALLOWED_FILENAMES.includes(filename.toUpperCase()); // Case insensitive check for some

    if (isAllowedExtension || isAllowedFilename) {
      const text = await fileEntry.async('string');
      // Only include files that aren't massive to keep the AI prompt manageable
      if (text.length < MAX_FILE_SIZE) {
        // Skip minified files
        if (!filename.includes('.min.') && !filename.includes('-min.')) {
            rawFileMap[path] = text;
        }
      }
    }
    
    processedCount++;
    // Report progress every 10 files
    if (processedCount % 10 === 0) {
        self.postMessage({ type: 'PROGRESS', status: `Decompressing ${path}...`, progress: Math.round((processedCount / totalFiles) * 50) });
    }
  }

  // Post-processing: Strip top-level directory if it exists (e.g. "my-app-main/src/..." -> "src/...")
  const paths = Object.keys(rawFileMap);
  if (paths.length > 0) {
    const firstPathParts = paths[0].split('/');
    if (firstPathParts.length > 1) {
      const potentialRoot = firstPathParts[0] + '/';
      const rootName = firstPathParts[0];
      
      // Don't strip if the root folder is a common source directory
      const PROTECTED_ROOTS = ['src', 'public', 'app', 'pages', 'components', 'lib', 'assets', 'server', 'utils', 'styles'];
      if (PROTECTED_ROOTS.includes(rootName)) {
        return rawFileMap;
      }

      const allStartWithRoot = paths.every(p => p.startsWith(potentialRoot));
      
      if (allStartWithRoot) {
        const cleanedFileMap: Record<string, string> = {};
        for (const [path, content] of Object.entries(rawFileMap)) {
          cleanedFileMap[path.substring(potentialRoot.length)] = content;
        }
        return cleanedFileMap;
      }
    }
  }
  
  return rawFileMap;
};

// --- Logic from auditService.ts ---

const calculateFileRelevance = (path: string, content: string): number => {
    let score = 0;
    const filename = path.split('/').pop() || '';
    const lowerPath = path.toLowerCase();

    // 1. Critical Config Files (Highest Priority)
    if (filename === 'package.json') score += 100;
    if (filename === 'tsconfig.json') score += 90;
    if (filename === 'README.md') score += 85;
    if (filename === '.env.example') score += 80;
    if (filename === 'vite.config.ts' || filename === 'next.config.js') score += 80;

    // 2. Entry Points
    if (lowerPath.includes('src/main.') || lowerPath.includes('src/index.') || lowerPath.includes('src/app.')) score += 70;
    if (lowerPath.includes('pages/_app') || lowerPath.includes('pages/index')) score += 70;

    // 3. Source Code
    if (lowerPath.startsWith('src/')) score += 50;
    if (lowerPath.includes('components/')) score += 40;
    if (lowerPath.includes('hooks/')) score += 40;
    if (lowerPath.includes('utils/') || lowerPath.includes('lib/')) score += 30;
    if (lowerPath.includes('types') || lowerPath.includes('interfaces')) score += 35;

    // 4. Styles
    if (lowerPath.endsWith('.css') || lowerPath.endsWith('.scss')) score += 20;
    if (lowerPath.includes('tailwind')) score += 25;

    // 5. Penalties for less relevant files
    if (lowerPath.includes('test') || lowerPath.includes('spec')) score -= 50;
    if (lowerPath.includes('stories')) score -= 30; // Storybook files
    if (lowerPath.includes('assets/') || lowerPath.includes('public/')) score -= 20;
    if (content.length > 20000) score -= 10; // Penalty for huge files

    return score;
};

const analyzeCodebase = async (fileMap: Record<string, string>, apiKey: string, oldFeatures?: FeatureDNA[]): Promise<AppBlueprint> => {
    // Check if fileMap is empty
    if (Object.keys(fileMap).length === 0) {
        return {
            appDescription: "No valid source files found in the uploaded archive. Please check your zip file structure and ensure it contains supported file types.",
            recentChanges: "Upload failed: No source files detected.",
            features: [],
            style: { 
                primaryColor: "#888888", 
                secondaryColor: "#CCCCCC",
                borderRadius: "0px",
                componentVibe: "Empty",
                tailwindConfigSnippet: "// No files found"
            },
            currentPhase: "Error",
            featureSuggestions: [],
            functionalitySuggestions: []
        };
    }

    // Load GenAI dynamically if not already loaded
    if (!GoogleGenAI || !Type) {
        try {
            const module = await import("@google/genai");
            GoogleGenAI = module.GoogleGenAI;
            Type = module.Type;
        } catch (e) {
            console.error("Failed to load @google/genai module:", e);
            throw new Error("Failed to load AI module. Please check your connection.");
        }
    }

    const ai = new GoogleGenAI({ apiKey });

    // 1. Sort files by relevance
    const sortedFiles = Object.entries(fileMap)
        .map(([path, content]) => ({ path, content, score: calculateFileRelevance(path, content) }))
        .sort((a, b) => b.score - a.score);

    // 2. Create a compact representation of the codebase
    // We'll take the top files until we hit a character limit
    const MAX_PROMPT_CHARS = 3000000;
    let currentChars = 0;
    const includedFiles: string[] = [];

    const codebaseSummary = sortedFiles
      .filter(f => {
          if (currentChars > MAX_PROMPT_CHARS) return false;
          // Truncate individual files if they are too large, but keep more of the important ones
          const maxFileLength = f.score > 50 ? 50000 : 10000;
          const content = f.content.substring(0, maxFileLength);
          
          currentChars += content.length + f.path.length + 20; // + overhead
          includedFiles.push(f.path);
          return true;
      })
      .map(f => `FILE: ${f.path}\nCONTENT:\n${f.content.substring(0, f.score > 50 ? 50000 : 10000)}`)
      .join("\n\n---\n\n");

    console.log(`AI Analysis: Included ${includedFiles.length} files out of ${sortedFiles.length}. Top files: ${includedFiles.slice(0, 5).join(', ')}`);

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
6. Analyze the app for buttons and assets. Go through the visual files (React components, HTML, etc.) and find out what all buttons are going to be in there and what they'll look like. This includes all buttons like back buttons, front buttons, undos, tab buttons, or anything that gets highlighted or acts as a button. For each button, add it to the 'assets' array with type 'button', provide a descriptive name, extract its exact Tailwind classes into the 'className' field, and extract its text or icon into the 'content' field. Also identify any images or logos and add them as type 'image'. YOU MUST RETURN AT LEAST ONE ASSET IF THERE ARE ANY BUTTONS OR IMAGES.

Return a Single JSON Object with this structure:
{ "appDescription": string, "recentChanges": string, "features": [FeatureDNA], "style": StyleDNA, "currentPhase": string, "featureSuggestions": [AISuggestion], "functionalitySuggestions": [AISuggestion], "assets": [AppAsset] }

Constraint: Do not explain anything. Only return the JSON.
${oldFeaturesContext}

Codebase Summary:
${codebaseSummary}`;

    // Note: We do NOT wrap this in a try-catch block anymore.
    // We want any API errors (like 400 Invalid Key) to propagate up to the worker's main handler
    // so they can be returned to the UI as specific 'analysisError' messages.
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
                  content: { type: Type.STRING },
                },
                required: ["id", "type", "name"],
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
          required: ["appDescription", "recentChanges", "features", "style", "currentPhase", "assets"],
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response from Gemini");
    }

    return JSON.parse(text) as AppBlueprint;
};

// --- Worker Event Listener ---
self.onmessage = async (e: MessageEvent) => {
  console.log('Worker received message:', e.data);
  const { type, file, apiKey, oldFeatures, analyze } = e.data;
  
  // Only process START messages
  if (type !== 'START') {
    console.warn('Worker received unknown message type:', type);
    return;
  }

  let fileMap: Record<string, string> = {};

  try {
    // 1. Decompress
    console.log('Worker starting decompression...');
    self.postMessage({ type: 'PROGRESS', status: 'Decompressing archive...', progress: 0 });
    fileMap = await processZipUpload(file);
    console.log('Worker decompression complete. Files found:', Object.keys(fileMap).length);
    self.postMessage({ type: 'PROGRESS', status: 'Decompression complete', progress: 50 });

    if (!analyze) {
       console.log('Worker skipping analysis (analyze=false)');
       self.postMessage({ type: 'SUCCESS', fileMap });
       return;
    }

    // 2. Analyze
    console.log('Worker starting analysis...');
    
    let blueprint: AppBlueprint | undefined;
    let analysisError = '';

    // STRICT CHECK: Only run if a key is explicitly provided in the message
    if (apiKey && apiKey.trim() !== '') {
      self.postMessage({ type: 'PROGRESS', status: 'Auditing codebase with Gemini Architect...', progress: 60 });
      try {
        blueprint = await analyzeCodebase(fileMap, apiKey, oldFeatures);
        console.log('Worker analysis complete');
        self.postMessage({ type: 'PROGRESS', status: 'Analysis complete', progress: 100 });
      } catch (err: any) {
        console.error("AI Analysis failed:", err);
        analysisError = err.message || String(err);
        
        // Detect API Key errors specifically
        if (analysisError.includes("400") || analysisError.includes("API key not valid") || analysisError.includes("403") || analysisError.includes("permission_denied")) {
            analysisError = "The provided API Key (System or Custom) is invalid. Please enter a valid Custom API Key in the 'Features & Preview' tab.";
        }
        
        // Use fallback blueprint so the app still updates with the files
        blueprint = generateFallbackBlueprint(fileMap, analysisError);
        self.postMessage({ type: 'PROGRESS', status: 'Analysis failed (using fallback), skipping...', progress: 100 });
      }
    } else {
      console.log('Worker skipping analysis: No API key provided');
      analysisError = 'AI analysis skipped: No API key provided.';
      // Use fallback blueprint
      blueprint = generateFallbackBlueprint(fileMap, analysisError);
      self.postMessage({ type: 'PROGRESS', status: 'Analysis skipped (no key), using fallback', progress: 100 });
    }

    // Always succeed with the fileMap, even if blueprint is missing
    self.postMessage({ type: 'SUCCESS', fileMap, blueprint, analysisError });

  } catch (error: any) {
    console.error('Worker error:', error);
    // If we managed to get the fileMap but failed later (likely due to API key), return success with just the fileMap
    if (Object.keys(fileMap).length > 0) {
       console.warn("Worker caught error after decompression. Returning fileMap without blueprint.", error);
       self.postMessage({ type: 'SUCCESS', fileMap, blueprint: undefined });
       return;
    }
    self.postMessage({ type: 'ERROR', error: error.message || 'Unknown worker error' });
  }
};
