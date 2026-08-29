import { NextRequest, NextResponse } from 'next/server';
import { adminDb, ownerId } from '@/lib/db';
import { requireBrowserKey } from '@/lib/security';

export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  try {
    if (!requireBrowserKey(req)) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
    const db = adminDb();
    const { data, error } = await db.from('devices').select('id,name,last_seen_at,enabled,created_at').eq('user_id', ownerId()).eq('enabled', true).order('last_seen_at', { ascending: false });
    if (error) throw error;
    const now = Date.now();
    const devices = (data || []).map((d:any) => ({ ...d, online: !!d.last_seen_at && now - new Date(d.last_seen_at).getTime() < 15000 }));
    return NextResponse.json({ devices });
  } catch (e:any) {
    return NextResponse.json({ error: e.message || 'Hata' }, { status: 500 });
  }
}
