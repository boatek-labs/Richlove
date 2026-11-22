# PROPOSER — for Richlove

A private, personal storytelling experience by Foster. The story begins with a real memory from BECE, around **8 July 2024**, and ends with an honest invitation to get to know each other more deeply.

This is a real application, not a simulated proposal template. Responses, questions, and a chosen nickname are stored in PostgreSQL when the database is configured. No response is inferred from silence.

## Stack

- Node.js + Express
- PostgreSQL (Neon-compatible) via `pg`
- HTML, CSS, vanilla JavaScript
- GSAP for optional motion enhancement; core experience works without it
- Vercel-compatible Express entry point

## Local setup

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env` and fill in the values.
3. Create a PostgreSQL database and run `database/schema.sql`.
4. Run `npm install`.
5. Run `npm run dev` and open the local URL.

Required environment variables:
- `DATABASE_URL`
- `INVITE_TOKEN` — a long random invitation token; Richlove's link is `https://YOUR-DOMAIN/?invite=YOUR_TOKEN`. The server exchanges it for an HttpOnly cookie and redirects to a clean URL.
- `ADMIN_PASSWORD` — a strong private password for Foster's control room at `/admin`
- `SESSION_SECRET` — a long random secret used to sign the admin session cookie

Optional:
- `PORT` (defaults to 3000)
- `NODE_ENV`

Do not commit `.env` or share the invitation token publicly. Use Vercel environment variables for production.

## Routes

- `/` — Richlove's private story
- `/admin` — Foster's private control room
- `GET /api/health` — service and database readiness
- `GET /api/my-state` — restore the invited visitor's saved response and nickname
- `POST /api/response` — save a proposal response
- `POST /api/nickname` — save her own chosen nickname
- `POST /api/questions` — submit a question for Foster
- `POST /api/admin/login` — admin login
- `GET /api/admin/overview` — response and question overview (admin only)

## Privacy and consent

- No analytics, ad trackers, or third-party identity profiling.
- The story page is served only after the server validates the invitation token. It is exchanged for an HttpOnly, SameSite=Strict cookie; the token is not stored in browser JavaScript.
- The invitation link is personal. Do not post it publicly or commit the token to GitHub.
- The site does not treat a visit, a timer, or silence as a yes or no.
- Richlove can choose yes, no, or that she needs time. Her choice is respected.
- The admin dashboard shows submitted answers, not private browsing behaviour.
- Configure HTTPS in production. Use a unique, high-entropy invitation token and admin password.

## Deployment

Connect this repository to Vercel and add the required environment variables in Project Settings. Vercel can deploy the Express entry point and serve files from `public/`. Run the SQL schema once against the production database before sharing the invitation link.

The story HTML lives in `views/` and is served by the Express app only after invitation validation. Static assets live in `public/`. The production URL, invitation token, admin password, session secret, and database are not configured by repository commits alone.
