import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const REQUIRED_ENV = [
  'OPENAI_API_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'JARVIS_OWNER_ID',
  'JARVIS_ACCESS_KEY',
  'JARVIS_PAIRING_SECRET'
] as const;

export async function GET() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]?.trim());

  return NextResponse.json(
    {
      ok: missing.length === 0,
      service: 'JARVIS',
      time: new Date().toISOString(),
      environment: process.env.RENDER ? 'render' : process.env.NODE_ENV || 'unknown',
      missing_env: missing
    },
    { status: missing.length === 0 ? 200 : 503 }
  );
}
