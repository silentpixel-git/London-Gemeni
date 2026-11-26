import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';

// Dev-only middleware that serves POST /api/turn by loading the same Vercel
// web handler used in production (api/turn.ts), so `npm run dev` works without
// `vercel dev`. Server-side variables from .env reach process.env here, never
// the client bundle (only VITE_* is defined into it).
function apiDevGateway(env: Record<string, string>): Plugin {
  return {
    name: 'api-dev-gateway',
    configureServer(server: ViteDevServer) {
      for (const [key, value] of Object.entries(env)) {
        if (value && !process.env[key]) process.env[key] = value;
      }
      server.middlewares.use('/api/turn', (req, res) => {
        void (async () => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.end();
            return;
          }
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const mod = await server.ssrLoadModule('/api/turn.ts');
          const response: Response = await mod.POST(
            new Request('http://localhost/api/turn', {
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
          console.error('[api-dev-gateway /api/turn]', err);
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
      plugins: [react(), apiDevGateway(env)],
    };
});
