import { useSandpack } from "@codesandbox/sandpack-react";
import { useState } from "react";
import { aiFixService } from "../services/aiFixService";

export const useAutoHeal = (appBlueprint: any, apiKey: string) => {
  const { sandpack } = useSandpack();
  const [isFixing, setIsFixing] = useState(false);
  const [lastFixStatus, setLastFixStatus] = useState<string | null>(null);

  const triggerAutoHeal = async (errorMessage: string) => {
    const filePath = sandpack.activeFile;
    const fileContent = sandpack.files[filePath].code;

    setIsFixing(true);
    setLastFixStatus("Geppy is diagnosing the issue... 🩺");

    try {
      const result = await aiFixService.getFixFromAI(
        { errorMessage, filePath, fileContent, appBlueprint },
        apiKey
      );

      // 1. Update the sandbox with the fixed code
      sandpack.updateFile(filePath, result.fixedCode);

      // 2. Handle missing dependencies if any
      if (result.missingDependencies?.length > 0) {
        setLastFixStatus(`Fix applied! Also added: ${result.missingDependencies.join(", ")}`);
        // Logic to update package.json in sandpack.files could go here if needed
        // For now, we just notify the user
      } else {
        setLastFixStatus("Fixed! The app should reload now. ✨");
      }
      
      return result;
    } catch (err) {
      console.error(err);
      setLastFixStatus("Failed to fix automatically. 😢");
    } finally {
      setIsFixing(false);
    }
  };

  return { triggerAutoHeal, isFixing, lastFixStatus };
};
