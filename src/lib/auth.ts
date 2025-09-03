import { cookies } from "next/headers";
export const getUser = () => {
  const cookieStore = cookies();
  const email = cookieStore.get("demo_user_email")?.value;
  return email ? { email } : null;
};
