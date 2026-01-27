# Raspberry Pi Setup Guide

This guide covers setting up the Claude Voice Commander Pi service on your Raspberry Pi.

## Prerequisites

- Raspberry Pi 5 (recommended) or Pi 4 with 4GB+ RAM
- Raspberry Pi OS (64-bit recommended)
- Claude Code CLI installed and working
- Tailscale installed and connected to your tailnet

## 1. Install Bun

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Add to PATH (add to ~/.bashrc or ~/.zshrc)
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# Verify installation
bun --version
```

## 2. Install tmux

```bash
sudo apt update
sudo apt install tmux -y

# Verify installation
tmux -V
```

## 3. Clone the Repository

```bash
cd ~/projects  # or wherever you keep projects
git clone https://github.com/yourusername/claude-voice-commander
cd claude-voice-commander
```

## 4. Install Dependencies

```bash
# Install all workspace dependencies
bun install
```

## 5. Configure Environment

```bash
# Copy example env file
cp packages/pi-service/.env.example packages/pi-service/.env

# Edit with your values
nano packages/pi-service/.env
```

Required values:
- `API_KEY` - Generate with `openssl rand -hex 32`
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_KEY` - Your Supabase service role key
- `N8N_WEBHOOK_URL` - Your n8n webhook endpoint

## 6. Create State Directory

```bash
mkdir -p ~/.claude-commander
```

## 7. Test the Service

```bash
# Run in development mode
cd packages/pi-service
bun run dev

# In another terminal, test the health endpoint
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "uptime": 5,
  "sessionCount": 0,
  "attentionQueueSize": 0,
  "version": "0.1.0"
}
```

## 8. Set Up Tailscale Funnel

Tailscale Funnel exposes your Pi service to the internet so n8n and the dashboard can reach it.

```bash
# Enable Funnel for port 3000
tailscale funnel --bg 3000

# Check the status
tailscale funnel status
```

Your Pi will be accessible at: `https://[hostname].[tailnet].ts.net`

Example: `https://claudepi.tail12345.ts.net`

### Test External Access

```bash
# From another machine or your phone
curl https://claudepi.tail12345.ts.net/health
```

## 9. Set Up as Systemd Service

To run the Pi service automatically on boot:

```bash
# Create service file
sudo nano /etc/systemd/system/claude-commander.service
```

Add this content:
```ini
[Unit]
Description=Claude Voice Commander Pi Service
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/projects/claude-voice-commander/packages/pi-service
ExecStart=/home/pi/.bun/bin/bun run start
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable on boot
sudo systemctl enable claude-commander

# Start now
sudo systemctl start claude-commander

# Check status
sudo systemctl status claude-commander

# View logs
journalctl -u claude-commander -f
```

## 10. Verify Claude Code

Make sure Claude Code works:

```bash
# Check Claude is installed
which claude

# Test Claude (will start interactive session)
claude --version
```

The Pi service will run Claude with `--dangerously-skip-permissions` flag for autonomous operation.

## Troubleshooting

### Tailscale Funnel not working

```bash
# Check Tailscale status
tailscale status

# Ensure Funnel is enabled in Tailscale admin console
# https://login.tailscale.com/admin/dns

# Re-enable Funnel
tailscale funnel --bg 3000
```

### Service won't start

```bash
# Check logs
journalctl -u claude-commander -n 50

# Common issues:
# - Missing .env file
# - Invalid Supabase credentials
# - Port already in use
```

### tmux sessions not detected

```bash
# List tmux sessions manually
tmux list-sessions

# If "no server running", that's normal when no sessions exist
# The Pi service will create sessions as needed
```

### Memory issues on Pi 4

If using Pi 4 with limited RAM:

```bash
# Check memory
free -h

# Add swap if needed
sudo dphys-swapfile swapoff
sudo nano /etc/dphys-swapfile  # Set CONF_SWAPSIZE=2048
sudo dphys-swapfile setup
sudo dphys-swapfile swapon
```

## Security Notes

1. **API Key**: Keep your API_KEY secret. It authenticates requests from n8n.
2. **Tailscale Funnel**: The URL is obscure but not secret. API key provides the real security.
3. **Caller ID**: Phone security relies on caller ID verification in n8n.
4. **Service Key**: The Supabase service key has full database access. Keep it secure.

## Next Steps

1. Deploy the Supabase schema (`supabase/migrations/001_initial_schema.sql`)
2. Import n8n workflows
3. Configure Telnyx and ElevenLabs in n8n
4. Test end-to-end: call your Telnyx number
