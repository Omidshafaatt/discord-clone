import os
import uuid
import aiofiles
from fastapi import UploadFile, HTTPException, status
from app.core.config import settings

UPLOAD_DIR = settings.UPLOAD_DIR
PROFILE_DIR = settings.PROFILE_DIR
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(PROFILE_DIR, exist_ok=True)

async def save_upload_file(upload_file: UploadFile) -> str:
    # تولید یک نام یکتا برای فایل (برای جلوگیری از تداخل نام)
    file_extension = os.path.splitext(upload_file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    # ذخیره فایل به صورت Async
    async with aiofiles.open(file_path, 'wb') as out_file:
        content = await upload_file.read()
        file_size = len(content)
        await out_file.write(content)
    
    # برگرداندن آدرس نسبی فایل (که بعداً در Media ذخیره می‌شود)
    return file_path, file_size


async def save_profile_photo(upload_file: UploadFile) -> str:
    # ۱. بررسی نوع محتوا (MIME Type)
    # مطمئن می‌شویم که فایل با "image/" شروع می‌شود
    if not upload_file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file must be an image."
        )

    # ۲. بررسی پسوند فایل
    # فقط اجازه آپلود این فرمت‌ها را می‌دهیم
    allowed_extensions = {"jpg", "jpeg", "png", "webp"}
    file_extension = upload_file.filename.split(".")[-1].lower()
    
    if file_extension not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File format .{file_extension} is not supported. Supported formats: {', '.join(allowed_extensions)}"
        )

    # ۳. تولید نام یکتا برای فایل و مسیر ذخیره‌سازی
    
    unique_filename = f"{uuid.uuid4()}.{file_extension}"
    file_path = os.path.join(PROFILE_DIR, unique_filename)
    
    # ۴. ذخیره فایل به صورت غیرهمزمان و تکه‌تکه
    # این روش از پر شدن RAM سرور در زمان آپلود عکس‌های سنگین جلوگیری می‌کند
    try:
        with open(file_path, "wb") as buffer:
            while chunk := await upload_file.read(1024 * 1024):  # خواندن ۱ مگابایت در هر مرحله
                buffer.write(chunk)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while saving the file."
        )
    finally:
        # همیشه در پایان، فایل موقت در حافظه را می‌بندیم
        await upload_file.close()
        
    # ۵. تولید آدرس برای دیتابیس
    # نکته: همیشه از "/" برای آدرس‌های وب استفاده کنید، os.path.join در ویندوز ممکن است "\" تولید کند
    photo_url = f"{PROFILE_DIR}/{unique_filename}"
    
    return photo_url

async def delete_profile_photo(file_path: str):
    if os.path.exists(file_path):
        os.remove(file_path)