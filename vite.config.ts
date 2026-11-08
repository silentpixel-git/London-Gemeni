import path from 'path';
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

// Dev-only middleware that serves POST /api/ai and POST /api/turn by loading
// the same Vercel web handlers used in production (api/ai.ts, api/turn.ts), so
// `npm run dev` works without `vercel dev`. The GEMINI key stays server-side —
// it is NOT defined into the client bundle.
const SERVER_ENV_KEYS = [
  'GEMINI_API_KEY', 'GEMINI_MODEL_ID',
  // api/turn.ts: Supabase client per request, and the AI seam's job config.
  'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY',
  'AI_SELECT_PROVIDER', 'AI_SELECT_MODEL', 'AI_NARRATE_PROVIDER', 'AI_NARRATE_MODEL', 'AI_RECORDINGS_DIR',
];

function aiDevGateway(env: Record<string, string>): Plugin {
  return {
    name: 'ai-dev-gateway',
    configureServer(server: ViteDevServer) {
      for (const key of SERVER_ENV_KEYS) {
        if (env[key] && !process.env[key]) process.env[key] = env[key];
      }
      for (const route of ['/api/ai', '/api/turn']) {
        server.middlewares.use(route, (req, res) => {
          void (async () => {
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.end();
              return;
            }
            const chunks: Buffer[] = [];
            for await (const chunk of req) chunks.push(chunk as Buffer);
            const mod = await server.ssrLoadModule(`${route}.ts`);
            const response: Response = await mod.POST(
              new Request(`http://localhost${route}`, {
                method: 'POST',
                headers: {
                  'content-type': 'application/json',
                  ...(req.headers.authorization ? { authorization: req.headers.authorization } : {}),
                },
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
            console.error(`[ai-dev-gateway ${route}]`, err);
            if (!res.headersSent) res.statusCode = 500;
            res.end(JSON.stringify({ error: 'AI gateway failed.' }));
          });
        });
      }
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
        'import.meta.env.VITE_AI_PARSER': JSON.stringify(env.VITE_AI_PARSER ?? ''),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
