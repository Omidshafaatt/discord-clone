from datetime import datetime
from pydantic import BaseModel
from typing import Optional

# برای دریافت درخواست ارسال پیام متنی
class MessageCreate(BaseModel):
    content: str

# برای نمایش پیام در تاریخچه یا پاسخ‌های WebSocket
class MessageOut(BaseModel):
    id: int
    chat_id: int
    sender_id: int
    content: Optional[str] = None
    message_type: str
    created_at: datetime
    is_deleted: bool
    
    # برای فایل‌های رسانه‌ای، آدرس فایل را برمی‌گردانیم
    media_url: Optional[str] = None  

    class Config:
        from_attributes = True


class MessageUpdate(BaseModel):
    content: str