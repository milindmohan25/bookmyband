import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

/* Serve the Netlify function from the Vite dev server, so `npm run dev`
   exercises the real ask endpoint — same file that runs in production —
   without needing the Netlify CLI. Netlify itself never uses this; it
   runs netlify/functions/ask.js directly. */
function askFunction() {
  return {
    name: "ask-function-dev",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/.netlify/functions/ask", async (req, res) => {
        try {
          const body = await new Promise((resolve, reject) => {
            let b = "";
            req.on("data", (c) => (b += c));
            req.on("end", () => resolve(b));
            req.on("error", reject);
          });

          // Loaded per request so edits to the function take effect
          // without restarting the dev server.
          const mod = await server.ssrLoadModule("/netlify/functions/ask.js");
          const response = await mod.default(
            new Request("http://localhost/.netlify/functions/ask", {
              method: req.method,
              headers: { "Content-Type": "application/json" },
              body: req.method === "POST" ? body : undefined,
            })
          );

          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(await response.text());
        } catch (err) {
          server.config.logger.error(`[ask] ${err.stack || err}`);
          res.statusCode = 500;
          res.end("The answer function threw. See the dev server log.");
        }
      });
    },
  };
}

export default defineConfig(({ mode, command }) => {
  // "" prefix loads every var, not just VITE_ ones, so the function can
  // read GROQ_API_KEY from .env.local the way it reads it from Netlify.
  const env = loadEnv(mode, process.cwd(), "");
  for (const k of ["GROQ_API_KEY", "GROQ_MODEL", "GROQ_BASE_URL", "ANTHROPIC_API_KEY", "ANTHROPIC_MODEL"]) {
    if (env[k] && !process.env[k]) process.env[k] = env[k];
  }

  const config = { plugins: [react(), askFunction()] };

  // In dev only: if a model key is present, point the app at the local
  // function automatically. Saves setting VITE_ASK_ENDPOINT by hand just
  // to try it. Builds keep Vite's normal env handling, so the value set
  // in Netlify is the one that ships.
  if (command === "serve" && !env.VITE_ASK_ENDPOINT && (env.GROQ_API_KEY || env.ANTHROPIC_API_KEY)) {
    config.define = {
      "import.meta.env.VITE_ASK_ENDPOINT": JSON.stringify("/.netlify/functions/ask"),
    };
  }

  return config;
});
