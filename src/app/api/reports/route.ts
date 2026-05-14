import { NextRequest } from 'next/server';
import { fail } from '@/lib/http';

export const runtime = 'nodejs';

export async function GET() {
  return fail('Feature disabled', 403);
}

export async function POST() {
  return fail('Feature disabled', 403);
}
