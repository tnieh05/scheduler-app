# Deployment Guide

Two services to deploy:
- **Backend** → Google Cloud Run (free tier)
- **Frontend** → Vercel (free tier)

---

## 1. Backend — Google Cloud Run

### Prerequisites (one-time)

1. Create a free Google account and go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (e.g. `scheduler-app`)
3. Install the Google Cloud CLI: https://cloud.google.com/sdk/docs/install
4. Log in and set your project:
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```
5. Enable the required APIs:
   ```bash
    cloudbuild.googleapis.com
   ```

### Deploy

From the root of this repo, run:

```bash
gcloud run deploy scheduler-backend \
  --source backend \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --max-instances 3
```

- `--source backend` — builds from the `backend/Dockerfile` using Cloud Build (no local Docker needed)
- `--allow-unauthenticated` — lets the frontend call it without auth tokens
- `--memory 1Gi` — OR-Tools needs a bit of headroom
- `--max-instances 3` — keeps costs well within the free tier

The first build takes **5–10 minutes** because OR-Tools is large. Subsequent deploys are faster (layers are cached).

When it finishes, you'll see a URL like:
```
https://scheduler-backend-xxxxxxxxxx-uc.a.run.app
```
**Copy this URL** — you need it for the frontend.

### Free tier limits (plenty for a small team)
- 2 million requests/month
- 360,000 GB-seconds of compute/month
- ~180,000 seconds of 1 GiB instance = ~50 hours of active solver time

---

## 2. Frontend — Vercel

### Prerequisites (one-time)

1. Push this repo to GitHub (if not already)
2. Go to [vercel.com](https://vercel.com) and sign up with your GitHub account
3. Click **Add New Project** → import this repo

### Configure

In Vercel's project settings under **Environment Variables**, add:

| Name | Value |
|------|-------|
| `VITE_API_URL` | `https://scheduler-backend-xxxxxxxxxx-uc.a.run.app` |

Use the Cloud Run URL from the previous step.

### Deploy

Click **Deploy**. Vercel auto-detects the Vite config and builds the frontend.

Your app will be live at `https://your-project.vercel.app`.

---

## Redeploying after code changes

**Backend changes:**
```bash
gcloud run deploy scheduler-backend \
  --source backend \
  --region us-central1
```

**Frontend changes:** Push to GitHub — Vercel redeploys automatically.

---

## Restrict CORS (optional, recommended)

Once deployed, open `backend/main.py` and replace `allow_origins=['*']` with your Vercel URL:

```python
allow_origins=['https://your-project.vercel.app'],
```

Then redeploy the backend.
