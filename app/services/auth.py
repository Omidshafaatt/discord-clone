from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
from app.core.security import get_password_hash

async def get_user_by_phone(db: AsyncSession, phone: str):
    result = await db.execute(select(User).where(User.phone_number == phone))
    return result.scalar_one_or_none()

async def get_user_by_username(db: AsyncSession, username: str):
    result = await db.execute(select(User).where(User.username == username))
    return result.scalar_one_or_none()

# ---------------- 2. تابع ساخت کاربر ----------------
async def create_user(
    db: AsyncSession, 
    phone_number: str, 
    name: str, 
    password: str, 
    username: Optional[str], 
    bio: Optional[str], 
    profile_photo_url: Optional[str]
):
    # هش کردن رمز عبور
    hashed_password = get_password_hash(password)
    
    # ساخت آبجکت کاربر
    new_user = User(
        phone_number=phone_number,
        name=name,
        hashed_password=hashed_password,
        username=username,
        profile_photo_url=profile_photo_url,
        bio=bio
    )
    
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user