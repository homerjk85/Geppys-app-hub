import { z } from 'zod';

export const featureDNASchema = z.object({
  id: z.string(),
  name: z.string(),
  behavior: z.string(),
  codeSnippet: z.string(),
  status: z.enum(['active', 'in-progress', 'graveyard']),
  removalReason: z.enum(['replaced', 'missing', 'user_requested', 'ai_assumed']).optional(),
  removalNotes: z.string().optional(),
  dependencies: z.array(z.string()),
});

export const styleDNASchema = z.object({
  primaryColor: z.string(),
  secondaryColor: z.string(),
  borderRadius: z.string(),
  componentVibe: z.string(),
  tailwindConfigSnippet: z.string(),
});

export const aiSuggestionSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  codeSnippet: z.string(),
});

export const appAssetSchema = z.object({
  id: z.string(),
  type: z.enum(['favicon', 'logo', 'button', 'image']),
  name: z.string(),
  url: z.string().optional(),
  className: z.string().optional(),
  content: z.string().optional(),
});

export const appBlueprintSchema = z.object({
  appDescription: z.string(),
  recentChanges: z.string(),
  features: z.array(featureDNASchema),
  previousFeatures: z.array(featureDNASchema).optional(),
  style: styleDNASchema,
  currentPhase: z.string(),
  featureSuggestions: z.array(aiSuggestionSchema).optional(),
  functionalitySuggestions: z.array(aiSuggestionSchema).optional(),
  assets: z.array(appAssetSchema).optional(),
});
