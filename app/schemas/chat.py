from fastapi import File, Form, UploadFile
from pydantic import BaseModel
from datetime import datetime
from app.schemas.user import UserPublic
from typing import List, Optional

class ChatCreate(BaseModel):
    target_username: str  # یوزرنیم کاربری که می‌خواهیم با او چت کنیم

class ChatOut(BaseModel):
    id: int
    chat_type: str
    created_at: datetime
    other_user: Optional[UserPublic] = None
    # Group fields (optional)
    name: Optional[str] = None
    profile_photo_url: Optional[str] = None
    members_count: Optional[int] = None

    class Config:
        from_attributes = True

# اسکیما برای درخواست ساخت گروه
class GroupCreateForm:
    def __init__(
        self,
        name: str = Form(..., min_length=1),
        description: Optional[str] = Form(None),
        # برای دریافت لیست در فرم، از List[str] استفاده می‌کنیم
        initial_members: Optional[List[str]] = Form(None),
        profile_photo: Optional[UploadFile] = File(None)
    ):
        self.name = name
        self.description = description
        self.initial_members = initial_members
        self.profile_photo = profile_photo

# اسکیما برای پاسخ گروه (شامل اطلاعات کامل و اعضا)
class GroupOut(BaseModel):
    id: int
    chat_type: str                 # مقدار "group"
    created_at: datetime
    name: str
    description: Optional[str] = None
    profile_photo_url: Optional[str] = None
    members: List[UserPublic]      # لیست کاربران عضو (با استفاده از UserPublic)

    class Config:
        from_attributes = True


class GroupUpdateForm:
    def __init__(
        self,
        name: Optional[str] = Form(None),
        description: Optional[str] = Form(None),
        profile_photo: Optional[UploadFile] = File(None)
    ):
        self.name = name
        self.description = description
        self.profile_photo = profile_photo

class AddMembersRequest(BaseModel):
    usernames: List[str]  # لیست یوزرنیم‌های کاربرانی که باید اضافه شوند