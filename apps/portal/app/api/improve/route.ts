import { CORS, handleImprove } from '@/lib/api';
import { getDb } from '@/lib/db';

export async function POST(request: Request) {
  return handleImprove(request, { db: await getDb() });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
