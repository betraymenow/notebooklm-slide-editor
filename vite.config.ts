import fs from 'fs';
import path from 'path';
import type { ServerResponse } from 'http';
import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// 탐색기에서 "연결 프로그램 → 슬라이드 편집기"로 연 파일을 넘겨받는 곳.
// 실행 프로그램(launcher/SlideEditor.exe)이 파일을 .inbox/<임의 토큰>.<확장자> 로 복사해 두면
// 앱이 /__slide-editor/inbox/<토큰> 으로 한 번 받아 가고, 받은 파일은 바로 지운다.
// 토큰을 모르면 아무 파일도 읽을 수 없다.
//
// 편집기 탭이 이미 열려 있으면 실행 프로그램이 새 탭을 열지 않고 /__slide-editor/deliver/<토큰> 을 부른다.
// 서버는 열린 탭 중 마지막으로 사용한 탭에 토큰을 보내고(서버 전송 이벤트), 탭이 그 파일을 받아 간다.
const INBOX_DIR = path.resolve(__dirname, '.inbox');
const INBOX_TYPES: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.bmp': 'image/bmp', '.pdf': 'application/pdf',
};

const TAB_ID = /^[0-9a-z]{1,32}$/;
const tabs = new Map<string, ServerResponse>(); // 탭 id → 이벤트 연결 (넣은 순서 = 연 순서)
let lastActiveTab = '';

// 실행 프로그램이 창 없이 띄운 서버는 닫을 창이 없으므로, 편집기 창이 모두 닫히면 스스로 끝난다.
// 새로고침 때 잠깐 끊겨도 끝나지 않도록 기다렸다가 확인한다. run.bat·npm run dev 로 띄운 서버는 해당 없음
const AUTO_EXIT = process.env.SLIDE_EDITOR_AUTO_EXIT === '1';
const EXIT_AFTER_CLOSE_MS = 30_000;
const EXIT_IF_NEVER_OPENED_MS = 3 * 60_000;
let exitTimer: ReturnType<typeof setTimeout> | undefined;
const scheduleExit = (ms: number) => {
  if (!AUTO_EXIT || tabs.size > 0) return;
  clearTimeout(exitTimer);
  exitTimer = setTimeout(() => { if (tabs.size === 0) process.exit(0); }, ms);
};

const inboxPlugin = (): Plugin => ({
  name: 'slide-editor-inbox',
  configureServer(server) {
    scheduleExit(EXIT_IF_NEVER_OPENED_MS);
    server.middlewares.use((req, res, next) => {
      const url = new URL(req.url || '/', 'http://localhost');
      const tab = url.searchParams.get('tab') || '';

      // 편집기 탭이 열려 있는 동안 붙잡고 있는 연결
      if (url.pathname === '/__slide-editor/events' && TAB_ID.test(tab)) {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
        res.write(': connected\n\n');
        tabs.set(tab, res);
        res.on('close', () => {
          if (tabs.get(tab) === res) tabs.delete(tab);
          scheduleExit(EXIT_AFTER_CLOSE_MS);
        });
        return;
      }
      // 탭을 보고 있게 되면 알려 온다 → 파일은 이 탭으로 보낸다
      if (url.pathname === '/__slide-editor/active' && TAB_ID.test(tab)) {
        lastActiveTab = tab;
        res.end();
        return;
      }
      const deliver = url.pathname.match(/^\/__slide-editor\/deliver\/([0-9a-f]{32})$/);
      if (deliver) {
        const target = tabs.get(lastActiveTab) || [...tabs.values()].pop();
        if (target) target.write(`data: ${deliver[1]}\n\n`);
        res.end(target ? 'delivered' : 'no-tab');
        return;
      }

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
