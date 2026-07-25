from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.v1.endpoints.auth import get_current_user, get_user_by_username
from app.schemas.user import UserPrivate, UserPublic, UserUpdateForm
from app.models.user import User
from app.db.session import get_db
from app.services.file_upload import delete_profile_photo, save_profile_photo


router = APIRouter(prefix="/profile", tags=["Profile"])

# ---------------- 4. پروفایل خود (Profile - Private) ----------------
@router.get("/me", response_model=UserPrivate)
async def get_my_profile(current_user: User = Depends(get_current_user)):
    return current_user

# ---------------- 5. پروفایل دیگران (Profile - Public) ----------------
@router.get("/{username}", response_model=UserPublic)
async def get_user_profile(username: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    user = await get_user_by_username(db, username)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user

# ---------------- 6. ویرایش پروفایل خود (Edit Profile) ----------------
@router.patch("/me", response_model=UserPrivate)
async def update_my_profile(
    update_data: UserUpdateForm = Depends(), # 👈 تغییر به فرم
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # ۱. بررسی یکتایی username اگر کاربر آن را تغییر داده است
    if update_data.username is not None and update_data.username != current_user.username:
        existing_user = await get_user_by_username(db, update_data.username)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username is already taken"
            )
            
    # ۲. پردازش عکس جدید در صورت ارسال
    if update_data.profile_photo is not None:
        # آپشنال اما به شدت توصیه شده: حذف عکس قبلی کاربر از روی سرور برای خالی شدن فضا
        
        if current_user.profile_photo_url:
            # حذف اسلش اول آدرس برای رسیدن به مسیر واقعی روی هارد
            # مثال: /static/profiles/xxx.jpg تبدیل میشه به static/profiles/xxx.jpg
            old_file_path = current_user.profile_photo_url.lstrip("/") 
            await delete_profile_photo(old_file_path)  # حذف عکس قبلی از روی سرور
                
        # ذخیره عکس جدید با استفاده از تابعی که قبلاً نوشتیم
        new_photo_url = await save_profile_photo(update_data.profile_photo)
        current_user.profile_photo_url = new_photo_url

    # ۳. آماده‌سازی سایر فیلدها برای آپدیت
    # مقادیری که توسط کاربر ارسال شده‌اند (غیر از None) را جدا می‌کنیم
    fields_to_update = {
        "name": update_data.name,
        "username": update_data.username,
        "bio": update_data.bio,
        "allow_group_invites": update_data.allow_group_invites,
    }

    # ۴. به‌روزرسانی تک‌تک فیلدها روی آبجکت دیتابیس
    for field, value in fields_to_update.items():
        if value is not None:  # فقط در صورتی که فیلد ارسال شده باشد آپدیت می‌شود
            setattr(current_user, field, value)
    
    # ۵. ذخیره در دیتابیس
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    
    return current_user