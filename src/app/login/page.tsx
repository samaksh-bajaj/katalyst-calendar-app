"use client";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    document.cookie = `demo_user_email=${encodeURIComponent(email)}; path=/; max-age=604800`;
    window.location.href = "/";
  };

  return (
    <main className="min-h-screen grid place-items-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 border rounded-2xl p-6 shadow">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <input
          className="w-full rounded border p-2"
          placeholder="you@example.com"
          value={email}
          onChange={e=>setEmail(e.target.value)}
          required
          type="email"
        />
        <button className="w-full rounded-2xl border p-2 hover:shadow">Continue</button>
        <p className="text-xs text-gray-500">Mock auth — swap to Google OAuth later.</p>
      </form>
    </main>
  );
}
