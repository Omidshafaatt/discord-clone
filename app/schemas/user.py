from pydantic import BaseModel, Field, EmailStr
from typing import Optional

# 1. برای ورودی ثبت‌نام
class UserCreate(BaseModel):
    phone_number: str = Field(..., max_length=20)
    name: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=6)
    username: Optional[str] = Field(None, max_length=50)
    profile_photo_url: Optional[str] = None
    bio: Optional[str] = Field(None, max_length=500)

# 2. برای ورود (Login)
class UserLogin(BaseModel):
    phone_number: str
    password: str

# 3. برای خروجی پروفایل عمومی (دیگر کاربران)
class UserPublic(BaseModel):
    name: str
    username: Optional[str]
    profile_photo_url: Optional[str]
    bio: Optional[str]

    class Config:
        from_attributes = True

# 4. برای خروجی پروفایل خصوصی (خود کاربر - شامل شماره تلفن)
class UserPrivate(UserPublic):
    phone_number: str

# 5. برای توکن JWT که به کاربر برمی‌گردانیم
class Token(BaseModel):
    access_token: str
    token_type: str

class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    username: Optional[str] = Field(None, max_length=50)
    bio: Optional[str] = Field(None, max_length=500)
    profile_photo_url: Optional[str] = None