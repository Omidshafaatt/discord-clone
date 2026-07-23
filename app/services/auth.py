from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
from app.schemas.user import UserCreate
from app.core.security import get_password_hash

async def get_user_by_phone(db: AsyncSession, phone: str):
    result = await db.execute(select(User).where(User.phone_number == phone))
    return result.scalar_one_or_none()

async def get_user_by_username(db: AsyncSession, username: str):
    result = await db.execute(select(User).where(User.username == username))
    return result.scalar_one_or_none()

async def create_user(db: AsyncSession, user_data: UserCreate):
    # هش کردن رمز عبور
    hashed_password = get_password_hash(user_data.password)
    
    # ساخت آبجکت کاربر
    new_user = User(
        phone_number=user_data.phone_number,
        name=user_data.name,
        hashed_password=hashed_password,
        username=user_data.username,
        profile_photo_url=user_data.profile_photo_url,
        bio=user_data.bio
    )
    
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user) # برای برگرداندن اطلاعات کامل با ID
    return new_user