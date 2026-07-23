from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from app.core.config import settings

# 1. ساخت Engine برای اتصال به PostgreSQL
# echo=True باعث می‌شود کوئری‌های SQL در کنسول لاگ شوند (برای دیباگ عالی است)
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=True,
    pool_pre_ping=True, # برای جلوگیری از قطعی‌های ناگهانی دیتابیس
)

# 2. تنظیم Session Factory برای ایجاد نشست‌های دیتابیس
AsyncSessionLocal = async_sessionmaker(
    engine, 
    class_=AsyncSession, 
    expire_on_commit=False
)

# 3. کلاس Base برای مدل‌ها (فعلاً خالی است تا مدل‌ها را بعداً اضافه کنید)
# در فاز بعدی مدل‌های خود را از این Base ارث‌بری می‌کنید
Base = declarative_base()

# 4. تابع کمکی برای دریافت Session در مسیرهای API
async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()