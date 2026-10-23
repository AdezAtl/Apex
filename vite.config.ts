import { defineConfig, Plugin } from 'vite';
import { fork, ChildProcess } from 'child_process';
import path from 'path';

function lanServerPlugin(): Plugin {
  let serverProcess: ChildProcess | null = null;

  return {
    name: 'apex-lan-server-plugin',
    configureServer(server) {
      const scriptPath = path.resolve(__dirname, 'scripts/lan_server.cjs');
      try {
        serverProcess = fork(scriptPath, [], {
          stdio: 'inherit',
          env: { ...process.env, PORT: '5050' },
        });
      } catch (err) {
        console.warn('[ProjectApex] LAN Server auto-start warning:', err);
      }

      const cleanup = () => {
        if (serverProcess) {
          try {
            serverProcess.kill();
          } catch {}
          serverProcess = null;
        }
      };

      process.on('exit', cleanup);
      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);
      server.httpServer?.on('close', cleanup);
    },
  };
}

export default defineConfig({
  plugins: [lanServerPlugin()],
  server: {
    port: 5173,
    open: false,
    host: true,
    watch: {
      ignored: ['**/.tmp*/**', '**/dist/**', '**/assets/**', '**/*.7z', '**/*.zip', '**/*.rar'],
    },
  },
  build: {
    target: 'esnext',
  },
});
