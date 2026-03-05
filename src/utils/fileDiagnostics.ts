import JSZip from 'jszip';

export interface DiagnosticResult {
  valid: boolean;
  issues: string[];
  details: Record<string, any>;
}

export const analyzeZipFile = async (file: File): Promise<DiagnosticResult> => {
  const issues: string[] = [];
  const details: Record<string, any> = {
    name: file.name,
    size: file.size,
    type: file.type,
  };

  // 1. Check File Size
  if (file.size === 0) {
    issues.push("File is empty (0 bytes).");
    return { valid: false, issues, details };
  }
  
  if (file.size > 50 * 1024 * 1024) {
    issues.push("File is larger than 50MB. This might cause memory issues or timeouts.");
  }

  // 2. Check Magic Bytes (First 4 bytes should be PK\x03\x04)
  try {
    const header = await file.slice(0, 4).arrayBuffer();
    const view = new DataView(header);
    // PK\x03\x04 is 0x504B0304. We read as big-endian to match.
    // However, getUint32 reads big-endian by default if littleEndian is false.
    // 0x50 = 'P', 0x4B = 'K', 0x03, 0x04
    const magic = view.getUint32(0, false); 
    
    if (magic !== 0x504B0304) {
       issues.push("File does not appear to be a valid ZIP archive (invalid magic bytes).");
       details.magicBytes = magic.toString(16);
       // If magic bytes are wrong, JSZip will likely fail, but let's try anyway or just return
       // We'll return here because JSZip will definitely fail and throw a generic error.
       return { valid: false, issues, details };
    }
  } catch (e) {
    issues.push(`Failed to read file header: ${(e as Error).message}`);
    return { valid: false, issues, details };
  }

  // 3. Try to list files with JSZip
  try {
    const zip = new JSZip();
    // loadAsync can take a Blob/File directly
    const content = await zip.loadAsync(file);
    const files = Object.keys(content.files);
    details.fileCount = files.length;
    
    if (files.length === 0) {
      issues.push("ZIP archive is empty (contains no files).");
    }

    // Check for common issues in file structure
    const hasCode = files.some(f => f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js') || f.endsWith('.jsx') || f.endsWith('.json'));
    if (!hasCode && files.length > 0) {
      issues.push("No common code files (.ts, .tsx, .js, .json) found in the archive. Is this a source code bundle?");
    }

    // Check for nested root folder (e.g. my-app/package.json instead of package.json)
    // This isn't an error, but helpful context
    const topLevelFiles = files.filter(f => !f.includes('/'));
    if (topLevelFiles.length === 0 && files.length > 0) {
       details.structure = "All files are inside a subdirectory. The importer handles this, but it's good to note.";
    }

  } catch (e) {
    issues.push(`Failed to parse ZIP structure: ${(e as Error).message}`);
    return { valid: false, issues, details };
  }

  return {
    valid: issues.length === 0,
    issues,
    details
  };
};
