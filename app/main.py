from fastapi import FastAPI, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import AsyncSessionLocal, engine, get_db, Base
from app.core.config import settings
from sqlalchemy.sql import text


from fastapi.security import OAuth2PasswordBearer
from app.api.v1.endpoints import auth, chat, profile


from fastapi import WebSocket, WebSocketDisconnect, Depends, Query
from jose import jwt, JWTError
from app.core.security import SECRET_KEY, ALGORITHM
from app.managers.websocket_manager import manager
from app.services.auth import get_user_by_phone


app = FastAPI(title="Messaging Service", version="1.0.0")

# یک مسیر ساده برای تست اتصال دیتابیس
# @app.get("/healthcheck")
# async def healthcheck(db: AsyncSession = Depends(get_db)):
#     # اینجا یک کوئری ساده به دیتابیس می‌زنیم
#     # (مثلاً "SELECT 1") تا مطمئن شویم اتصال برقرار است
#     result = await db.execute(text("SELECT 1"))
#     return {"status": "connected", "db_test": result.scalar_one_or_none()}

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login") # برای دریافت توکن از هدر Authorization

# ثبت روترهای API
app.include_router(auth.router)
app.include_router(profile.router)
app.include_router(chat.router)

@app.on_event("startup")
async def startup_event():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Server is starting up...")

@app.on_event("shutdown")
async def shutdown_event():
    await engine.dispose()



@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...) # توکن را از Query string می‌خوانیم
):
    try:
        # 1. بررسی اعتبار توکن
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        phone_number: str = payload.get("sub")
        if not phone_number:
            await websocket.close(code=1008)
            return
        
        # 2. پیدا کردن کاربر در دیتابیس
        async with AsyncSessionLocal() as db:
            user = await get_user_by_phone(db, phone_number)
            if not user:
                await websocket.close(code=1008)
                return
            
            # 3. ثبت اتصال در منیجر
            await manager.connect(user.id, websocket)
            print(f"User {user.id} connected via WebSocket.")
            
            try:
                # 4. حلقه نگهداری اتصال (در اینجا فقط منتظر می‌مانیم تا پیام‌های پخش شده به کاربر برسند)
                while True:
                    # اگر کلاینت پیامی بفرستد (مثلاً Ping)، آن را دریافت می‌کنیم
                    data = await websocket.receive_text()
                    # فعلاً کاری با پیام‌های دریافتی نمی‌کنیم (چون ارسال پیام از طریق HTTP است)
                    # می‌توانیم یک Ping/Pong مدیریت کنیم
            except WebSocketDisconnect:
                # 5. حذف اتصال در زمان قطع شدن
                manager.disconnect(user.id, websocket)
                print(f"User {user.id} disconnected.")
                
    except JWTError:
        await websocket.close(code=1008)