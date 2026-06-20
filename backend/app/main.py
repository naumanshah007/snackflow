from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import create_db_and_tables
from app.routers import admin, auth, monthly_closing, reports, sales, stock

app = FastAPI(title="SnackFlow API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(stock.router)
app.include_router(sales.router)
app.include_router(reports.router)
app.include_router(monthly_closing.router)


@app.on_event("startup")
def on_startup() -> None:
    if settings.auto_seed_demo:
        from app.seed import seed

        seed()
        return
    if settings.auto_create_tables:
        create_db_and_tables()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
