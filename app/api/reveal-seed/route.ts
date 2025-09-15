import { NextResponse } from 'next/server';
import { publicCommit } from '../../../lib/fair';

export async function GET() {
  return NextResponse.json({ commit: publicCommit(process.env.SERVER_SEED!) });
}