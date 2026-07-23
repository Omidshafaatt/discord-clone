from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from app.models.chat import Chat, ChatParticipant, ChatType
from app.models.user import User

async def get_or_create_dm_chat(db: AsyncSession, user_id: int, target_user_id: int) -> Chat:
    # 1. چک کردن اینکه کاربر هدف وجود دارد
    target_user = await db.get(User, target_user_id)
    if not target_user:
        raise ValueError("Target user not found")
    if user_id == target_user_id:
        raise ValueError("You cannot chat with yourself")

    # 2. جستجوی چت موجود (DM) بین این دو کاربر
    # استراتژی: تمام چت‌های DM کاربر را پیدا کن، سپس با جدول participants ترکیب کن و ببین کدام چت شامل هر دو کاربر است.
    # روش بهینه‌تر استفاده از GROUP BY و HAVING است.
    
    subquery = (
        select(ChatParticipant.chat_id)
        .where(ChatParticipant.user_id.in_([user_id, target_user_id]))
        .group_by(ChatParticipant.chat_id)
        .having(func.count(ChatParticipant.chat_id) == 2)
    ).subquery()
    
    stmt = (
        select(Chat)
        .join(subquery, Chat.id == subquery.c.chat_id)
        .where(Chat.chat_type == ChatType.DM)
    )
    result = await db.execute(stmt)
    existing_chat = result.scalar_one_or_none()

    if existing_chat:
        return existing_chat

    # 3. اگر چت وجود نداشت، یک چت جدید بساز
    new_chat = Chat(chat_type=ChatType.DM)
    db.add(new_chat)
    await db.flush()  # برای گرفتن ID چت قبل از commit

    # اضافه کردن هر دو کاربر به عنوان عضو
    participant1 = ChatParticipant(chat_id=new_chat.id, user_id=user_id)
    participant2 = ChatParticipant(chat_id=new_chat.id, user_id=target_user_id)
    db.add_all([participant1, participant2])
    
    await db.commit()
    await db.refresh(new_chat)
    return new_chat