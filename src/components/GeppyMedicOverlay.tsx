import { useSandpack } from "@codesandbox/sandpack-react";
import { useAutoHeal } from "../hooks/useAutoHeal";
import { AlertCircle, Wrench, Loader2 } from "lucide-react";

export const GeppyMedicOverlay = ({ blueprint, apiKey }: any) => {
  const { sandpack } = useSandpack();
  const { triggerAutoHeal, isFixing, lastFixStatus } = useAutoHeal(blueprint, apiKey);

  // We show the "Medic" if the status is an error
  // Sandpack status can be 'idle' | 'initial' | 'running' | 'timeout' | 'error'
  // But sometimes error is not reflected in status if it's a runtime error in the preview
  // However, useSandpack doesn't expose runtime errors directly unless we use listen
  // For now, we rely on sandpack.status === 'error' or if the user manually triggers it?
  // The prompt says "It will only show up when things break!"
  // Sandpack status 'error' usually means bundler error.
  
  // If we want to catch runtime errors, we need to listen to console or use a custom error overlay.
  // But let's stick to the prompt's logic: `if (sandpack.status !== "error" && !isFixing && !lastFixStatus) return null;`
  
  if ((sandpack.status as any) !== "error" && !isFixing && !lastFixStatus) return null;

  return (
    <div className="absolute bottom-4 left-4 right-4 z-50 bg-white dark:bg-slate-900 border-2 border-geppy-orange rounded-2xl p-4 shadow-2xl flex items-center justify-between animate-in slide-in-from-bottom-4">
      <div className="flex items-center gap-3">
        {isFixing ? (
          <Loader2 className="w-6 h-6 text-geppy-blue animate-spin" />
        ) : (
          <AlertCircle className="w-6 h-6 text-geppy-orange" />
        )}
        <div>
          <p className="font-bold text-sm text-slate-900 dark:text-white">
            {isFixing ? "Geppy Medic at Work..." : "Runtime Error Detected"}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{lastFixStatus || "The app crashed in the sandbox."}</p>
        </div>
      </div>

      {!isFixing && (
        <button
          onClick={() => triggerAutoHeal("Unknown Sandbox Error")}
          className="bg-geppy-orange text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:scale-105 transition-transform shadow-sm"
        >
          <Wrench className="w-4 h-4" />
          Auto-Fix with Geppy
        </button>
      )}
    </div>
  );
};
