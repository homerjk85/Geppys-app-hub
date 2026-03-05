import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface TailwindContextType {
  styleVariables: Record<string, string>;
  updateStyleVariable: (key: string, value: string) => void;
  scanFileMap: (fileMap: Record<string, string>) => void;
  injectVariables: (fileMap: Record<string, string>) => Record<string, string>;
}

const TailwindContext = createContext<TailwindContextType | undefined>(undefined);

export const TailwindProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [styleVariables, setStyleVariables] = useState<Record<string, string>>({});

  const scanFileMap = (fileMap: Record<string, string>) => {
    // Look for index.css or globals.css
    const cssFile = Object.entries(fileMap).find(([path]) => path.endsWith('index.css') || path.endsWith('globals.css'));
    if (cssFile) {
      const content = cssFile[1];
      const rootRegex = /:root\s*{([^}]+)}/;
      const match = content.match(rootRegex);
      if (match) {
        const vars = match[1].split(';').reduce((acc, line) => {
          const [key, value] = line.split(':').map(s => s.trim());
          if (key && key.startsWith('--')) {
            acc[key] = value;
          }
          return acc;
        }, {} as Record<string, string>);
        setStyleVariables(vars);
      }
    }
  };

  const updateStyleVariable = (key: string, value: string) => {
    setStyleVariables(prev => ({ ...prev, [key]: value }));
  };

  const injectVariables = (fileMap: Record<string, string>) => {
    if (Object.keys(styleVariables).length === 0) return fileMap;

    const newFileMap = { ...fileMap };
    const cssFilePath = Object.keys(newFileMap).find(path => path.endsWith('index.css') || path.endsWith('globals.css'));
    
    if (cssFilePath) {
      let content = newFileMap[cssFilePath];
      
      // Replace or add variables in :root
      const rootRegex = /:root\s*{([^}]+)}/;
      const match = content.match(rootRegex);
      
      if (match) {
        let newRootContent = match[1];
        Object.entries(styleVariables).forEach(([key, value]) => {
          const varRegex = new RegExp(`${key}\\s*:\\s*[^;]+;`, 'g');
          if (varRegex.test(newRootContent)) {
            newRootContent = newRootContent.replace(varRegex, `${key}: ${value};`);
          } else {
            newRootContent += `\n  ${key}: ${value};`;
          }
        });
        content = content.replace(rootRegex, `:root {${newRootContent}}`);
      } else {
        // If no :root exists, add one
        const varsString = Object.entries(styleVariables).map(([k, v]) => `  ${k}: ${v};`).join('\n');
        content += `\n\n:root {\n${varsString}\n}`;
      }
      
      newFileMap[cssFilePath] = content;
    }

    return newFileMap;
  };

  return (
    <TailwindContext.Provider value={{ styleVariables, updateStyleVariable, scanFileMap, injectVariables }}>
      {children}
    </TailwindContext.Provider>
  );
};

export const useTailwind = () => {
  const context = useContext(TailwindContext);
  if (context === undefined) {
    throw new Error('useTailwind must be used within a TailwindProvider');
  }
  return context;
};
