import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/db';
import { bearerToken, sha256 } from '@/lib/security';

export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
  try {
    const token = bearerToken(req);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const db = adminDb();
    const { data: device, error: dErr } = await db.from('devices').select('*').eq('token_hash', sha256(token)).eq('enabled', true).maybeSingle();
    if (dErr) throw dErr;
    if (!device) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await db.from('devices').update({ last_seen_at: new Date().toISOString() }).eq('id', device.id);

    const { data: cmd, error: cErr } = await db.from('device_commands').select('*').eq('device_id', device.id).eq('status', 'queued').order('created_at', { ascending: true }).limit(1).maybeSingle();
    if (cErr) throw cErr;
    if (!cmd) return NextResponse.json({ command: null });

    const { data: claimed } = await db.from('device_commands').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', cmd.id).eq('status', 'queued').select('*').maybeSingle();
    if (!claimed) return NextResponse.json({ command: null });
    return NextResponse.json({ command: { id: claimed.id, action: claimed.action, target: claimed.target, payload: claimed.payload || {} } });
  } catch (e:any) {
    return NextResponse.json({ error: e.message || 'Agent pull hatası' }, { status: 500 });
  }
}
