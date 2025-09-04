"use client";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-sm space-y-4 border rounded-2xl p-6 shadow">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <button
          className="w-full rounded-2xl border p-2 hover:shadow"
          onClick={() => signIn("google")}
        >
          Continue with Google
        </button>
        <p className="text-xs text-gray-500">Google OAuth (calendar.readonly)</p>
      </div>
    </main>
  );
}
