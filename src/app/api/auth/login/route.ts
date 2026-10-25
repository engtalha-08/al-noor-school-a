import { verifyLogin, setSession, audit, errorResponse, HttpError } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { email, password } = (await req.json()) as { email?: string; password?: string };
    if (!email || !password) throw new HttpError(422, "Email and password are required");
    const user = await verifyLogin(email, password);
    if (!user) {
      await audit(null, "login_failed", "users", null, `email=${email}`);
      throw new HttpError(401, "Invalid email or password");
    }
    await setSession(user);
    await audit(user, "login", "users", user.id);
    return Response.json({ user });
  } catch (e) {
    return errorResponse(e);
  }
}
