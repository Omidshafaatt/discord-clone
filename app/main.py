from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
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

from app.core.scheduler import scheduler, check_and_send_scheduled_messages
from contextlib import asynccontextmanager
from apscheduler.triggers.interval import IntervalTrigger
# مدیریت متمرکز چرخه حیات سرور
@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- در زمان روشن شدن سرور (Startup) ---
    print("Server is starting up...")
    
    # 1. ساخت جداول دیتابیس
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # 2. تنظیم جاب (Job) و شروع Scheduler
    scheduler.add_job(
        check_and_send_scheduled_messages,
        trigger=IntervalTrigger(seconds=10),
        id="send_scheduled_messages_job",
        replace_existing=True 
    )
    scheduler.start()
    print("Scheduler started successfully.")
    
    yield # در این نقطه سرور ترافیک را دریافت می‌کند
    
    # --- در زمان خاموش شدن سرور (Shutdown) ---
    print("Server is shutting down...")
    
    # 3. توقف ایمن Scheduler و قطع اتصالات دیتابیس
    scheduler.shutdown()
    await engine.dispose()
    print("Resources cleaned up.")


# پاس دادن lifespan به FastAPI
app = FastAPI(title="Messaging Service", version="1.0.0", lifespan=lifespan)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

# ثبت روترهای API
app.include_router(auth.router)
app.include_router(profile.router)
app.include_router(chat.router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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