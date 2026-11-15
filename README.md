# Renewable Energy Production Pattern Discovery (ML-PBL)

Unsupervised discovery of recurring operating regimes in 3 years (2019-2021) of CAISO/NREL
solar irradiance, wind and generation data, using PCA + Gaussian Mixture Models.

- `backend/` - FastAPI service that runs the PCA/GMM pipeline and serves the API
- `frontend/` - React + Vite + Tailwind dashboard (with a Three.js 3D site model)
- `data/` - source dataset and cached pipeline artefacts

## Run

Backend (from the repo root so the data path resolves):

```bash
pip install -r backend/requirements.txt
PYTHONPATH=backend python -m uvicorn app.main:app --port 8000
```

Frontend:

```bash
cd frontend
pnpm install
pnpm dev
```

Then open http://127.0.0.1:5173
