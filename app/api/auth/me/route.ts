/**
 * Route: GET /api/auth/me.
 */
import type { NextRequest } from 'next/server'

/**
 * Returns the public user summary for the current session. Currently responds
 * with no user; session lookup is not performed here.
 */
export async function GET(request: NextRequest) {
  return Response.json({ data: { user: null } })
}