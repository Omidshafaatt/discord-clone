from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import datetime, timezone
from sqlalchemy import select
import json

from app.db.session import AsyncSessionLocal 
from app.models.message import Message
from app.models.chat import ChatParticipant
from app.managers.websocket_manager import manager

from sqlalchemy.orm import selectinload

# ۱. تعریف یک نمونه از زمان‌بند غیرهمزمان
scheduler = AsyncIOScheduler()

async def check_and_send_scheduled_messages():
    """این تابع توسط APScheduler به صورت دوره‌ای اجرا می‌شود"""
    try:
        async with AsyncSessionLocal() as db:
            # توجه: اگر دیتابیس شما timezone را ذخیره نمی‌کند، utcnow استفاده کنید: datetime.utcnow()
            now = datetime.now(timezone.utc)
            
            # 👈 واکشی پیام‌ها همراه با پیوست رسانه
            stmt = select(Message).options(selectinload(Message.media), selectinload(Message.sender)).where(
                Message.is_sent == False,
                Message.scheduled_at <= now,
                Message.is_deleted == False
            )
            result = await db.execute(stmt)
            pending_messages = result.scalars().all()

            for msg in pending_messages:
                members = await db.execute(select(ChatParticipant.user_id).where(ChatParticipant.chat_id == msg.chat_id))
                member_ids = [row[0] for row in members.all()]

                media_url = msg.media.file_path if msg.media else None
                actual_sent_time = datetime.now(timezone.utc)
                
                message_json = json.dumps({
                    "event": "new_message",
                    "message_id": msg.id,
                    "chat_id": msg.chat_id,
                    "sender_id": msg.sender_id,
                    "sender_name": msg.sender.name if msg.sender else "Unknown",
                    "content": msg.content,
                    "media_url": media_url, # 👈 اضافه شد
                    "message_type": msg.message_type.value, # 👈 اضافه شد برای تشخیص کلاینت
                    "created_at": actual_sent_time.isoformat(),
                    "is_scheduled_delivery": True,
                    "is_sent": True, 
                    "sender_username": msg.sender.username,
                })
                
                await manager.broadcast_to_chat(msg.chat_id, member_ids, message_json)
                
                # نیازی به db.add(msg) نیست؛ SQLAlchemy تغییر وضعیت را به صورت خودکار ردیابی می‌کند
                msg.is_sent = True
                msg.created_at = actual_sent_time   # 👈 set to actual send time
                msg.scheduled_at = None  
            
            if pending_messages:
                await db.commit()
                print(f"{len(pending_messages)} scheduled messages sent.")
                
    except Exception as e:
        print(f"Error in APScheduler Job: {e}")