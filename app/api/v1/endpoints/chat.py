from typing import List

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select, desc, and_
from sqlalchemy.orm import selectinload
from app.api.v1.endpoints.auth import get_current_user
from app.db.session import get_db
from app.models.chat import Chat, ChatParticipant
from app.models.message import Message, Media, MessageType, MediaType
from app.models.user import User
from app.schemas.chat import ChatCreate, ChatOut
from app.schemas.message import MessageCreate, MessageOut, MessageUpdate
from app.services.chat import get_or_create_dm_chat
from app.services.file_upload import save_upload_file
from app.managers.websocket_manager import manager
import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import or_
from datetime import datetime, timezone

router = APIRouter(prefix="/chat", tags=["Chat"])

# 1. ایجاد چت خصوصی (یا بازگرداندن چت موجود)
@router.post("/", response_model=ChatOut, status_code=status.HTTP_201_CREATED)
async def start_dm_chat(
    chat_data: ChatCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        target_user_id = await db.scalar(select(User.id).where(User.username == chat_data.target_username))
        chat = await get_or_create_dm_chat(db, current_user.id, target_user_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    
    # برای پیدا کردن "other_user" (کاربر مقابل) در پاسخ، دوباره پرس‌وجو می‌کنیم
    # (بهتر است یک تابع کمکی برای این کار در سرویس بنویسیم، اما فعلاً اینجا ساده می‌نویسیم)
    participants_result = await db.execute(
        select(User).join(ChatParticipant, User.id == ChatParticipant.user_id)
        .where(ChatParticipant.chat_id == chat.id, User.id != current_user.id)
    )
    other_user = participants_result.scalar_one()
    
    # طبق Schema ChatOut، دیکشنری را به صورت دستی می‌سازیم
    return {
        "id": chat.id,
        "chat_type": chat.chat_type.value,
        "created_at": chat.created_at,
        "other_user": other_user
    }

# 2. لیست چت‌های کاربر (با اطلاعات کاربر مقابل)
@router.get("/", response_model=list[ChatOut])
async def get_user_chats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # کوئری برای دریافت چت‌های کاربر، همراه با بارگذاری اعضا و کاربرانشان
    result = await db.execute(
        select(Chat)
        .join(ChatParticipant, Chat.id == ChatParticipant.chat_id)
        .where(ChatParticipant.user_id == current_user.id)
        .options(selectinload(Chat.participants).selectinload(ChatParticipant.user))
        .order_by(Chat.updated_at.desc())
    )
    chats = result.scalars().all()
    
    response_data = []
    for chat in chats:
        # پیدا کردن کاربر مقابل
        other_user = None
        for participant in chat.participants:
            if participant.user_id != current_user.id:
                other_user = participant.user
                break
        
        # فقط اگر یک DM بود و کاربر مقابل پیدا شد، اضافه کن
        if other_user:
            response_data.append({
                "id": chat.id,
                "chat_type": chat.chat_type.value,
                "created_at": chat.created_at,
                "other_user": other_user
            })
            
    return response_data

# ---------------- 8. ارسال پیام متنی در یک چت ----------------
@router.post("/{chat_id}/messages", response_model=MessageOut)
async def send_text_message(
    chat_id: int,
    message_data: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # 1. بررسی اینکه آیا کاربر عضو این چت است
    participant = await db.execute(
        select(ChatParticipant).where(
            ChatParticipant.chat_id == chat_id,
            ChatParticipant.user_id == current_user.id
        )
    )
    if not participant.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not a member of this chat")

    # بررسی اینکه آیا پیام زمان‌دار است یا عادی
    is_scheduled = message_data.scheduled_at is not None

    # 👈 اعتبارسنجی زمان آینده برای پیام‌های زمان‌دار
    if is_scheduled:
        target_time = message_data.scheduled_at
        
        # اگر زمان ارسالی از سمت کلاینت فاقد تایم‌زون بود، آن را به عنوان UTC در نظر می‌گیریم
        if target_time.tzinfo is None:
            target_time = target_time.replace(tzinfo=timezone.utc)
            
        # مقایسه با زمان حال دقیق در منطقه زمانی UTC
        if target_time <= datetime.now(timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The scheduled time must be in the future."
            )
    
    # اگر زمان‌دار است، در لحظه ارسال نمی‌شود
    is_sent = not is_scheduled

    # 2. ایجاد پیام در دیتابیس
    new_message = Message(
        chat_id=chat_id,
        sender_id=current_user.id,
        message_type=MessageType.TEXT,
        content=message_data.content,
        scheduled_at=message_data.scheduled_at,
        is_sent=is_sent
    )
    db.add(new_message)
    await db.commit()
    await db.refresh(new_message)

    # فقط در صورتی که پیام زمان‌دار *نباشد* آن را الان به سوکت می‌فرستیم
    if not is_scheduled:
        # 3. ارسال پیام زنده به WebSocket
        # (کلیه اعضای چت را پیدا کن)
        members = await db.execute(select(ChatParticipant.user_id).where(ChatParticipant.chat_id == chat_id))
        member_ids = [row[0] for row in members.all()]
        
        message_json = json.dumps({
            "event": "new_message",
            "chat_id": chat_id,
            "sender_id": current_user.id,
            "sender_name": current_user.name,
            "content": new_message.content,
            "created_at": new_message.created_at.isoformat()
        })
        await manager.broadcast_to_chat(chat_id, member_ids, message_json)
    
    return MessageOut(
        id=new_message.id,
        chat_id=new_message.chat_id,
        sender_id=new_message.sender_id,
        content=new_message.content,
        message_type=new_message.message_type.value,
        created_at=new_message.created_at,
        is_deleted=new_message.is_deleted,
        media_url=None,
        scheduled_at=new_message.scheduled_at,
        is_sent=new_message.is_sent
    )

# ---------------- 9. ارسال فایل/رسانه در یک چت ----------------
@router.post("/{chat_id}/messages/media", response_model=MessageOut)
async def send_media_message(
    chat_id: int,
    text_content: str | None = Form(None),  # استفاده از Form به جای متغیر ساده
    scheduled_at: datetime | None = Form(None), # دریافت زمان از طریق فیلد فرم
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # 1. بررسی عضویت
    participant = await db.execute(
        select(ChatParticipant).where(
            ChatParticipant.chat_id == chat_id,
            ChatParticipant.user_id == current_user.id
        )
    )
    if not participant.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not a member of this chat")

    # 👈 اعتبارسنجی زمان آینده برای پیام‌های زمان‌دار
    is_scheduled = scheduled_at is not None
    if is_scheduled:
        target_time = scheduled_at
        if target_time.tzinfo is None:
            target_time = target_time.replace(tzinfo=timezone.utc)
            
        if target_time <= datetime.now(timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The scheduled time must be in the future."
            )
            
    is_sent = not is_scheduled

    # 2. ذخیره فایل روی دیسک محلی
    file_path, file_size = await save_upload_file(file)
    
    # 3. تشخیص نوع رسانه (بر اساس MIME type یا پسوند)
    mime_type = file.content_type or "application/octet-stream"
    if mime_type.startswith("image/"):
        media_type_enum = MediaType.IMAGE
    elif mime_type.startswith("video/"):
        media_type_enum = MediaType.VIDEO
    elif mime_type.startswith("audio/"):
        media_type_enum = MediaType.AUDIO
    else:
        media_type_enum = MediaType.FILE

    # 4. ایجاد پیام و رسانه (Media) در دیتابیس
    new_message = Message(
        chat_id=chat_id,
        sender_id=current_user.id,
        message_type=MessageType.MEDIA,
        content=text_content, # برای فایل، متن اختیاری است
        scheduled_at=scheduled_at,
        is_sent=is_sent
    )
    db.add(new_message)
    await db.flush() # برای گرفتن id قبل از commit

    new_media = Media(
        message_id=new_message.id,
        filename=file.filename,
        file_path=file_path,
        file_size=file_size, # نکته: فایل دوبار خوانده نشود، بهتر است کد اصلاح شود
        mime_type=mime_type,
        media_type=media_type_enum
    )
    # برای جلوگیری از دوبار خوانده شدن فایل، در عمل باید محتوا را یک بار بخوانید. اما اینجا کد ساده شده است.
    # بهتر است قبل از save_upload_file، محتوا را بخوانید و به هر دو بدهید. (در این مثال ساده شده گذشت)
    db.add(new_media)
    await db.commit()
    await db.refresh(new_message)

    if not is_scheduled:
        # 5. WebSocket Broadcast
        members = await db.execute(select(ChatParticipant.user_id).where(ChatParticipant.chat_id == chat_id))
        member_ids = [row[0] for row in members.all()]
        
        message_json = json.dumps({
            "event": "new_message",
            "chat_id": chat_id,
            "sender_id": current_user.id,
            "sender_name": current_user.name,
            "content": f"Sent a {media_type_enum.value}",
            "media_url": file_path,
            "created_at": new_message.created_at.isoformat()
        })
        await manager.broadcast_to_chat(chat_id, member_ids, message_json)

    return MessageOut(
        id=new_message.id,
        chat_id=new_message.chat_id,
        sender_id=new_message.sender_id,
        content=new_message.content,
        message_type=new_message.message_type.value,
        created_at=new_message.created_at,
        is_deleted=new_message.is_deleted,
        media_url=file_path,
        scheduled_at=new_message.scheduled_at,
        is_sent=new_message.is_sent
    )

# ---------------- 10. دریافت تاریخچه پیام‌های یک چت ----------------
@router.get("/{chat_id}/messages", response_model=List[MessageOut])
async def get_chat_history(
    chat_id: int,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # 1. بررسی عضویت کاربر
    participant = await db.execute(
        select(ChatParticipant).where(
            ChatParticipant.chat_id == chat_id,
            ChatParticipant.user_id == current_user.id
        )
    )
    if not participant.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not a member of this chat")

    # 2. دریافت پیام‌ها همراه با Media (اگر باشد)
    result = await db.execute(
        select(Message)
        .options(selectinload(Message.media))
        .where(
            Message.chat_id == chat_id,
            Message.is_deleted == False,
            # 👈 شرط ترکیبی: یا پیام ارسال شده است، یا پیام زمان‌دارِ متعلق به خود کاربر است
            or_(
                Message.is_sent == True,
                Message.sender_id == current_user.id
            )
        )
        .order_by(desc(Message.created_at))
        .limit(limit)
    )

    messages = result.scalars().all()
    msgOuts : List[MessageOut] = []
    for message in messages:
        msgOut = MessageOut(
            id=message.id,
            chat_id=message.chat_id,
            sender_id=message.sender_id,
            content=message.content,
            message_type=message.message_type.value,
            created_at=message.created_at,
            is_deleted=message.is_deleted,
            media_url=message.media.file_path if message.media else None,
            scheduled_at=message.scheduled_at,
            is_sent=message.is_sent
        )
        msgOuts.append(msgOut)

    return list(reversed(msgOuts))  # برگرداندن به ترتیب صعودی (قدیمی‌ترین اول)

# ---------------- تابع کمکی برای بررسی دسترسی حذف در آینده ----------------
async def can_delete_message(user: User, message: Message, db: AsyncSession) -> bool:
    # فعلاً: فقط خود فرستنده می‌تواند حذف کند
    if message.sender_id == user.id:
        return True
    
    # ⭐️ در آینده که گروه و کانال را اضافه کردید، اینجا را تغییر دهید:
    # if await is_chat_admin(user.id, message.chat_id, db):
    #     return True
    
    return False

# ---------------- 1. ویرایش پیام (فقط توسط فرستنده) ----------------
@router.patch("/{chat_id}/messages/{message_id}", response_model=MessageOut)
async def edit_message(
    chat_id: int,
    message_id: int,
    update_data: MessageUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # 1. پیدا کردن پیام
    result = await db.execute(
        select(Message)
        .options(selectinload(Message.media))
        .where(Message.id == message_id)
    )
    message = result.scalar_one()

    if not message:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    if message.chat_id != chat_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message does not belong to this chat")
    if message.sender_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only edit your own messages")

    # 2. اعمال تغییرات
    message.content = update_data.content
    db.add(message)
    await db.commit()
    await db.refresh(message)

    # 3. پخش رویداد ویرایش به صورت زنده (WebSocket)
    members = await db.execute(select(ChatParticipant.user_id).where(ChatParticipant.chat_id == chat_id))
    member_ids = [row[0] for row in members.all()]
    
    edit_event = json.dumps({
        "event": "message_edited",
        "chat_id": chat_id,
        "message_id": message.id,
        "new_content": message.content,
        "updated_at": message.updated_at.isoformat()
    })
    await manager.broadcast_to_chat(chat_id, member_ids, edit_event)

    return MessageOut(
        id=message.id,
        chat_id=message.chat_id,
        sender_id=message.sender_id,
        content=message.content,
        message_type=message.message_type.value,
        created_at=message.created_at,
        is_deleted=message.is_deleted,
        media_url=message.media.file_path if message.media else None,
        scheduled_at=message.scheduled_at,
        is_sent=message.is_sent
    )

# ---------------- 2. حذف پیام (نرم‌افزاری - Soft Delete) ----------------
@router.delete("/{chat_id}/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_message(
    chat_id: int,
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # 1. پیدا کردن پیام
    message = await db.get(Message, message_id)
    if not message:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    if message.chat_id != chat_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message does not belong to this chat")

    # 2. بررسی دسترسی (با تابع کمکی)
    has_permission = await can_delete_message(current_user, message, db)
    if not has_permission:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You don't have permission to delete this message")

    # 3. حذف نرم
    message.is_deleted = True
    db.add(message)
    await db.commit()

    # 4. پخش رویداد حذف به صورت زنده (WebSocket)
    members = await db.execute(select(ChatParticipant.user_id).where(ChatParticipant.chat_id == chat_id))
    member_ids = [row[0] for row in members.all()]
    
    delete_event = json.dumps({
        "event": "message_deleted",
        "chat_id": chat_id,
        "message_id": message.id
    })
    await manager.broadcast_to_chat(chat_id, member_ids, delete_event)

    # 204 No Content (پاسخی برنمی‌گردانیم)

# ---------------- 3. جستجوی پیام‌ها در یک چت ----------------
@router.get("/{chat_id}/messages/search", response_model=List[MessageOut])
async def search_messages_in_chat(
    chat_id: int,
    q: str,  # رشته‌ای که کاربر به دنبال آن است
    limit: int = 50, # تعداد نتایج (اختیاری، پیش‌فرض ۵۰)
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # 1. بررسی عضویت کاربر در چت
    participant = await db.execute(
        select(ChatParticipant).where(
            ChatParticipant.chat_id == chat_id,
            ChatParticipant.user_id == current_user.id
        )
    )
    if not participant.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="You are not a member of this chat"
        )

    # 2. اگر رشته جستجو خالی باشد، خطا بدهیم یا لیست خالی برگردانیم (اینجا لیست خالی برمی‌گردانیم)
    if not q or len(q.strip()) == 0:
        return []

    # 3. اجرای کوئری جستجو
    # از ilike برای جستجوی نادیده گرفتن حروف بزرگ/کوچک استفاده می‌کنیم.
    # "پیام‌های حذف شده (is_deleted=True) را نشان نده"
    stmt = (
        select(Message)
        .options(selectinload(Message.media))
        .where(
            and_(
                Message.chat_id == chat_id,
                Message.is_deleted == False,
                Message.is_sent == True,  # فقط پیام‌های ارسال شده را جستجو کن
                Message.content.ilike(f"%{q}%")
            )
        )
        .order_by(desc(Message.created_at))  # جدیدترین‌ها در بالا
        .limit(limit)
    )
    
    result = await db.execute(stmt)
    messages = result.scalars().all()

    # تبدیل به MessageOut
    messages_out = [MessageOut(
        id=msg.id,
        chat_id=msg.chat_id,
        sender_id=msg.sender_id,
        content=msg.content,
        message_type=msg.message_type.value,
        created_at=msg.created_at,
        is_deleted=msg.is_deleted,
        media_url=msg.media.file_path if msg.media else None,
        scheduled_at=msg.scheduled_at,
        is_sent=msg.is_sent
    ) for msg in messages]

    return messages_out

