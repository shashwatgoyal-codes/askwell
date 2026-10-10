import { CORS, handleTokenCheck } from '@/lib/api';
import { getDb } from '@/lib/db';

export async function GET(request: Request) {
  return handleTokenCheck(request, { db: await getDb() });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
