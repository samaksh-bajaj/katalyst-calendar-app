# Katalyst Calendar App

A demo full-stack take-home project: a calendar dashboard that integrates with **Google Calendar via Composio MCP** and generates **AI meeting summaries** with OpenAI.

---

## 🚀 Features
- **Mock login** → simple email-based login (cookies)  
- **Google Calendar integration** → fetches real events via Composio MCP server  
- **Dashboard** → shows the next 5 upcoming meetings and last 5 past meetings  
- **AI summaries** → OpenAI generates short summaries for past events  
- **Deployable** → Works locally (`npm run dev`) and on Vercel  

---

## 📂 Project Structure
```
src/
 ├─ app/
 │   ├─ page.tsx          # Dashboard (fetches meetings via MCP)
 │   └─ login/page.tsx    # Mock login
 ├─ components/           # UI components (Section, MeetingCard, etc.)
 ├─ lib/
 │   ├─ mcp.ts            # Composio MCP client (Google Calendar events)
 │   ├─ summarize.ts      # AI summarization logic
 │   ├─ auth.ts           # Cookie-based user auth
 │   ├─ time.ts           # Helpers for duration
 │   └─ types.ts          # Shared types
```

---

## ⚙️ Setup

### 1. Clone & install
```bash
git clone https://github.com/samaksh-bajaj/katalyst-calendar-app.git
cd katalyst-calendar-app
npm install
```

### 2. Environment variables
Create a `.env.local` file in the project root:

```env
# OpenAI API Key (for summaries)
OPENAI_API_KEY=sk-...

# Composio MCP server URL (from your dashboard)
NEXT_PUBLIC_MCP_URL=https://apollo-xxxx-composio.vercel.app/v3/mcp/your-server-id/mcp?include_composio_helper_actions=true
```

### 3. Run locally
```bash
npm run dev
```
Then open [http://localhost:3000](http://localhost:3000).

---

## ☁️ Deployment (Vercel)
1. Push this repo to GitHub.  
2. Import the repo into [Vercel](https://vercel.com).  
3. In Vercel project settings → Environment Variables, add:  
   - `OPENAI_API_KEY`  
   - `NEXT_PUBLIC_MCP_URL`  
4. Deploy.  

---

## 🔑 Composio + Google Calendar Setup
1. Go to [Composio](https://composio.app) → **Integrations**.  
2. Connect **Google Calendar** and grant “view events” scope.  
3. Get your MCP server URL (it looks like:  
   ```
   https://apollo-xxx-composio.vercel.app/v3/mcp/.../mcp?include_composio_helper_actions=true
   ```
   )  
4. Add this to `.env.local` as `NEXT_PUBLIC_MCP_URL`.  

---

## 🧪 Testing
1. Log in at `/login` with any email.  
2. Create a test event in Google Calendar (e.g., **“AI Demo Meeting”**).  
3. Refresh the dashboard:  
   - The event should appear under **Upcoming**.  
   - After it passes, it will appear under **Past** with an AI-generated summary.  

---

## 🛠 Notes
- Default time window = events from **7 days ago → +30 days**.  
- If no events show, check **Vercel Runtime Logs** for `[MCP] raw events payload…`.  
- ESLint checks are disabled during build (`next.config.js`) for simplicity.  

---

## ✅ Requirements Covered
- Mock login flow ✔  
- Calendar dashboard ✔  
- AI summaries with OpenAI ✔  
- External integration via MCP ✔  
- Deployable on Vercel ✔  
