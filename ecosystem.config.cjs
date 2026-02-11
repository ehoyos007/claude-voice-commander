module.exports = {
  apps: [{
    name: 'claude-voice-commander',
    script: '/Users/mindmuscleu/Developer/claude-voice-commander/packages/pi-service/start.sh',
    exec_mode: 'fork',
    instances: 1,
    env: {
      NODE_ENV: 'production',
      ELEVENLABS_API_KEY: 'sk_7d33b4e20117d6594b045e56a9b1f4fcef30fa615f489788',
      ELEVENLABS_VOICE_ID: '3sfGn775ryaDXhFWHwBg',
    },
    watch: false,
    autorestart: true,
    max_restarts: 10,
    restart_delay: 5000,
  }]
};
