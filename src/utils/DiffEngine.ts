import { FeatureDNA } from '../types';

export interface FeatureDiff {
  added: FeatureDNA[];
  modified: { oldFeature: FeatureDNA; newFeature: FeatureDNA }[];
  graveyard: FeatureDNA[];
  unchanged: FeatureDNA[];
}

export const DiffEngine = {
  compare(oldFeatures: FeatureDNA[] = [], newFeatures: FeatureDNA[] = []): FeatureDiff {
    // AI might regenerate IDs, so we match by feature name for a more stable diff
    const oldMap = new Map(oldFeatures.map(f => [f.name.toLowerCase(), f]));
    const newMap = new Map(newFeatures.map(f => [f.name.toLowerCase(), f]));

    const added: FeatureDNA[] = [];
    const modified: { oldFeature: FeatureDNA; newFeature: FeatureDNA }[] = [];
    const graveyard: FeatureDNA[] = [];
    const unchanged: FeatureDNA[] = [];

    for (const newF of newFeatures) {
      const oldF = oldMap.get(newF.name.toLowerCase());
      if (!oldF) {
        added.push(newF);
      } else if (oldF.codeSnippet !== newF.codeSnippet || oldF.behavior !== newF.behavior) {
        modified.push({ oldFeature: oldF, newFeature: newF });
      } else {
        unchanged.push(newF);
      }
    }

    for (const oldF of oldFeatures) {
      if (!newMap.has(oldF.name.toLowerCase())) {
        graveyard.push(oldF);
      }
    }

    return { added, modified, graveyard, unchanged };
  }
};
