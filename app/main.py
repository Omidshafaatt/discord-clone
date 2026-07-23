from fastapi import FastAPI, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import engine, get_db, Base
from app.core.config import settings
from sqlalchemy.sql import text


from fastapi.security import OAuth2PasswordBearer
from app.api.v1.endpoints import auth, profile

app = FastAPI(title="Messaging Service", version="1.0.0")

# یک مسیر ساده برای تست اتصال دیتابیس
# @app.get("/healthcheck")
# async def healthcheck(db: AsyncSession = Depends(get_db)):
#     # اینجا یک کوئری ساده به دیتابیس می‌زنیم
#     # (مثلاً "SELECT 1") تا مطمئن شویم اتصال برقرار است
#     result = await db.execute(text("SELECT 1"))
#     return {"status": "connected", "db_test": result.scalar_one_or_none()}

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login") # برای دریافت توکن از هدر Authorization

# ثبت روترهای API
app.include_router(auth.router)
app.include_router(profile.router)

@app.on_event("startup")
async def startup_event():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Server is starting up...")

@app.on_event("shutdown")
async def shutdown_event():
    await engine.dispose()