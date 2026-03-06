import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // GitHub Proxy Route
  app.get("/api/github/download", async (req, res) => {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: "Missing or invalid 'url' parameter" });
    }

    try {
      // Parse GitHub URL
      // Expected formats:
      // https://github.com/owner/repo
      // https://github.com/owner/repo/tree/branch
      
      let owner, repo, ref = 'main';
      
      const githubUrlPattern = /github\.com\/([^\/]+)\/([^\/]+)(?:\/tree\/([^\/]+))?/;
      const match = url.match(githubUrlPattern);

      if (!match) {
        return res.status(400).json({ error: "Invalid GitHub URL format" });
      }

      owner = match[1];
      repo = match[2].replace('.git', '');
      
      // If branch is specified in URL, use it
      if (match[3]) {
        ref = match[3];
      } else {
        // Try to detect default branch via API
        try {
          const apiResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
            headers: {
              'User-Agent': 'Geppy-Architect',
              'Accept': 'application/vnd.github.v3+json'
            }
          });
          
          if (apiResponse.ok) {
            const data = await apiResponse.json();
            if (data.default_branch) {
              ref = data.default_branch;
              console.log(`Detected default branch: ${ref}`);
            }
          }
        } catch (e) {
          console.warn("Failed to detect default branch via API, defaulting to 'main'", e);
        }
      }

      // Construct ZIP download URL
      // Use codeload directly as it's the CDN for source code and often bypasses some API rate limits
      // Format: https://codeload.github.com/owner/repo/zip/refs/heads/branch
      
      let zipUrl = `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/${ref}`;
      
      // If ref looks like a commit hash (40 chars hex), the format is different
      if (/^[0-9a-f]{40}$/.test(ref)) {
         zipUrl = `https://codeload.github.com/${owner}/${repo}/zip/${ref}`;
      }
      
      console.log(`Fetching ZIP from: ${zipUrl}`);

      let response = await fetch(zipUrl);

      if (!response.ok) {
        // If 'main' failed and we didn't explicitly check API (or API failed), try 'master'
        if (response.status === 404 && ref === 'main') {
           console.log(`Main branch not found on codeload, trying master...`);
           const masterUrl = `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/master`;
           const masterResponse = await fetch(masterUrl);
           
           if (masterResponse.ok) {
             response = masterResponse;
             ref = 'master';
           } else {
             // Fallback to the API zipball endpoint which handles redirects for us
             console.log(`Master branch not found, trying generic zipball API...`);
             const zipballUrl = `https://api.github.com/repos/${owner}/${repo}/zipball`;
             const zipballResponse = await fetch(zipballUrl, {
                headers: { 
                  'User-Agent': 'Geppy-Architect',
                  'Accept': 'application/vnd.github.v3+json'
                }
             });
             
             if (zipballResponse.ok) {
               response = zipballResponse;
             } else {
               const errorText = await zipballResponse.text().catch(() => 'Unknown error');
               console.error(`Zipball failed: ${zipballResponse.status} ${errorText}`);
               throw new Error(`Failed to fetch ZIP (${zipballResponse.status}). Repository might be private or invalid.`);
             }
           }
        } else {
          throw new Error(`Failed to fetch ZIP from ${zipUrl}: ${response.statusText} (${response.status})`);
        }
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${repo}-${ref}.zip"`);
      res.send(buffer);

    } catch (error: any) {
      console.error("GitHub download error:", error);
      res.status(500).json({ error: error.message || "Failed to download repository" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.resolve(process.cwd(), "dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
