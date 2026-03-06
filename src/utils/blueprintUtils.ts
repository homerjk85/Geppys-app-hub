import { AppBlueprint } from "../types";

export const generateFallbackBlueprint = (fileMap: Record<string, string>, errorMsg: string): AppBlueprint => {
    const fileCount = Object.keys(fileMap).length;
    const fileNames = Object.keys(fileMap).slice(0, 5).join(", ");
    const hasPackageJson = !!fileMap['package.json'];
    let appName = "Imported App";
    let appDesc = `Contains ${fileCount} source files. Analysis could not be completed. ${errorMsg}`;

    if (hasPackageJson) {
        try {
            const pkg = JSON.parse(fileMap['package.json']);
            if (pkg.name) appName = pkg.name;
            if (pkg.description) appDesc = pkg.description;
        } catch (e) { /* ignore */ }
    }

    return {
        appDescription: appDesc,
        recentChanges: `Imported ${fileCount} files.`,
        features: [
            {
                id: "files-manifest",
                name: "Source Files",
                behavior: "Raw source code imported from zip archive.",
                codeSnippet: "// Files present: " + fileNames + (fileCount > 5 ? "..." : ""),
                status: "active",
                dependencies: []
            }
        ],
        style: {
            primaryColor: "#64748b", // Slate-500
            secondaryColor: "#94a3b8", // Slate-400
            borderRadius: "0.5rem",
            componentVibe: "Neutral",
            tailwindConfigSnippet: "// Default fallback style"
        },
        currentPhase: "Imported",
        featureSuggestions: [],
        functionalitySuggestions: [],
        assets: []
    };
};
