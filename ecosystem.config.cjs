// Configuração do PM2, para a alternativa de VPS. Suba com:
//   pm2 start ecosystem.config.cjs --env production
//
// `instances: 1` é proposital: enquanto AUTH_MODO=mock (fase atual), usuários
// e orçamentos vivem em memória do processo — mais de uma instância faria
// cada requisição cair num processo diferente, com dados diferentes. Quando
// o banco (Fase 2) entrar, reavaliar — mas não há pressa: nada aqui depende
// de canal em tempo real (SSE) como no AtendimentoLocaPronto.
module.exports = {
  apps: [
    {
      name: 'calculadora-otica',
      script: 'src/server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '400M',
      autorestart: true,
      min_uptime: '20s',
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      error_file: './logs/erro.log',
      out_file: './logs/saida.log',
      merge_logs: true,
      time: true,
    },
  ],
};
