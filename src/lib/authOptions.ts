import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/calendar.readonly",
          access_type: "offline",
          prompt: "consent"
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      // Initial sign-in
      if (account?.provider === "google") {
        token.email = (profile as any)?.email;
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token; // may be undefined after the first grant
        const expiresIn = Number(account?.expires_in) || 3600; // fallback 1 hour
        (token as any).expiresAt = Date.now() + expiresIn * 1000;

      }
      // Refresh access token if expired and we have a refresh token
      if (token.expiresAt && Date.now() > token.expiresAt && token.refreshToken) {
        try {
          const params = new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            grant_type: "refresh_token",
            refresh_token: token.refreshToken as string
          });
          const r = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body: params
          });
          const data = await r.json();
          if (data.access_token) {
            token.accessToken = data.access_token;
            token.expiresAt = Date.now() + (data.expires_in ? data.expires_in * 1000 : 3600_000);
          }
        } catch {
          // silently ignore; next request might re-prompt
        }
      }
      return token;
    },
    async session({ session, token }) {
      (session as any).email = (token as any).email;
      (session as any).accessToken = (token as any).accessToken;
      return session;
    }
  }
};
