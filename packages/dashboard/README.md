# Claude Voice Commander Dashboard

This directory will contain the Next.js dashboard for Claude Voice Commander.

## Setup (Not Yet Scaffolded)

The dashboard will be scaffolded with:

```bash
cd packages/dashboard
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

Then install additional dependencies:

```bash
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs
npm install lucide-react
npx shadcn@latest init
```

## Planned Features

1. **Session Overview**
   - List all active sessions with status badges
   - Real-time status updates via Supabase Realtime

2. **Session Detail**
   - Live terminal view (200 lines, polling)
   - Toggle to searchable history (1000 lines from Supabase)
   - Send messages to session
   - Stop/Kill/Resume controls

3. **Call History**
   - List all calls with direction, duration, status
   - Audio playback with waveform visualization
   - Full transcript view

4. **Audit Logs**
   - Filterable event log
   - Search by event type, session, date range

5. **Attention Queue**
   - View pending items
   - Manual resolve from dashboard
   - Trigger call manually

## Tech Stack

- Next.js 14 (App Router)
- Tailwind CSS
- shadcn/ui components
- Supabase Realtime for live updates
- react-email for email templates

## Environment Variables

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_KEY=xxx
NEXT_PUBLIC_PI_SERVICE_URL=https://claudepi.tailnet.ts.net
RESEND_API_KEY=re_xxx
```
