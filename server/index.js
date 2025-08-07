import Koa from 'koa';
import proxy from 'koa-proxies';
import serve from 'koa-static';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config(); // Load .env variables

const app = new Koa();

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load config from env
const TORRSERVER_PORT = process.env.TORRSERVER_PORT || 8090;
const TORRSERVER_AUTHENABLED = process.env.TORRSERVER_AUTHENABLED === 'true';
const TORRSERVER_USERNAME = process.env.TORRSERVER_USERNAME;
const TORRSERVER_PASSWORD = process.env.TORRSERVER_PASSWORD;

// Create optional Authorization header
let authHeader = {};
if (TORRSERVER_AUTHENABLED && TORRSERVER_USERNAME && TORRSERVER_PASSWORD) {
  const base64 = Buffer.from(`${TORRSERVER_USERNAME}:${TORRSERVER_PASSWORD}`).toString('base64');
  authHeader = {
    Authorization: `Basic ${base64}`,
  };
}

// Serve frontend (PWA)
app.use(serve(path.join(__dirname, 'public')));

// Proxy requests to TorrServer
app.use(
  proxy('/torrserver', {
    target: `http://torrserver:${TORRSERVER_PORT}`,
    changeOrigin: true,
    logs: true,
    rewrite: (path) => path.replace(/^\/torrserver/, ''),
    headers: {
      ...authHeader,
    },
  })
);

// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
