from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.v1.endpoints.auth import get_current_user, get_user_by_username
from app.schemas.user import UserPrivate, UserPublic, UserUpdate
from app.models.user import User
from app.db.session import get_db


router = APIRouter(prefix="/profile", tags=["Profile"])

# ---------------- 4. پروفایل خود (Profile - Private) ----------------
@router.get("/profile/me", response_model=UserPrivate)
async def get_my_profile(current_user: User = Depends(get_current_user)):
    return current_user

# ---------------- 5. پروفایل دیگران (Profile - Public) ----------------
@router.get("/profile/{username}", response_model=UserPublic)
async def get_user_profile(username: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    user = await get_user_by_username(db, username)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user

# ---------------- 6. ویرایش پروفایل خود (Edit Profile) ----------------
@router.patch("/profile/me", response_model=UserPrivate)
async def update_my_profile(
    update_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # 1. بررسی یکتایی username اگر کاربر آن را تغییر داده و مقداری غیر از None فرستاده است
    if update_data.username is not None and update_data.username != current_user.username:
        existing_user = await get_user_by_username(db, update_data.username)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username is already taken"
            )
    
    # 2. استخراج داده‌هایی که کاربر ارسال کرده است
    # exclude_unset=True باعث می‌شود فقط فیلدهایی که کاربر در JSON ارسال کرده در نظر گرفته شوند
    updated_fields = update_data.model_dump(exclude_unset=True)
    
    # 3. به‌روزرسانی تک‌تک فیلدها روی آبجکت دیتابیس
    for field, value in updated_fields.items():
        setattr(current_user, field, value)
    
    # 4. ذخیره در دیتابیس
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    
    return current_user
