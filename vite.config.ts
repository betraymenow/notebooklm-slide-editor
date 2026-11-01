import fs from 'fs';
import path from 'path';
import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// 탐색기에서 "연결 프로그램 → 슬라이드 편집기"로 연 파일을 넘겨받는 곳.
// 실행 프로그램(launcher/SlideEditor.exe)이 파일을 .inbox/<임의 토큰>.<확장자> 로 복사해 두면
// 앱이 /__slide-editor/inbox/<토큰> 으로 한 번 받아 가고, 받은 파일은 바로 지운다.
// 토큰을 모르면 아무 파일도 읽을 수 없다.
const INBOX_DIR = path.resolve(__dirname, '.inbox');
const INBOX_TYPES: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.bmp': 'image/bmp', '.pdf': 'application/pdf',
};

const inboxPlugin = (): Plugin => ({
  name: 'slide-editor-inbox',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      // 실행 프로그램이 이미 떠 있는 편집기 서버를 찾을 때 쓰는 확인용 주소
      if (req.url === '/__slide-editor/ping') {
        res.end('slide-editor');
        return;
      }
      const m = req.url?.match(/^\/__slide-editor\/inbox\/([0-9a-f]{32})$/);
      if (!m) return next();
      const name = fs.existsSync(INBOX_DIR) && fs.readdirSync(INBOX_DIR).find(f => f.startsWith(m[1] + '.'));
      if (!name) {
        res.statusCode = 404;
        res.end();
        return;
      }
      const file = path.join(INBOX_DIR, name);
      const data = fs.readFileSync(file);
      fs.unlinkSync(file);
      res.setHeader('Content-Type', INBOX_TYPES[path.extname(name)] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-store');
      res.end(data);
    });
  },
});

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        // API 키가 브라우저 코드에 포함되므로 같은 네트워크의 다른 기기에는 열지 않는다
        host: 'localhost',
        watch: { ignored: ['**/.inbox/**', '**/launcher/**'] },
      },
      plugins: [react(), inboxPlugin()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
