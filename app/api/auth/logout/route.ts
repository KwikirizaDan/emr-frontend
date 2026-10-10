/**
 * Route: POST /api/auth/logout.
 *
 * Sign-out endpoint. Returns a success acknowledgement to the client.
 */
export async function POST() {
  return Response.json({ data: { success: true } })
}
