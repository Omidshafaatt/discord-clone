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
    # Group/Channel fields
    name: Optional[str] = None
    profile_photo_url: Optional[str] = None
    members_count: Optional[int] = None
    is_public: Optional[bool] = None
    rules: Optional[str] = None

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
    
class RoleOut(BaseModel):
    id: int
    name: str
    permissions: List[str]

    class Config:
        from_attributes = True

class ChannelMemberOut(BaseModel):
    user: UserPublic
    role: Optional[RoleOut] = None

class ChannelOut(BaseModel):
    id: int
    chat_type: str          # "channel"
    created_at: datetime
    name: str
    description: Optional[str] = None
    profile_photo_url: Optional[str] = None
    is_public: bool
    rules: Optional[str] = None
    members: List[ChannelMemberOut]  # includes role info

    class Config:
        from_attributes = True

class ChannelCreateForm:
    def __init__(
        self,
        name: str = Form(...),
        description: Optional[str] = Form(None),
        is_public: bool = Form(True),
        rules: Optional[str] = Form(None),
        profile_photo: Optional[UploadFile] = File(None),
        initial_members: Optional[List[str]] = Form(None)
    ):
        self.name = name
        self.description = description
        self.is_public = is_public
        self.rules = rules
        self.profile_photo = profile_photo
        self.initial_members = initial_members

class ChannelUpdateForm:
    def __init__(
        self,
        name: Optional[str] = Form(None),
        description: Optional[str] = Form(None),
        is_public: Optional[bool] = Form(None),
        rules: Optional[str] = Form(None),
        profile_photo: Optional[UploadFile] = File(None)
    ):
        self.name = name
        self.description = description
        self.is_public = is_public
        self.rules = rules
        self.profile_photo = profile_photo
        
class RoleCreate(BaseModel):
    name: str
    permissions: List[str]   # list of permission strings        