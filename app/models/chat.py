from sqlalchemy import Column, Integer, ForeignKey, DateTime, Enum, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.session import Base
import enum

# تعریف نوع چت (فعلاً فقط DM، بعداً GROUP و CHANNEL اضافه می‌شود)
class ChatType(str, enum.Enum):
    DM = "dm"

class Chat(Base):
    __tablename__ = "chats"

    id = Column(Integer, primary_key=True, index=True)
    chat_type = Column(Enum(ChatType), nullable=False, default=ChatType.DM)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # روابط
    participants = relationship("ChatParticipant", back_populates="chat", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="chat", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Chat {self.id} ({self.chat_type})>"

class ChatParticipant(Base):
    __tablename__ = "chat_participants"

    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(Integer, ForeignKey("chats.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    joined_at = Column(DateTime(timezone=True), server_default=func.now())

    # جلوگیری از عضویت تکراری در یک چت
    __table_args__ = (UniqueConstraint('chat_id', 'user_id', name='unique_chat_user'),)

    # روابط
    chat = relationship("Chat", back_populates="participants")
    user = relationship("User", back_populates="chats") # در مدل User هم باید اضافه شود

    def __repr__(self):
        return f"<ChatParticipant chat={self.chat_id} user={self.user_id}>"