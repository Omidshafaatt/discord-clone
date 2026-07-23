from pydantic import BaseModel
from datetime import datetime
from app.schemas.user import UserPublic

class ChatCreate(BaseModel):
    target_username: str  # یوزرنیم کاربری که می‌خواهیم با او چت کنیم

class ChatOut(BaseModel):
    id: int
    chat_type: str
    created_at: datetime
    
    # برای DM، اطلاعات کاربر مقابل را برمی‌گردانیم
    other_user: UserPublic 

    class Config:
        from_attributes = True