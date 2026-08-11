from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from fastapi import Form, UploadFile, File
# 1. برای ورودی ثبت‌نام
# class UserCreate(BaseModel):
#     phone_number: str = Field(..., max_length=20)
#     name: str = Field(..., min_length=1, max_length=100)
#     password: str = Field(..., min_length=6)
#     username: Optional[str] = Field(None, max_length=50)
#     profile_photo_url: Optional[str] = None
#     bio: Optional[str] = Field(None, max_length=500)
class LoginForm:
    def __init__(
        self,
        phone_number: str = Form(...),
        password: str = Form(...),
    ):
        self.phone_number = phone_number
        self.password = password

# 3. برای خروجی پروفایل عمومی (دیگر کاربران)
class UserPublic(BaseModel):
    id: int
    name: str
    username: str
    profile_photo_url: Optional[str] = None
    bio: Optional[str] = None

    class Config:
        from_attributes = True

# 4. برای خروجی پروفایل خصوصی (خود کاربر - شامل شماره تلفن)
class UserPrivate(UserPublic):
    phone_number: str
    allow_group_invites: bool   # 👈 اضافه شد

# 5. برای توکن JWT که به کاربر برمی‌گردانیم
class Token(BaseModel):
    access_token: str
    token_type: str

# class UserUpdate(BaseModel):
#     name: Optional[str] = Field(None, min_length=1, max_length=100)
#     username: Optional[str] = Field(None, max_length=50)
#     bio: Optional[str] = Field(None, max_length=500)
#     profile_photo_url: Optional[str] = None
#     allow_group_invites: Optional[bool] = None   # 👈 اضافه شد

class UserUpdateForm:
    def __init__(
        self,
        name: Optional[str] = Form(None, min_length=1, max_length=100),
        username: Optional[str] = Form(None, max_length=50),
        bio: Optional[str] = Form(None, max_length=500),
        allow_group_invites: Optional[bool] = Form(None),
        profile_photo: Optional[UploadFile] = File(None)
    ):
        self.name = name
        self.username = username
        self.bio = bio
        self.allow_group_invites = allow_group_invites
        self.profile_photo = profile_photo



