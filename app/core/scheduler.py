from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import datetime, timezone
from sqlalchemy import select
import json

from app.db.session import AsyncSessionLocal 
from app.models.message import Message
from app.models.chat import ChatParticipant
from app.managers.websocket_manager import manager

# ۱. تعریف یک نمونه از زمان‌بند غیرهمزمان
scheduler = AsyncIOScheduler()

async def check_and_send_scheduled_messages():
    """این تابع توسط APScheduler به صورت دوره‌ای اجرا می‌شود"""
    try:
        async with AsyncSessionLocal() as db:
            # توجه: اگر دیتابیس شما timezone را ذخیره نمی‌کند، utcnow استفاده کنید: datetime.utcnow()
            now = datetime.now(timezone.utc)
            
            stmt = select(Message).where(
                Message.is_sent == False,
                Message.scheduled_at <= now,
                Message.is_deleted == False
            )
            result = await db.execute(stmt)
            pending_messages = result.scalars().all()

            for msg in pending_messages:
                members = await db.execute(select(ChatParticipant.user_id).where(ChatParticipant.chat_id == msg.chat_id))
                member_ids = [row[0] for row in members.all()]
                
                message_json = json.dumps({
                    "event": "new_message",
                    "chat_id": msg.chat_id,
                    "sender_id": msg.sender_id,
                    "content": msg.content,
                    "created_at": msg.created_at.isoformat(),
                    "is_scheduled_delivery": True
                })
                
                await manager.broadcast_to_chat(msg.chat_id, member_ids, message_json)
                
                # نیازی به db.add(msg) نیست؛ SQLAlchemy تغییر وضعیت را به صورت خودکار ردیابی می‌کند
                msg.is_sent = True 
            
            if pending_messages:
                await db.commit()
                print(f"{len(pending_messages)} scheduled messages sent.")
                
    except Exception as e:
        print(f"Error in APScheduler Job: {e}")