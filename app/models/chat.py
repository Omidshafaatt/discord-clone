from sqlalchemy import Column, Integer, ForeignKey, DateTime, Enum, String, UniqueConstraint, Boolean, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.session import Base
import enum

# تعریف نوع چت
class ChatType(str, enum.Enum):
    DM = "dm"
    GROUP = "group"
    CHANNEL = "channel"

class Chat(Base):
    __tablename__ = "chats"

    id = Column(Integer, primary_key=True, index=True)
    chat_type = Column(Enum(ChatType), nullable=False, default=ChatType.DM)

    # فیلدهای گروه و کانال
    name = Column(String(100), nullable=True)
    description = Column(String(500), nullable=True)
    profile_photo_url = Column(String(255), nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # فیلدهای مخصوص کانال
    is_public = Column(Boolean, default=True)
    rules = Column(String(1000), nullable=True)

    # روابط
    participants = relationship("ChatParticipant", back_populates="chat", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="chat", cascade="all, delete-orphan")
    created_by = relationship("User", foreign_keys=[created_by_id])
    roles = relationship("Role", back_populates="channel", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Chat {self.id} ({self.chat_type})>"

class ChatParticipant(Base):
    __tablename__ = "chat_participants"

    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(Integer, ForeignKey("chats.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    joined_at = Column(DateTime(timezone=True), server_default=func.now())
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="SET NULL"), nullable=True)

    __table_args__ = (UniqueConstraint('chat_id', 'user_id', name='unique_chat_user'),)

    chat = relationship("Chat", back_populates="participants")
    user = relationship("User", back_populates="chats")
    role = relationship("Role", back_populates="participants")

    def __repr__(self):
        return f"<ChatParticipant chat={self.chat_id} user={self.user_id}>"

class Role(Base):
    __tablename__ = "roles"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False)   # "admin", "moderator", "member"
    channel_id = Column(Integer, ForeignKey("chats.id", ondelete="CASCADE"), nullable=False)
    permissions = Column(JSON, default=list)    # list of permission strings

    channel = relationship("Chat", back_populates="roles")
    participants = relationship("ChatParticipant", back_populates="role")