# Katalyst Calendar App

A Next.js web app that connects to a user's **Google Calendar** via **OAuth** and displays their meetings:
- **Upcoming 5** events
- **Past 5** events, with **AI-generated summaries**

---

## 🚀 Tech Stack
- **Next.js 14 (App Router)**
- **NextAuth.js** for Google OAuth login
- **Google Calendar API** (read-only)
- **OpenAI API** for meeting summaries
- **Tailwind CSS** for UI

---

## ✨ Features
- Secure login with **Google OAuth** (per-user, not hardcoded to one account).
- Reads directly from each user’s **own calendar**.
- Displays meeting cards with title, time, attendees, and description.
- Generates short **AI summaries** for the last 5 meetings.
- Clean, responsive card-based UI.

---

## 🛠 Setup Instructions

### 1. Clone repo
```bash
git clone https://github.com/samaksh-bajaj/katalyst-calendar-app.git
cd katalyst-calendar-app
```

### 2. Install dependencies
```bash
npm install
```

### 3. Environment variables
Create a `.env.local` file in the root:

```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=some-random-string
OPENAI_API_KEY=your_openai_api_key
```

> For production (Vercel), set the same variables in **Vercel → Project Settings → Environment Variables**.

### 4. Google Cloud setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Enable the **Google Calendar API**.
3. Configure an **OAuth consent screen** (Testing mode is fine).
4. Create **OAuth client credentials** of type **Web Application** with these redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://YOUR-VERCEL-DEPLOYMENT.vercel.app/api/auth/callback/google`

5. Copy the **Client ID** and **Client Secret** into your `.env.local`.

### 5. Run locally
```bash
npm run dev
```
Visit: [http://localhost:3000](http://localhost:3000)

### 6. Deploy
- Push to GitHub → Vercel auto-deploys.
- Make sure env vars are set in Vercel.

---

## 📂 Project Structure

```
src/
 ├─ app/
 │   ├─ api/
 │   │   └─ auth/[...nextauth]/route.ts   # NextAuth API route
 │   ├─ login/page.tsx                    # Login page
 │   ├─ page.tsx                          # Homepage (fetch + UI)
 │
 ├─ components/
 │   └─ MeetingCard.tsx                   # Card UI for meetings
 │
 ├─ lib/
 │   ├─ authOptions.ts                    # NextAuth config
 │   ├─ auth.ts                           # getUser() helper
 │   ├─ googleCalendar.ts                 # Google Calendar API helper
 │   ├─ summarize.ts                      # OpenAI summarizer
 │   └─ time.ts                           # Duration helpers
```

---

## 🔒 Notes
- App is currently in **Testing mode** on Google OAuth — only **approved test users** (added in the Google Cloud console) can log in.
- If you want it publicly accessible, you’d need to publish and verify the OAuth app with Google.

---

## 🙋‍♂️ Author Notes
- My initial commit history looks large because I had to recreate the repository after accidentally pushing `node_modules` (over 100MB).  
- If you’d like me to include anything additional (tests, API docs, or UI polish), please let me know!
