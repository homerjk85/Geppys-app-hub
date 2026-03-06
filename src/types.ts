export interface FeatureDNA {
  id: string; // e.g., "auth-system"
  name: string;
  behavior: string; // Plain English description of what it does
  codeSnippet: string; // The "Source of Truth" code block
  status: 'active' | 'in-progress' | 'graveyard';
  removalReason?: 'replaced' | 'missing' | 'user_requested' | 'ai_assumed';
  removalNotes?: string;
  dependencies: string[]; 
}

export interface StyleDNA {
  primaryColor: string;
  secondaryColor: string;
  borderRadius: string;
  componentVibe: string; // e.g., "tactile-glossy" or "flat-minimal"
  tailwindConfigSnippet: string;
}

export interface AISuggestion {
  id: string;
  title: string;
  description: string;
  codeSnippet: string; // The code or prompt to copy/paste into AI Studio
}

export interface AppAsset {
  id: string;
  type: 'favicon' | 'logo' | 'button' | 'image';
  name: string;
  url?: string;
  className?: string; // For button styling preview
  content?: string; // For button text or icon name
}

export interface AppBlueprint {
  appDescription: string;
  recentChanges: string;
  features: FeatureDNA[];
  previousFeatures?: FeatureDNA[]; // To show the diff of the last update
  style: StyleDNA;
  currentPhase: string;
  featureSuggestions?: AISuggestion[];
  functionalitySuggestions?: AISuggestion[];
  assets?: AppAsset[];
}

export interface ChangelogEntry {
  version: string;
  timestamp: number;
  changes: string;
  originalFilename?: string;
}

export interface AppManifest {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  version: string;
  status: 'draft' | 'published' | 'archived';
  githubUrl?: string;
  blueprint?: AppBlueprint;
  changelog?: ChangelogEntry[];
}

export interface HubState {
  apps: AppManifest[];
  archives: any[];
  styleManifests: any[];
}