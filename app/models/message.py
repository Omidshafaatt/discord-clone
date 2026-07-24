from sqlalchemy import Column, Integer, String, DateTime, Enum, ForeignKey, Boolean, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.session import Base
import enum

class MessageType(str, enum.Enum):
    TEXT = "text"
    MEDIA = "media"

class MediaType(str, enum.Enum):
    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"
    FILE = "file"

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(Integer, ForeignKey("chats.id", ondelete="CASCADE"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True) # اگر کاربر حذف شود، پیام می‌ماند
    message_type = Column(Enum(MessageType), nullable=False, default=MessageType.TEXT)
    
    # متن پیام (اگر نوع MEDIA باشد، محتوای آن می‌تواند null باشد یا کپشن عکس)
    content = Column(Text, nullable=True) 
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_deleted = Column(Boolean, default=False) # برای حذف نرم پیام

    # فیلدهای جدید برای پیام زمان‌دار
    scheduled_at = Column(DateTime(timezone=True), nullable=True) 
    is_sent = Column(Boolean, default=True) # پیش‌فرض True است، یعنی پیام‌های عادی فورا ارسال می‌شوند

    # روابط
    sender = relationship("User", back_populates="sent_messages") # در مدل User اضافه شود
    chat = relationship("Chat", back_populates="messages")
    media = relationship("Media", back_populates="message", uselist=False, cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Message {self.id} ({self.message_type})>"

class Media(Base):
    __tablename__ = "media"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("messages.id", ondelete="CASCADE"), unique=True, nullable=False)
    
    filename = Column(String(255), nullable=False)
    file_path = Column(String(512), nullable=False) # مسیر فایل روی دیسک سیستم (مثلاً uploads/uuid.jpg)
    file_size = Column(Integer, nullable=True) # حجم فایل به بایت
    mime_type = Column(String(100), nullable=True)
    media_type = Column(Enum(MediaType), nullable=False)
    
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    # روابط
    message = relationship("Message", back_populates="media")

    def __repr__(self):
        return f"<Media {self.id} ({self.filename})>"