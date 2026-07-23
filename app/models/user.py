from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from app.db.session import Base
from sqlalchemy.orm import relationship

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    
    # الزامات اصلی ثبت‌نام: شماره تلفن یکتا و نام اجباری
    phone_number = Column(String(20), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    
    # رمز عبور هش شده (هرگز رمز ساده را ذخیره نکنید!)
    hashed_password = Column(String(255), nullable=False)
    
    # ویژگی‌های اختیاری برای پروفایل عمومی
    username = Column(String(50), unique=True, nullable=True, index=True)
    profile_photo_url = Column(String(255), nullable=True) # آدرس عکس پروفایل
    bio = Column(String(500), nullable=True) # بیوگرافی
    
    # زمان‌های ایجاد و آخرین ویرایش (برای مدیریت بهتر و گزارش‌دهی)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    chats = relationship("ChatParticipant", back_populates="user", cascade="all, delete-orphan")
    sent_messages = relationship("Message", back_populates="sender", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User {self.phone_number}>"