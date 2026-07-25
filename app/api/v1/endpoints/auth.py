from fastapi import APIRouter, Depends, HTTPException, status, Form, UploadFile, File
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from jose import jwt, JWTError
from typing import Optional

from app.db.session import get_db
from app.schemas.user import LoginForm, Token  
from app.services.auth import create_user, get_user_by_phone, get_user_by_username
from app.core.security import verify_password, create_access_token, SECRET_KEY, ALGORITHM
from app.models.user import User

from fastapi.security import OAuth2PasswordRequestForm

from app.services.file_upload import save_profile_photo

router = APIRouter(prefix="/auth", tags=["Authentication"])

# ---------------- تنظیمات توکن ----------------
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login") # <--- این خط مهم است

# ---------------- وابستگی برای گرفتن کاربر فعلی ----------------
async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        phone_number: str = payload.get("sub")
        if phone_number is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = await get_user_by_phone(db, phone_number)
    if user is None:
        raise credentials_exception
    return user

# ---------------- 1. ثبت‌نام (Register) ----------------
@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(
    # استفاده از Form به جای BaseModel برای دریافت متن در کنار فایل
    phone_number: str = Form(..., max_length=20),
    name: str = Form(..., min_length=1, max_length=100),
    password: str = Form(..., min_length=6),
    username: Optional[str] = Form(None, max_length=50),
    bio: Optional[str] = Form(None, max_length=500),
    # دریافت فایل عکس
    profile_photo: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db)
):
    # بررسی تکراری نبودن شماره تلفن
    existing_user = await get_user_by_phone(db, phone_number)
    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Phone number already registered")
    
    # بررسی تکراری نبودن نام کاربری
    if username:
        existing_username = await get_user_by_username(db, username)
        if existing_username:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username is already taken")
    
    # ---------------- ذخیره عکس پروفایل ----------------
    photo_url = None
    if profile_photo:
        photo_url = await save_profile_photo(profile_photo)  # ذخیره عکس پروفایل با استفاده از سرویس
    # ---------------------------------------------------

    # ساخت کاربر جدید
    new_user = await create_user(
        db=db, 
        phone_number=phone_number, 
        name=name, 
        password=password, 
        username=username, 
        bio=bio, 
        profile_photo_url=photo_url
    )
    
    access_token = create_access_token(data={"sub": new_user.phone_number})
    return {"access_token": access_token, "token_type": "bearer"}

# ---------------- 2. ورود (Login) ----------------
@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    # OAuth2PasswordRequestForm به جای UserLogin استفاده می‌شود
    # فرم دارای دو فیلد است: username و password
    # ما انتظار داریم کاربر در فیلد username، شماره تلفن خود را وارد کند.
    
    user = await get_user_by_phone(db, form_data.username)  # در اینجا username همان شماره تلفن است
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Incorrect phone number or password"
        )
    
    access_token = create_access_token(data={"sub": user.phone_number})
    return {"access_token": access_token, "token_type": "bearer"}

# ---------------- 3. خروج (Logout) ----------------
@router.post("/logout")
async def logout(current_user: User = Depends(get_current_user)):
    return {"message": "Successfully logged out. Please clear your token on client side."}
