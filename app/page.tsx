/**
 * Root route. Hands off to the dashboard, where the app shell resolves the
 * session and applies route guards.
 */
import { redirect } from "next/navigation";

/**
 * Redirects every visitor to /dashboard; route guards handle unauthenticated
 * users from there.
 */
export default function Home() {
  redirect("/dashboard");
}
