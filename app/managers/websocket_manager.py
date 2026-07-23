from typing import Dict, List
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # دیکشنری برای ذخیره کاربران متصل: {user_id: [list_of_websockets]}
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)

    def disconnect(self, user_id: int, websocket: WebSocket):
        if user_id in self.active_connections:
            self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def send_personal_message(self, message: str, user_id: int):
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_text(message)
                except Exception:
                    pass # اگر کاربر قطع شده باشد، ارسال نادیده گرفته می‌شود

    async def broadcast_to_chat(self, chat_id: int, participant_user_ids: List[int], message_data: dict):
        # برای همه کاربرانی که عضو این چت هستند، پیام را ارسال کن
        for user_id in participant_user_ids:
            await self.send_personal_message(message_data, user_id)

# نمونه گلوبال از منیجر
manager = ConnectionManager()