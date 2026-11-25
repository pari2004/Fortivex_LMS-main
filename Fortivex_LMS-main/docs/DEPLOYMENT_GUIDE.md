# Production Deployment Guide: Fortivex LMS

This guide walks you through deploying the complete Fortivex LMS production stack:
* **Frontend:** Next.js deployed on **Vercel**
* **Backend:** FastAPI container deployed on **Railway**
* **Database & Cache:** PostgreSQL & Redis hosted on **Railway**
* **Object Storage:** AWS S3 (`empowersacademy-lms-storage`, `ap-south-1`)

---

## Architecture Topology

```
┌────────────────────────────────────────────────────────┐
│                        STUDENT / USER                  │
└───────────────────────────┬────────────────────────────┘
                            │
               HTTPS        │        Static Assets
                            ▼
           ┌────────────────────────────────┐
           │      VERCEL (Edge CDN)         │
           │      Next.js Frontend          │
           └────────────────┬───────────────┘
                            │
            API Calls       │  /api/v1/... (via Server Rewrites)
                            ▼
           ┌────────────────────────────────┐
           │       RAILWAY (Container)      │
           │       FastAPI Backend          │
           └───┬────────────────────────┬───┘
               │                        │
       Private │ Network        Private │ Network
               ▼                        ▼
    ┌─────────────────────┐  ┌─────────────────────┐
    │  Railway PostgreSQL │  │    Railway Redis    │
    └─────────────────────┘  └─────────────────────┘
               ▲
               │
        Uploads & Media Stream
               │
               ▼
    ┌──────────────────────────────────────────────┐
    │     AWS S3 (empowersacademy-lms-storage)     │
    │     Videos, PDFs, Assignments, Media         │
    └──────────────────────────────────────────────┘
```

---

## Phase 1: Deploy Backend & Database on Railway

Your PostgreSQL database is already hosted on Railway. Now deploy the FastAPI backend and Redis alongside it.

### Step 1.1: Add Redis to Your Railway Project
1. In your Railway project, click **New** $\rightarrow$ **Database** $\rightarrow$ **Add Redis**.
2. Once deployed, click the Redis service $\rightarrow$ **Variables** tab $\rightarrow$ copy `REDIS_URL` (format: `redis://default:password@host:port`).

### Step 1.2: Deploy the FastAPI Backend Service
1. In the same Railway project, click **New** $\rightarrow$ **GitHub Repo**.
2. Select your `Fortivex_LMS` repository.
3. Click the newly created backend service $\rightarrow$ **Settings**:
   * **Root Directory:** Set to `/backend`
   * **Build / Deploy:** Railway will automatically detect [`backend/Dockerfile`](file:///d:/Krishna Stuff/Work/Fortivex AI/Fortivex_LMS/backend/Dockerfile).
4. Click **Generate Domain** under the **Networking** section to get your backend URL (e.g. `https://fortivex-backend-production.up.railway.app`).

### Step 1.3: Set Backend Environment Variables
Go to your backend service $\rightarrow$ **Variables** tab $\rightarrow$ **Raw Editor** (or add one-by-one):

```env
# Application
ENVIRONMENT=production
APP_NAME=Fortivex LMS

# Database & Cache (Copy from your Railway PostgreSQL & Redis services)
DATABASE_URL=postgresql://postgres:XwJtCUseOMPJWQHzMiBkQpaKchyOoyql@roundhouse.proxy.rlwy.net:44922/railway
REDIS_URL=redis://default:...@...:6379

# Authentication & Security
JWT_SECRET_KEY=dev-test-only-not-a-real-secret-12345
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60
JWT_REFRESH_TOKEN_EXPIRE_DAYS=30

# CORS (Allow both your local dev and your Vercel domains)
CORS_ALLOWED_ORIGINS=http://localhost:3000,https://*.vercel.app

# Google Gemini AI
AI_API_KEY=your-gemini-api-key-here
AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
AI_MODEL=gemini-3.5-flash-lite

# Judge0 Code Execution
JUDGE0_URL=https://ce.judge0.com
JUDGE0_API_KEY=
JUDGE0_API_HOST=

# AWS S3 Object Storage (Connected & Hardened)
STORAGE_BUCKET_NAME=empowersacademy-lms-storage
STORAGE_REGION=ap-south-1
STORAGE_ACCESS_KEY_ID=your-aws-access-key-id-here
STORAGE_SECRET_ACCESS_KEY=your-aws-secret-access-key-here
STORAGE_ENDPOINT_URL=
```

> [!NOTE]
> The backend Dockerfile automatically executes `alembic upgrade head` before starting `uvicorn`. Pending database migrations are run automatically upon every deploy.

### Step 1.4: Verify Backend Health
Once deployed, open your browser and navigate to:
```
https://<your-backend-railway-domain>.up.railway.app/health
```
You should see: `{"status": "ok"}`.

---

## Phase 2: Deploy Frontend on Vercel

### Step 2.1: Import the Project in Vercel
1. Log in to [Vercel](https://vercel.com) and click **Add New...** $\rightarrow$ **Project**.
2. Connect your GitHub account and click **Import** on the `Fortivex_LMS` repository.

### Step 2.2: Configure Build Settings
Under the **Configure Project** screen:
1. **Root Directory:** Click **Edit** and choose **`frontend`** (Crucial: do not deploy from repository root).
2. **Framework Preset:** Select **Next.js** (detected automatically).
3. **Build Command:** Leave as default (`npm run build`).
4. **Output Directory:** Leave as default (`.next`).

### Step 2.3: Set Frontend Environment Variables
Expand the **Environment Variables** section and add:

| Key | Value | Description |
| :--- | :--- | :--- |
| `INTERNAL_API_URL` | `https://<your-backend-domain>.up.railway.app` | Used by Next.js server rewrites to proxy `/api/*` to Railway. |
| `NEXT_PUBLIC_API_URL` | `https://<your-backend-domain>.up.railway.app` | Direct backend API base URL for client-side queries. |
| `NEXT_PUBLIC_APP_ENV` | `production` | Enables production mode flags. |

> [!CAUTION]
> **Do NOT add your AWS S3 secret keys to Vercel.** S3 credentials must remain on Railway to prevent exposing access keys to the public web browser.

### Step 2.4: Deploy
Click **Deploy**. Vercel will build and assign you a production URL (e.g., `https://fortivex-lms.vercel.app`).

---

## Phase 3: Connect Frontend and Backend (CORS)

Once Vercel generates your production domain:
1. Return to the **Railway Dashboard** $\rightarrow$ Click your **Backend** service $\rightarrow$ **Variables**.
2. Update `CORS_ALLOWED_ORIGINS` to include your exact Vercel URL:
   ```env
   CORS_ALLOWED_ORIGINS=http://localhost:3000,https://fortivex-lms.vercel.app
   ```
3. Railway will trigger a zero-downtime redeployment to apply the updated CORS headers.

---

## Phase 4: Production Verification & Testing Checklist

Once both services are running:

- [ ] **Health Check:** `https://<railway-domain>/health` returns `{"status":"ok"}`.
- [ ] **User Authentication:** Log in on the Vercel frontend. Open Developer Tools $\rightarrow$ Network tab to verify that `/api/v1/auth/login` returns HTTP 200 and sets tokens.
- [ ] **Media Upload to S3:**
  1. Log in as an Admin or Instructor.
  2. Navigate to Curriculum Builder $\rightarrow$ Add a Lesson $\rightarrow$ Upload a Video or PDF document.
  3. Verify that the file saves directly to your AWS S3 bucket:
     `https://empowersacademy-lms-storage.s3.ap-south-1.amazonaws.com/...`
- [ ] **Student Assignment Submission:**
  1. Log in as a Student $\rightarrow$ Open an assignment.
  2. Submit a document or code file.
  3. Verify the file uploads to S3 under `assignments/{activity_id}/{student_id}/...`.

---

## Phase 5: Custom Domain Setup (Optional)

If you own `empowersacademy.com` or `medivexai.com`:

### In Vercel (Frontend Custom Domain):
1. Go to Vercel $\rightarrow$ **Settings** $\rightarrow$ **Domains**.
2. Add `lms.empowersacademy.com`.
3. In your DNS provider (GoDaddy / Cloudflare):
   * Type: `CNAME`
   * Name: `lms`
   * Value: `cname.vercel-dns.com`

### In Railway (Backend Custom Domain):
1. Go to Railway Backend $\rightarrow$ **Settings** $\rightarrow$ **Networking** $\rightarrow$ **Custom Domain**.
2. Add `api.empowersacademy.com`.
3. In your DNS provider:
   * Type: `CNAME`
   * Name: `api`
   * Value: `<assigned-railway-dns>`
4. Update `INTERNAL_API_URL` and `NEXT_PUBLIC_API_URL` in Vercel to `https://api.empowersacademy.com`.

