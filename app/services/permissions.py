from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.chat import ChatParticipant, Role, ChatType
from fastapi import HTTPException, status

async def get_user_role_in_chat(db: AsyncSession, user_id: int, chat_id: int):
    stmt = select(ChatParticipant).where(
        ChatParticipant.chat_id == chat_id,
        ChatParticipant.user_id == user_id
    )
    result = await db.execute(stmt)
    participant = result.scalar_one_or_none()
    if not participant:
        return None
    if participant.role_id:
        role = await db.get(Role, participant.role_id)
        return role
    # For DM/GROUP without role, default to member permissions? But we only check for channels.
    return None

async def check_permission(db: AsyncSession, user_id: int, chat_id: int, required_permission: str):
    # First, check if chat is a channel
    chat = await db.get(Chat, chat_id)
    if not chat or chat.chat_type != ChatType.CHANNEL:
        # For DM/GROUP, no permission restrictions (or allow all)
        return True
    participant = await get_user_role_in_chat(db, user_id, chat_id)
    if not participant:
        raise HTTPException(status_code=403, detail="Not a member of this channel")
    if required_permission in participant.permissions:
        return True
    raise HTTPException(status_code=403, detail=f"Missing permission: {required_permission}")