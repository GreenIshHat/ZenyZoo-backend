import json
from channels.generic.websocket import AsyncWebsocketConsumer

class GlobalChatConsumer(AsyncWebsocketConsumer):
    group_name = "global_chat"

    async def connect(self):
        user = self.scope["user"]
        # Join the group
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # Broadcast join notice
        if user.is_authenticated:
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "chat_event",
                    "event": "join",
                    "username": user.username,
                }
            )

    async def disconnect(self, close_code):
        user = self.scope["user"]
        # Leave the group
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

        # Broadcast leave notice
        if user.is_authenticated:
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "chat_event",
                    "event": "leave",
                    "username": user.username,
                }
            )

    async def receive(self, text_data):
        data = json.loads(text_data)
        message = data.get("message", "")
        user = self.scope["user"]
        username = user.username if user.is_authenticated else "Anon"

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "chat_message",
                "event": "message",
                "message": message,
                "username": username,
            }
        )

    async def chat_message(self, event):
        # Standard chat message
        await self.send(text_data=json.dumps({
            "event": event["event"],      # "message"
            "username": event["username"],
            "message": event["message"],
        }))

    async def chat_event(self, event):
        # Join/leave notifications
        await self.send(text_data=json.dumps({
            "event": event["event"],      # "join" or "leave"
            "username": event["username"],
        }))
