import path from 'path';
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

// Dev-only middleware that serves POST /api/ai by loading the same Vercel web
// handler used in production (api/ai.ts), so `npm run dev` works without
// `vercel dev`. The GEMINI key stays server-side — it is NOT defined into the
// client bundle.
function aiDevGateway(env: Record<string, string>): Plugin {
  return {
    name: 'ai-dev-gateway',
    configureServer(server: ViteDevServer) {
      if (env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY) {
        process.env.GEMINI_API_KEY = env.GEMINI_API_KEY;
      }
      if (env.GEMINI_MODEL_ID && !process.env.GEMINI_MODEL_ID) {
        process.env.GEMINI_MODEL_ID = env.GEMINI_MODEL_ID;
      }
      server.middlewares.use('/api/ai', (req, res) => {
        void (async () => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.end();
            return;
          }
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const mod = await server.ssrLoadModule('/api/ai.ts');
          const response: Response = await mod.POST(
            new Request('http://localhost/api/ai', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: Buffer.concat(chunks),
            })
          );
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          if (response.body) {
            for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
              res.write(chunk);
            }
          }
          res.end();
        })().catch(err => {
          console.error('[ai-dev-gateway]', err);
          if (!res.headersSent) res.statusCode = 500;
          res.end(JSON.stringify({ error: 'AI gateway failed.' }));
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        // PORT is set by tooling (e.g. preview harness); fall back to 3000
        port: Number(process.env.PORT) || 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), aiDevGateway(env)],
      css: {
        postcss: {
          plugins: [tailwindcss, autoprefixer],
        },
      },
      define: {
        'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
        'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
