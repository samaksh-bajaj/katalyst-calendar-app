import { getServerSession } from "next-auth";
import { authOptions } from "./authOptions";

export async function getUser() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  const email = (session as any).email || session.user?.email;
  const accessToken = (session as any).accessToken as string | undefined;
  return email && accessToken ? { email, accessToken } : null;
}
