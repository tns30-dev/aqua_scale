| Section | Content |
|---|---|
| Title | Tech Stack — From Sensor to Dashboard |
| Subtitle | One stack, deliberately chosen — every layer answers a concrete project constraint. |
| 🔌 IoT Edge | Raspberry Pi · Mosquitto MQTT broker |
| 📡 Real-time Pipeline | Django Channels · Redis (channel layer) · Daphne (ASGI server) |
| 🐍 Backend | Django 5.2 · Django REST Framework · djangorestframework-simplejwt · drf-spectacular · django-unfold · Python 3.12 |
| ⚛️ Frontend | React 19 · TypeScript · Vite 7 · shadcn/ui · Radix · Tailwind CSS · Zustand · react-hook-form · Zod · Recharts · @tanstack/react-table |
| 🗄️ Data & Persistence | PostgreSQL 15 · psycopg2 · `managed = False` (database-first schema) |
| 🔐 Security | HttpOnly JWT cookies · CSRF double-submit · Bandit (SAST) · Semgrep (SAST) · pip-audit (SCA) · npm audit (SCA) · OWASP ZAP (DAST) |
| ⚙️ CI/CD & Quality | GitHub Actions · pytest · Vitest · Playwright · k6 (load + stress) · Ruff · ESLint · mypy · tsc |
| ☁️ Infrastructure & Hosting | Terraform (IaC) · GCP Cloud Run · Artifact Registry · Cloud SQL (Postgres 15) · Secret Manager · Docker |
| Footer | One stack · one ORM · one channel layer — chosen to ship demos and survive consultant reviews. |