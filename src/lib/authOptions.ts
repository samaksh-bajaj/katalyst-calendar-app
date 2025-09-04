import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/calendar.readonly",
          // ensure refresh tokens so users stay signed in
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  pages: {
    signIn: "/login",   // custom login page
    signOut: "/login",
    error: "/login",    // redirect errors back to login
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      // Initial Google sign-in
      if (account?.provider === "google") {
        (token as any).email = (profile as any)?.email;
        (token as any).accessToken = account.access_token;
        (token as any).refreshToken = account.refresh_token; // may be undefined after first grant

        const expiresIn = Number(account?.expires_in) || 3600; // seconds
        (token as any).expiresAt = Date.now() + expiresIn * 1000; // ms
      }

      // Refresh access token if expired and we have a refresh token
      const expiresAt = Number((token as any).expiresAt || 0);
      const refreshToken = (token as any).refreshToken as string | undefined;

      if (expiresAt && Date.now() > expiresAt && refreshToken) {
        try {
          const params = new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            grant_type: "refresh_token",
            refresh_token: refreshToken,
          });

          const r = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body: params,
          });

          const data: any = await r.json();

          if (data?.access_token) {
            (token as any).accessToken = data.access_token;
            const newExp = Number(data?.expires_in) || 3600;
            (token as any).expiresAt = Date.now() + newExp * 1000;
          }
        } catch {
          // ignore; next request can re-prompt if needed
        }
      }

      return token;
    },

    async session({ session, token }) {
      (session as any).email = (token as any).email;
      (session as any).accessToken = (token as any).accessToken;
      return session;
    },
  },
};
