import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { spawn } from 'child_process'
import path from 'path'

// ── Video Engine paths (absolute — these projects live in different directories) ──
const HOME = process.env.HOME || '/Users/naveenpattnaik';
const VIDEO_ENGINE_DIR = path.join(HOME, 'bhoomiscan-insights', 'bhoomiscan-video-engine');
const MAIN_ENV_PATH = path.join(HOME, 'bhoomiscan-insights', '.env');

/**
 * Vite plugin that embeds a video generation API directly into the dev server.
 * When the browser POSTs to /api/video/generate, the server spawns the
 * Remotion pipeline as a child process. No separate server required.
 */
function videoEnginePlugin() {
  const activeJobs = new Map(); // propertyId -> { process, status, startedAt }

  return {
    name: 'video-engine-api',
    configureServer(server) {
      // Parse JSON body helper
      function readBody(req) {
        return new Promise((resolve) => {
          let body = '';
          req.on('data', (c) => (body += c));
          req.on('end', () => {
            try { resolve(JSON.parse(body)); } catch { resolve({}); }
          });
        });
      }

      function json(res, status, data) {
        res.writeHead(status, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(JSON.stringify(data));
      }

      // ── GET /api/video/health ──
      server.middlewares.use('/api/video/health', (req, res) => {
        json(res, 200, {
          online: true,
          engine: 'embedded-vite-plugin',
          activeJobs: activeJobs.size,
          videoEngineDir: VIDEO_ENGINE_DIR,
        });
      });

      // ── GET /api/video/jobs ──
      server.middlewares.use('/api/video/jobs', (req, res) => {
        if (req.method === 'GET') {
          const jobs = [];
          for (const [id, j] of activeJobs) {
            jobs.push({
              propertyId: id,
              status: j.status,
              startedAt: j.startedAt,
              elapsed: Math.round((Date.now() - j.startedAt) / 1000),
              log: j.log.slice(-500), // last 500 chars of output
            });
          }
          return json(res, 200, { jobs });
        }
      });

      // ── Spawn helper (shared by generate and retry-upload) ──
      function spawnJob(propertyId, args, jobLabel) {
        console.log(`\n[video-engine] ${jobLabel}: npx ${args.join(' ')}`);
        console.log(`[video-engine] CWD: ${VIDEO_ENGINE_DIR}`);

        const job = {
          status: 'rendering',
          startedAt: Date.now(),
          log: '',
          process: null,
        };
        activeJobs.set(propertyId, job);

        try {
          const child = spawn('npx', args, {
            cwd: VIDEO_ENGINE_DIR,
            shell: true,
            env: {
              ...process.env,
              DOTENV_CONFIG_PATH: MAIN_ENV_PATH,
            },
          });
          job.process = child;

          child.stdout.on('data', (data) => {
            const line = data.toString();
            job.log += line;
            process.stdout.write(`[video:${propertyId.slice(0, 8)}] ${line}`);
          });

          child.stderr.on('data', (data) => {
            const line = data.toString();
            job.log += line;
            process.stderr.write(`[video:${propertyId.slice(0, 8)}] ${line}`);
          });

          child.on('close', (code) => {
            if (code === 0) {
              job.status = 'done';
              console.log(`[video-engine] Completed: ${propertyId} in ${Math.round((Date.now() - job.startedAt) / 1000)}s`);
            } else {
              job.status = 'failed';
              console.error(`[video-engine] Failed: ${propertyId} (exit code ${code})`);
            }
            setTimeout(() => activeJobs.delete(propertyId), 5 * 60 * 1000);
          });

          child.on('error', (err) => {
            job.status = 'failed';
            job.log += `\nProcess error: ${err.message}`;
            console.error(`[video-engine] Process error: ${err.message}`);
          });
        } catch (err) {
          job.status = 'failed';
          job.log = `Spawn error: ${err.message}`;
          console.error(`[video-engine] Spawn error:`, err);
        }
      }

      // ── POST /api/video/generate ──
      server.middlewares.use('/api/video/generate', async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          });
          return res.end();
        }

        if (req.method !== 'POST') {
          return json(res, 405, { error: 'POST only' });
        }

        const body = await readBody(req);
        const { propertyId, options } = body;

        if (!propertyId) {
          return json(res, 400, { error: 'propertyId is required' });
        }

        if (activeJobs.has(propertyId) && activeJobs.get(propertyId).status === 'rendering') {
          return json(res, 409, { error: 'Already generating for this property' });
        }

        const args = ['tsx', 'generate.ts', `--id=${propertyId}`];
        if (options?.skipVoiceover) args.push('--no-voiceover');
        if (options?.skipUpload) args.push('--no-upload');
        if (options?.variant) args.push(`--variant=${options.variant}`);

        json(res, 202, { ok: true, message: 'Generation started', propertyId });
        spawnJob(propertyId, args, 'Starting');
      });

      // ── POST /api/video/retry-upload ──
      server.middlewares.use('/api/video/retry-upload', async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          });
          return res.end();
        }

        if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });

        const body = await readBody(req);
        const { propertyId } = body;

        if (!propertyId) return json(res, 400, { error: 'propertyId is required' });

        const args = ['tsx', 'generate.ts', '--retry-upload', `--id=${propertyId}`];
        json(res, 202, { ok: true, message: 'Retrying upload (no re-render)', propertyId });
        spawnJob(propertyId, args, 'Retry upload');
      });

      // ── POST /api/video/cancel/:id ──
      server.middlewares.use('/api/video/cancel', async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          });
          return res.end();
        }

        if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });

        // Extract propertyId from URL: /api/video/cancel/uuid-here
        const propertyId = req.url?.replace(/^\//, '') || '';
        if (!propertyId) return json(res, 400, { error: 'propertyId required in URL' });

        const job = activeJobs.get(propertyId);
        if (job?.process) {
          job.process.kill('SIGTERM');
          job.status = 'cancelled';
        }
        activeJobs.delete(propertyId);
        json(res, 200, { ok: true, message: 'Cancelled' });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), videoEnginePlugin()],
})
