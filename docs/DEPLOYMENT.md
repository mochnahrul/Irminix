# Deployment Guide (Vercel + Google Cloud Run)

Because **Irminix** is completely stateless (no database), it deploys cleanly to **Google Cloud Run** (Backend) and **Vercel** (Frontend) with near-zero or free-tier operating costs.

---

## 1. Backend Deployment — Google Cloud Run

### Prerequisites
- Google Cloud CLI (`gcloud`) installed and authenticated (`gcloud auth login`)
- A GCP Project with Cloud Run & Cloud Build APIs enabled

### Deploy from `Irminsul/backend`

```powershell
cd Irminsul\backend

gcloud run deploy irminix-api `
  --source . `
  --region asia-southeast1 `
  --allow-unauthenticated `
  --min-instances 0 `
  --max-instances 3 `
  --memory 512Mi `
  --cpu 1 `
  --timeout 60 `
  --set-env-vars "ENVIRONMENT=production,ENKA_USER_AGENT=Irminix/1.0,FRONTEND_URL=https://your-app.vercel.app" `
  --set-env-vars "GEMINI_API_KEY=your_gemini_api_key_here"
```

### Cost & Performance Notes
- `--min-instances 0`: Scales to zero when idle so you stay within Cloud Run's **free tier** (2 million requests / 360,000 vCPU-seconds per month).
- `--memory 512Mi`: Comfortably holds the in-memory `TTLCache` (catalog, Yatta indexes, Enka profiles, achievements) without OOMs.
- After deployment, copy the generated Cloud Run URL (e.g., `https://irminix-api-xxxx-as.a.run.app`).
- Verify health: `https://irminix-api-xxxx-as.a.run.app/health`.

---

## 2. Frontend Deployment — Vercel

1. Push the repository to GitHub (ensure `.env` is ignored via `.gitignore`).
2. In **Vercel Dashboard → Add New Project**, import your repository and set:
   - **Root Directory**: `Irminsul/frontend`
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Add the **Environment Variable** in Vercel:
   - `VITE_API_URL` = `https://irminix-api-xxxx-as.a.run.app` *(no trailing slash)*
4. Deploy!

---

## 3. Post-Deploy CORS Check

Once Vercel assigns your production domain (e.g. `https://irminix.vercel.app`), update `FRONTEND_URL` on Cloud Run so `CORSMiddleware` allows requests from your exact Vercel origin:

```powershell
gcloud run services update irminix-api `
  --region asia-southeast1 `
  --update-env-vars "FRONTEND_URL=https://irminix.vercel.app"
```
