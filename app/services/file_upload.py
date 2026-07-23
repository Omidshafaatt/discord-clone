import os
import uuid
import aiofiles
from fastapi import UploadFile
from app.core.config import settings

UPLOAD_DIR = settings.UPLOAD_DIR
os.makedirs(UPLOAD_DIR, exist_ok=True)

async def save_upload_file(upload_file: UploadFile) -> str:
    # تولید یک نام یکتا برای فایل (برای جلوگیری از تداخل نام)
    file_extension = os.path.splitext(upload_file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    # ذخیره فایل به صورت Async
    async with aiofiles.open(file_path, 'wb') as out_file:
        content = await upload_file.read()
        await out_file.write(content)
    
    # برگرداندن آدرس نسبی فایل (که بعداً در Media ذخیره می‌شود)
    return file_path