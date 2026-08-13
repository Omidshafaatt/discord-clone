from typing import List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import func, select, desc, and_
from sqlalchemy.orm import selectinload, joinedload
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import or_
import json
from datetime import datetime, timezone

# ---- Local imports ----
from app.api.v1.endpoints.auth import get_current_user
from app.db.session import get_db
from app.models.chat import Chat, ChatParticipant, ChatType
# 👇 Import Role from models
from app.models.chat import Role
from app.models.message import Message, Media, MessageType, MediaType
from app.models.user import User
from app.schemas.chat import (
    AddMembersRequest,
    ChatCreate,
    ChatOut,
    GroupCreateForm,
    GroupOut,
    GroupUpdateForm,
    # Channel schemas
    ChannelOut,
    ChannelCreateForm,
    ChannelUpdateForm,
    RoleOut,
    ChannelMemberOut,
    RoleCreate,
)
from app.schemas.message import MessageCreate, MessageOut, MessageUpdate
from app.schemas.user import UserPublic
from app.services.auth import get_user_by_username
from app.services.chat import get_or_create_dm_chat
from app.services.file_upload import delete_profile_photo, save_profile_photo, save_upload_file
from app.managers.websocket_manager import manager

# ---- Permissions helper (if not in separate module) ----
# You can move this to app/core/permissions.py later.
DEFAULT_ROLES = {
    "admin": [
        "send_messages", "upload_media", "edit_messages",
        "delete_messages", "manage_members", "manage_channel"
    ],
    "moderator": ["send_messages", "upload_media", "edit_messages", "delete_messages"],
    "member": ["send_messages", "upload_media"],
}

async def check_permission(
    db: AsyncSession,
    user_id: int,
    chat_id: int,
    required_permission: str
) -> bool:
    """Check if a user has a specific permission in a channel."""
    chat = await db.get(Chat, chat_id)
    if not chat or chat.chat_type != ChatType.CHANNEL:
        return True  # Not a channel → no permission restrictions

    participant = await db.execute(
        select(ChatParticipant)
        .where(
            ChatParticipant.chat_id == chat_id,
            ChatParticipant.user_id == user_id
        )
    )
    participant = participant.scalar_one_or_none()
    if not participant:
        raise HTTPException(status_code=403, detail="You are not a member of this channel")

    # If participant has no role, assume no permissions
    if not participant.role_id:
        raise HTTPException(status_code=403, detail="You have no role in this channel")

    role = await db.get(Role, participant.role_id)
    if not role:
        raise HTTPException(status_code=403, detail="Invalid role")

    if required_permission in role.permissions:
        return True

    raise HTTPException(
        status_code=403,
        detail=f"Missing permission: {required_permission}"
    )

# ---- Router ----
router = APIRouter(prefix="/chat", tags=["Chat"])

# ---------- Existing endpoints ----------
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
    
    participants_result = await db.execute(
        select(User).join(ChatParticipant, User.id == ChatParticipant.user_id)
        .where(ChatParticipant.chat_id == chat.id, User.id != current_user.id)
    )
    other_user = participants_result.scalar_one()
    
    return {
        "id": chat.id,
        "chat_type": chat.chat_type.value,
        "created_at": chat.created_at,
        "other_user": other_user
    }

@router.get("/", response_model=List[ChatOut])
async def get_user_chats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
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
        if chat.chat_type == ChatType.DM:
            other_user = None
            for participant in chat.participants:
                if participant.user_id != current_user.id:
                    other_user = participant.user
                    break
            if other_user is None:
                continue
            response_data.append({
                "id": chat.id,
                "chat_type": chat.chat_type.value,
                "created_at": chat.created_at,
                "other_user": other_user,
                "name": None,
                "profile_photo_url": None,
                "members_count": None,
            })
        elif chat.chat_type == ChatType.CHANNEL:
            response_data.append({
                "id": chat.id,
                "chat_type": chat.chat_type.value,
                "created_at": chat.created_at,
                "other_user": None,
                "name": chat.name,
                "profile_photo_url": chat.profile_photo_url,
                "members_count": len(chat.participants),
                "is_public": chat.is_public,
                "rules": chat.rules,
            })
        else:  # GROUP
            response_data.append({
                "id": chat.id,
                "chat_type": chat.chat_type.value,
                "created_at": chat.created_at,
                "other_user": None,
                "name": chat.name,
                "profile_photo_url": chat.profile_photo_url,
                "members_count": len(chat.participants),
            })
    return response_data

# ---------- Message endpoints with permission checks ----------
@router.post("/{chat_id}/messages", response_model=MessageOut)
async def send_text_message(
    chat_id: int,
    message_data: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    participant = await db.execute(
        select(ChatParticipant).where(
            ChatParticipant.chat_id == chat_id,
            ChatParticipant.user_id == current_user.id
        )
    )
    if not participant.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not a member of this chat")

    chat = await db.get(Chat, chat_id)
    if chat.chat_type == ChatType.CHANNEL:
        await check_permission(db, current_user.id, chat_id, "send_messages")

    is_scheduled = message_data.scheduled_at is not None
    if is_scheduled:
        target_time = message_data.scheduled_at
        if target_time.tzinfo is None:
            target_time = target_time.replace(tzinfo=timezone.utc)
        if target_time <= datetime.now(timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The scheduled time must be in the future."
            )
    
    is_sent = not is_scheduled
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

    if not is_scheduled:
        members = await db.execute(select(ChatParticipant.user_id).where(ChatParticipant.chat_id == chat_id))
        member_ids = [row[0] for row in members.all()]
        message_json = json.dumps({
            "event": "new_message",
            "message_id": new_message.id,                          # 👈 added
            "chat_id": chat_id,
            "sender_id": current_user.id,
            "sender_name": current_user.name,
            "content": new_message.content,
            "created_at": new_message.created_at.isoformat(),
            "scheduled_at": new_message.scheduled_at.isoformat() if new_message.scheduled_at else None,   # 👈 added
            "is_sent": new_message.is_sent,                        # 👈 added
        })
        await manager.broadcast_to_chat(chat_id, member_ids, message_json)
    
    return MessageOut(
        id=new_message.id,
        chat_id=new_message.chat_id,
        sender_id=new_message.sender_id,
        sender_name=current_user.name,
        content=new_message.content,
        message_type=new_message.message_type.value,
        created_at=new_message.created_at,
        is_deleted=new_message.is_deleted,
        media_url=None,
        scheduled_at=new_message.scheduled_at,
        is_sent=new_message.is_sent
    )

@router.post("/{chat_id}/messages/media", response_model=MessageOut)
@router.post("/{chat_id}/messages/media", response_model=MessageOut)
async def send_media_message(
    chat_id: int,
    text_content: Optional[str] = Form(None),
    scheduled_at: Optional[datetime] = Form(None),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    participant = await db.execute(
        select(ChatParticipant).where(
            ChatParticipant.chat_id == chat_id,
            ChatParticipant.user_id == current_user.id
        )
    )
    if not participant.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not a member of this chat")

    chat = await db.get(Chat, chat_id)
    if chat.chat_type == ChatType.CHANNEL:
        await check_permission(db, current_user.id, chat_id, "upload_media")

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
    file_path, file_size = await save_upload_file(file)
    
    mime_type = file.content_type or "application/octet-stream"
    if mime_type.startswith("image/"):
        media_type_enum = MediaType.IMAGE
    elif mime_type.startswith("video/"):
        media_type_enum = MediaType.VIDEO
    elif mime_type.startswith("audio/"):
        media_type_enum = MediaType.AUDIO
    else:
        media_type_enum = MediaType.FILE

    new_message = Message(
        chat_id=chat_id,
        sender_id=current_user.id,
        message_type=MessageType.MEDIA,
        content=text_content,
        scheduled_at=scheduled_at,
        is_sent=is_sent
    )
    db.add(new_message)
    await db.flush()

    new_media = Media(
        message_id=new_message.id,
        filename=file.filename,
        file_path=file_path,
        file_size=file_size,
        mime_type=mime_type,
        media_type=media_type_enum
    )
    db.add(new_media)
    await db.commit()
    await db.refresh(new_message)

    if not is_scheduled:
        members = await db.execute(select(ChatParticipant.user_id).where(ChatParticipant.chat_id == chat_id))
        member_ids = [row[0] for row in members.all()]
        message_json = json.dumps({
            "event": "new_message",
            "message_id": new_message.id,
            "chat_id": chat_id,
            "sender_id": current_user.id,
            "sender_name": current_user.name,
            "content": text_content,
            "media_url": file_path,
            "message_type": "media",
            "created_at": new_message.created_at.isoformat(),
            "scheduled_at": new_message.scheduled_at.isoformat() if new_message.scheduled_at else None,   # 👈 added
            "is_sent": new_message.is_sent,                                                              # 👈 added
        })
        print(f"📡 Broadcasting media to chat {chat_id}, members: {member_ids}")
        await manager.broadcast_to_chat(chat_id, member_ids, message_json)

    return MessageOut(
        id=new_message.id,
        chat_id=new_message.chat_id,
        sender_id=new_message.sender_id,
        sender_name=current_user.name,
        content=new_message.content,
        message_type=new_message.message_type.value,
        created_at=new_message.created_at,
        is_deleted=new_message.is_deleted,
        media_url=file_path,
        scheduled_at=new_message.scheduled_at,
        is_sent=new_message.is_sent
    )

@router.get("/{chat_id}/messages", response_model=List[MessageOut])
async def get_chat_history(
    chat_id: int,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    participant = await db.execute(
        select(ChatParticipant).where(
            ChatParticipant.chat_id == chat_id,
            ChatParticipant.user_id == current_user.id
        )
    )
    if not participant.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not a member of this chat")

    result = await db.execute(
        select(Message)
        .options(
            joinedload(Message.sender),   # 👈 load sender user
            selectinload(Message.media)
        )
        .where(
            Message.chat_id == chat_id,
            Message.is_deleted == False,
            or_(
                Message.is_sent == True,
                Message.sender_id == current_user.id
            )
        )
        .order_by(desc(Message.created_at))
        .limit(limit)
    )

    messages = result.unique().scalars().all()
    msgOuts: List[MessageOut] = []
    for message in messages:
        msgOut = MessageOut(
            id=message.id,
            chat_id=message.chat_id,
            sender_id=message.sender_id,
            sender_name=message.sender.name if message.sender else None,   # 👈 add this
            content=message.content,
            message_type=message.message_type.value,
            created_at=message.created_at,
            is_deleted=message.is_deleted,
            media_url=message.media.file_path if message.media else None,
            scheduled_at=message.scheduled_at,
            is_sent=message.is_sent
        )
        msgOuts.append(msgOut)

    return list(reversed(msgOuts))

async def can_delete_message(user: User, message: Message, db: AsyncSession) -> bool:
    if message.sender_id == user.id:
        return True
    return False

@router.patch("/{chat_id}/messages/{message_id}", response_model=MessageOut)
async def edit_message(
    chat_id: int,
    message_id: int,
    update_data: MessageUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
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

    chat = await db.get(Chat, chat_id)
    if chat.chat_type == ChatType.CHANNEL:
        if message.sender_id != current_user.id:
            await check_permission(db, current_user.id, chat_id, "edit_messages")

    message.content = update_data.content
    db.add(message)
    await db.commit()
    await db.refresh(message)

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

@router.delete("/{chat_id}/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_message(
    chat_id: int,
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    message = await db.get(Message, message_id)
    if not message:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    if message.chat_id != chat_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message does not belong to this chat")

    has_permission = await can_delete_message(current_user, message, db)
    if not has_permission:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You don't have permission to delete this message")

    chat = await db.get(Chat, chat_id)
    if chat.chat_type == ChatType.CHANNEL:
        if message.sender_id != current_user.id:
            await check_permission(db, current_user.id, chat_id, "delete_messages")

    message.is_deleted = True
    db.add(message)
    await db.commit()

    members = await db.execute(select(ChatParticipant.user_id).where(ChatParticipant.chat_id == chat_id))
    member_ids = [row[0] for row in members.all()]
    delete_event = json.dumps({
        "event": "message_deleted",
        "chat_id": chat_id,
        "message_id": message.id
    })
    await manager.broadcast_to_chat(chat_id, member_ids, delete_event)

@router.get("/{chat_id}/messages/search", response_model=List[MessageOut])
async def search_messages_in_chat(
    chat_id: int,
    q: str,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
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

    if not q or len(q.strip()) == 0:
        return []

    stmt = (
        select(Message)
        .options(
            joinedload(Message.sender),
            selectinload(Message.media)
        )
        .where(
            and_(
                Message.chat_id == chat_id,
                Message.is_deleted == False,
                Message.is_sent == True,
                Message.content.ilike(f"%{q}%")
            )
        )
        .order_by(desc(Message.created_at))
        .limit(limit)
    )
    
    result = await db.execute(stmt)
    messages = result.scalars().all()

    messages_out = [MessageOut(
        id=msg.id,
        chat_id=msg.chat_id,
        sender_id=msg.sender_id,
        sender_name=msg.sender.name if msg.sender else None,
        content=msg.content,
        message_type=msg.message_type.value,
        created_at=msg.created_at,
        is_deleted=msg.is_deleted,
        media_url=msg.media.file_path if msg.media else None,
        scheduled_at=msg.scheduled_at,
        is_sent=msg.is_sent
    ) for msg in messages]

    return messages_out

# ---------- Group endpoints (unchanged) ----------
@router.post("/group", response_model=GroupOut, status_code=status.HTTP_201_CREATED)
async def create_group(
    group_data: GroupCreateForm = Depends(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not group_data.name or not group_data.name.strip():
        raise HTTPException(status_code=400, detail="Group name is required")

    photo_url = None
    if group_data.profile_photo:
        photo_url = await save_profile_photo(group_data.profile_photo)

    new_chat = Chat(
        chat_type=ChatType.GROUP,
        name=group_data.name.strip(),
        description=group_data.description,
        profile_photo_url=photo_url,
        created_by_id=current_user.id
    )
    db.add(new_chat)
    await db.flush()

    creator_participant = ChatParticipant(chat_id=new_chat.id, user_id=current_user.id)
    db.add(creator_participant)

    members_to_add = []
    if group_data.initial_members:
        for username in group_data.initial_members:
            user = await get_user_by_username(db, username)
            if not user:
                raise HTTPException(
                    status_code=404,
                    detail=f"User with username '{username}' not found"
                )
            if user.id == current_user.id:
                continue
            if not user.allow_group_invites:
                raise HTTPException(
                    status_code=403,
                    detail=f"User '{username}' does not allow group invites"
                )
            if user.id not in [u.id for u in members_to_add]:
                members_to_add.append(user)

    for user in members_to_add:
        participant = ChatParticipant(chat_id=new_chat.id, user_id=user.id)
        db.add(participant)

    await db.commit()
    await db.refresh(new_chat)

    result = await db.execute(
        select(Chat)
        .options(selectinload(Chat.participants).selectinload(ChatParticipant.user))
        .where(Chat.id == new_chat.id)
    )
    chat_with_members = result.scalar_one()

    members_out = [
        UserPublic.model_validate(p.user) for p in chat_with_members.participants
    ]

    return GroupOut(
        id=chat_with_members.id,
        chat_type=chat_with_members.chat_type.value,
        created_at=chat_with_members.created_at,
        name=chat_with_members.name,
        description=chat_with_members.description,
        profile_photo_url=chat_with_members.profile_photo_url,
        members=members_out
    )

@router.get("/groups/{chat_id}", response_model=GroupOut)
async def get_group_info(
    chat_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Chat)
        .options(selectinload(Chat.participants).selectinload(ChatParticipant.user))
        .where(Chat.id == chat_id)
    )
    chat = result.scalar_one_or_none()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    if chat.chat_type != ChatType.GROUP:
        raise HTTPException(status_code=400, detail="This is not a group chat")

    is_member = any(p.user_id == current_user.id for p in chat.participants)
    if not is_member:
        raise HTTPException(status_code=403, detail="You are not a member of this group")

    members_out = [
        UserPublic.model_validate(p.user) for p in chat.participants
    ]

    return GroupOut(
        id=chat.id,
        chat_type=chat.chat_type.value,
        created_at=chat.created_at,
        name=chat.name,
        description=chat.description,
        profile_photo_url=chat.profile_photo_url,
        members=members_out
    )

@router.patch("/groups/{chat_id}", response_model=GroupOut)
async def update_group(
    chat_id: int,
    update_data: GroupUpdateForm = Depends(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Chat)
        .options(selectinload(Chat.participants).selectinload(ChatParticipant.user))
        .where(Chat.id == chat_id)
    )
    chat = result.scalar_one_or_none()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    if chat.chat_type != ChatType.GROUP:
        raise HTTPException(status_code=400, detail="This is not a group chat")
    
    is_member = any(p.user_id == current_user.id for p in chat.participants)
    if not is_member:
        raise HTTPException(status_code=403, detail="You are not a member of this group")
    
    if update_data.profile_photo is not None:
        if chat.profile_photo_url:
            old_file_path = chat.profile_photo_url.lstrip("/") 
            await delete_profile_photo(old_file_path)
        new_photo_url = await save_profile_photo(update_data.profile_photo)
        chat.profile_photo_url = new_photo_url
    
    if update_data.name is not None:
        if not update_data.name.strip():
            raise HTTPException(status_code=400, detail="Group name cannot be empty")
        chat.name = update_data.name.strip()
        
    if update_data.description is not None:
        chat.description = update_data.description
    
    db.add(chat)
    await db.commit()
    await db.refresh(chat)
    
    result = await db.execute(
        select(Chat)
        .options(selectinload(Chat.participants).selectinload(ChatParticipant.user))
        .where(Chat.id == chat.id)
    )
    chat_with_members = result.scalar_one()
    
    members_out = [
        UserPublic.model_validate(p.user) for p in chat_with_members.participants
    ]
    
    return GroupOut(
        id=chat_with_members.id,
        chat_type=chat_with_members.chat_type.value,
        created_at=chat_with_members.created_at,
        name=chat_with_members.name,
        description=chat_with_members.description,
        profile_photo_url=chat_with_members.profile_photo_url,
        members=members_out
    )

@router.delete("/groups/{chat_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group(
    chat_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Chat)
        .options(selectinload(Chat.participants))
        .where(Chat.id == chat_id)
    )
    chat = result.scalar_one_or_none()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    if chat.chat_type != ChatType.GROUP:
        raise HTTPException(status_code=400, detail="This is not a group chat")
    
    is_member = any(p.user_id == current_user.id for p in chat.participants)
    if not is_member:
        raise HTTPException(status_code=403, detail="You are not a member of this group")
    
    await db.delete(chat)
    await db.commit()

@router.delete("/groups/{chat_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
async def leave_group(
    chat_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    chat = await db.get(Chat, chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    if chat.chat_type != ChatType.GROUP:
        raise HTTPException(status_code=400, detail="This is not a group chat")
    
    participant = await db.execute(
        select(ChatParticipant).where(
            ChatParticipant.chat_id == chat_id,
            ChatParticipant.user_id == current_user.id
        )
    )
    participant = participant.scalar_one_or_none()
    if not participant:
        raise HTTPException(status_code=403, detail="You are not a member of this group")
    
    await db.delete(participant)
    await db.flush()
    
    should_delete_group = False
    if chat.created_by_id == current_user.id:
        should_delete_group = True
    else:
        remaining_count = await db.scalar(
            select(func.count()).select_from(ChatParticipant)
            .where(ChatParticipant.chat_id == chat_id)
        )
        if remaining_count == 0:
            should_delete_group = True
    
    if should_delete_group:
        await db.delete(chat)
        await db.commit()
    else:
        await db.commit()

@router.post("/groups/{chat_id}/members", response_model=GroupOut, status_code=status.HTTP_201_CREATED)
async def add_members_to_group(
    chat_id: int,
    request: AddMembersRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Chat)
        .options(selectinload(Chat.participants).selectinload(ChatParticipant.user))
        .where(Chat.id == chat_id)
    )
    chat = result.scalar_one_or_none()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    if chat.chat_type != ChatType.GROUP:
        raise HTTPException(status_code=400, detail="This is not a group chat")
    
    is_member = any(p.user_id == current_user.id for p in chat.participants)
    if not is_member:
        raise HTTPException(status_code=403, detail="You are not a member of this group")
    
    users_to_add = []
    for username in request.usernames:
        user = await db.execute(
            select(User).where(User.username == username)
        )
        user = user.scalar_one_or_none()
        if not user:
            raise HTTPException(
                status_code=404,
                detail=f"User with username '{username}' not found"
            )
        if user.id == current_user.id:
            continue
        if not user.allow_group_invites:
            raise HTTPException(
                status_code=403,
                detail=f"User '{username}' does not allow group invites"
            )
        already_member = any(p.user_id == user.id for p in chat.participants)
        if already_member:
            raise HTTPException(
                status_code=400,
                detail=f"User '{username}' is already a member of this group"
            )
        users_to_add.append(user)
    
    for user in users_to_add:
        new_participant = ChatParticipant(chat_id=chat.id, user_id=user.id)
        db.add(new_participant)
    
    await db.commit()
    
    result = await db.execute(
        select(Chat)
        .options(selectinload(Chat.participants).selectinload(ChatParticipant.user))
        .where(Chat.id == chat.id)
    )
    chat_with_members = result.scalar_one()
    
    members_out = [
        UserPublic.model_validate(p.user) for p in chat_with_members.participants
    ]
    
    return GroupOut(
        id=chat_with_members.id,
        chat_type=chat_with_members.chat_type.value,
        created_at=chat_with_members.created_at,
        name=chat_with_members.name,
        description=chat_with_members.description,
        profile_photo_url=chat_with_members.profile_photo_url,
        members=members_out
    )

# ---------- Channel endpoints ----------
@router.post("/channel", response_model=ChannelOut, status_code=201)
async def create_channel(
    channel_data: ChannelCreateForm = Depends(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not channel_data.name.strip():
        raise HTTPException(400, "Channel name required")

    photo_url = await save_profile_photo(channel_data.profile_photo) if channel_data.profile_photo else None
    new_chat = Chat(
        chat_type=ChatType.CHANNEL,
        name=channel_data.name.strip(),
        description=channel_data.description,
        is_public=channel_data.is_public,
        rules=channel_data.rules,
        profile_photo_url=photo_url,
        created_by_id=current_user.id
    )
    db.add(new_chat)
    await db.flush()

    # Create admin role and assign creator
    admin_role = Role(
        name="admin",
        channel_id=new_chat.id,
        permissions=DEFAULT_ROLES["admin"]
    )
    db.add(admin_role)
    await db.flush()

    creator_participant = ChatParticipant(
        chat_id=new_chat.id,
        user_id=current_user.id,
        role_id=admin_role.id
    )
    db.add(creator_participant)

    # Create member role
    member_role = Role(
        name="member",
        channel_id=new_chat.id,
        permissions=DEFAULT_ROLES["member"]
    )
    db.add(member_role)
    await db.flush()

    if channel_data.initial_members:
        for username in channel_data.initial_members:
            user = await get_user_by_username(db, username)
            if not user:
                raise HTTPException(404, f"User '{username}' not found")
            existing = await db.execute(
                select(ChatParticipant).where(
                    ChatParticipant.chat_id == new_chat.id,
                    ChatParticipant.user_id == user.id
                )
            )
            if not existing.scalar_one_or_none():
                participant = ChatParticipant(
                    chat_id=new_chat.id,
                    user_id=user.id,
                    role_id=member_role.id
                )
                db.add(participant)

    await db.commit()
    await db.refresh(new_chat)

    return await get_channel_info(db, new_chat.id, current_user)

async def get_channel_info(db: AsyncSession, channel_id: int, current_user: User):
    result = await db.execute(
        select(Chat)
        .options(
            selectinload(Chat.participants).selectinload(ChatParticipant.role),
            selectinload(Chat.participants).selectinload(ChatParticipant.user)
        )
        .where(Chat.id == channel_id, Chat.chat_type == ChatType.CHANNEL)
    )
    chat = result.scalar_one_or_none()
    if not chat:
        raise HTTPException(404, "Channel not found")

    members_out = []
    for p in chat.participants:
        role_out = RoleOut.model_validate(p.role) if p.role else None
        members_out.append(ChannelMemberOut(user=p.user, role=role_out))

    return ChannelOut(
        id=chat.id,
        chat_type="channel",
        created_at=chat.created_at,
        name=chat.name,
        description=chat.description,
        profile_photo_url=chat.profile_photo_url,
        is_public=chat.is_public,
        rules=chat.rules,
        members=members_out
    )

@router.get("/channels/{channel_id}", response_model=ChannelOut)
async def get_channel(
    channel_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return await get_channel_info(db, channel_id, current_user)

@router.patch("/channels/{channel_id}", response_model=ChannelOut)
async def update_channel(
    channel_id: int,
    update_data: ChannelUpdateForm = Depends(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await check_permission(db, current_user.id, channel_id, "manage_channel")
    chat = await db.get(Chat, channel_id)
    if not chat or chat.chat_type != ChatType.CHANNEL:
        raise HTTPException(404, "Channel not found")

    if update_data.name is not None:
        chat.name = update_data.name.strip()
    if update_data.description is not None:
        chat.description = update_data.description
    if update_data.is_public is not None:
        chat.is_public = update_data.is_public
    if update_data.rules is not None:
        chat.rules = update_data.rules
    if update_data.profile_photo:
        # Optionally delete old photo
        new_url = await save_profile_photo(update_data.profile_photo)
        chat.profile_photo_url = new_url

    await db.commit()
    await db.refresh(chat)
    return await get_channel_info(db, channel_id, current_user)

@router.delete("/channels/{channel_id}", status_code=204)
async def delete_channel(
    channel_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await check_permission(db, current_user.id, channel_id, "manage_channel")
    chat = await db.get(Chat, channel_id)
    if not chat or chat.chat_type != ChatType.CHANNEL:
        raise HTTPException(404, "Channel not found")
    await db.delete(chat)
    await db.commit()

@router.post("/channels/{channel_id}/members", response_model=ChannelOut, status_code=201)
async def add_channel_members(
    channel_id: int,
    request: AddMembersRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await check_permission(db, current_user.id, channel_id, "manage_members")
    chat = await db.get(Chat, channel_id)
    if not chat or chat.chat_type != ChatType.CHANNEL:
        raise HTTPException(404, "Channel not found")

    # Get default member role (create if missing)
    member_role = await db.execute(
        select(Role).where(Role.channel_id == channel_id, Role.name == "member")
    )
    member_role = member_role.scalar_one_or_none()
    if not member_role:
        member_role = Role(
            name="member",
            channel_id=channel_id,
            permissions=DEFAULT_ROLES["member"]
        )
        db.add(member_role)
        await db.flush()

    for username in request.usernames:
        user = await get_user_by_username(db, username)
        if not user:
            raise HTTPException(404, f"User '{username}' not found")
        existing = await db.execute(
            select(ChatParticipant).where(
                ChatParticipant.chat_id == channel_id,
                ChatParticipant.user_id == user.id
            )
        )
        if not existing.scalar_one_or_none():
            participant = ChatParticipant(
                chat_id=channel_id,
                user_id=user.id,
                role_id=member_role.id
            )
            db.add(participant)

    await db.commit()
    return await get_channel_info(db, channel_id, current_user)

@router.delete("/channels/{channel_id}/members/{user_id}", status_code=204)
async def remove_channel_member(
    channel_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await check_permission(db, current_user.id, channel_id, "manage_members")
    participant = await db.execute(
        select(ChatParticipant).where(
            ChatParticipant.chat_id == channel_id,
            ChatParticipant.user_id == user_id
        )
    )
    participant = participant.scalar_one_or_none()
    if not participant:
        raise HTTPException(404, "User not a member")
    await db.delete(participant)
    await db.commit()

@router.patch("/channels/{channel_id}/members/{user_id}/role")
async def update_member_role(
    channel_id: int,
    user_id: int,
    role_name: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await check_permission(db, current_user.id, channel_id, "manage_members")
    participant = await db.execute(
        select(ChatParticipant).where(
            ChatParticipant.chat_id == channel_id,
            ChatParticipant.user_id == user_id
        )
    )
    participant = participant.scalar_one_or_none()
    if not participant:
        raise HTTPException(404, "User not a member")

    role = await db.execute(
        select(Role).where(Role.channel_id == channel_id, Role.name == role_name)
    )
    role = role.scalar_one_or_none()
    if not role:
        raise HTTPException(404, f"Role '{role_name}' not found")

    participant.role_id = role.id
    await db.commit()
    return {"message": "Role updated"}

@router.post("/channels/{channel_id}/roles", response_model=RoleOut, status_code=201)
async def create_channel_role(
    channel_id: int,
    role_data: RoleCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Check manage_channel permission (admin only)
    await check_permission(db, current_user.id, channel_id, "manage_channel")
    
    # Verify channel exists and is a channel
    chat = await db.get(Chat, channel_id)
    if not chat or chat.chat_type != ChatType.CHANNEL:
        raise HTTPException(404, "Channel not found")
    
    # Check if a role with the same name already exists in this channel
    existing = await db.execute(
        select(Role).where(
            Role.channel_id == channel_id,
            Role.name == role_data.name
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, f"Role '{role_data.name}' already exists in this channel")
    
    # Create the role
    new_role = Role(
        name=role_data.name,
        channel_id=channel_id,
        permissions=role_data.permissions
    )
    db.add(new_role)
    await db.commit()
    await db.refresh(new_role)
    return new_role

@router.get("/channels/{channel_id}/roles", response_model=List[RoleOut])
async def get_channel_roles(
    channel_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Check membership
    chat = await db.get(Chat, channel_id)
    if not chat or chat.chat_type != ChatType.CHANNEL:
        raise HTTPException(404, "Channel not found")
    is_member = await db.execute(
        select(ChatParticipant).where(
            ChatParticipant.chat_id == channel_id,
            ChatParticipant.user_id == current_user.id
        )
    )
    if not is_member.scalar_one_or_none():
        raise HTTPException(403, "You are not a member of this channel")
    roles = await db.execute(
        select(Role).where(Role.channel_id == channel_id)
    )
    return roles.scalars().all()