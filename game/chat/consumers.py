# game/chat/consumers.py
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from game.models import Match, MatchMove
import json



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



@database_sync_to_async
def get_player_ids(match_id):
    match = Match.objects.values('player_one__user_id', 'player_two__user_id').get(id=match_id)
    return match['player_one__user_id'], match['player_two__user_id']

class MatchChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.match_id = self.scope['url_route']['kwargs']['match_id']
        self.group_name = f"match_chat_{self.match_id}"
        self.user = self.scope["user"]

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # Check if the user is a player or spectator
        is_player = False
        if self.user.is_authenticated:
            p1_id, p2_id = await get_player_ids(self.match_id)
            is_player = (
                p1_id == self.user.id or
                (p2_id and p2_id == self.user.id)
            )

        username = self.user.username if self.user.is_authenticated else "Anon"
        if not is_player:
            username = "[Spectator] " + username

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "chat_event",
                "event": "join",
                "username": username,
            }
        )

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)
        # Announce leave if you want
        is_player = False
        if self.user.is_authenticated:
            p1_id, p2_id = await get_player_ids(self.match_id)
            is_player = (
                p1_id == self.user.id or
                (p2_id and p2_id == self.user.id)
            )

        username = self.user.username if self.user.is_authenticated else "Anon"
        if not is_player:
            username = "[Spectator] " + username

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "chat_event",
                "event": "leave",
                "username": username,
            }
        )


    async def receive(self, text_data):
        data = json.loads(text_data)
        message = data.get("message", "")
        user = self.scope["user"]

        # Check if the user is a player or spectator
        is_player = False
        if self.user.is_authenticated:
            p1_id, p2_id = await get_player_ids(self.match_id)
            is_player = (
                p1_id == self.user.id or
                (p2_id and p2_id == self.user.id)
            )

        username = self.user.username if self.user.is_authenticated else "Anon"
        if not is_player:
            username = "[Spectator] " + username           

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
        await self.send(text_data=json.dumps({
            "event": event["event"],
            "username": event["username"],
            "message": event["message"],
        }))

    async def chat_event(self, event):
        await self.send(text_data=json.dumps({
            "event": event["event"],
            "username": event["username"],
        }))