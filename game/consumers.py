# game/consumers.py
import json
from channels.generic.websocket import AsyncJsonWebsocketConsumer, AsyncWebsocketConsumer
from channels.db            import database_sync_to_async
from rest_framework.test    import APIRequestFactory
from game.models            import Match
from django.test            import RequestFactory
from game.views.api import (
    make_move       as _make_move_api,
    get_match_state as _get_state_api,
    battle_bot      as _battle_bot_api    # if you ever want to proxy bot‐moves over WS too
)
from asgiref.sync           import sync_to_async, async_to_sync
from channels.layers import get_channel_layer


def on_player_joined(match):
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        "match_list",
        {
            "type": "match_joined",
            "data": {
                "match_id": match.id,
                "player_two": match.player_two.user.username,
            }
        }
    )
    
class MatchListConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        if self.scope["user"].is_anonymous:
            return await self.close()
        await self.channel_layer.group_add("match_list", self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard("match_list", self.channel_name)

    async def match_created(self, event):
        # broadcast when a new match is made
        await self.send_json({
            "event": "match_created",
            "data": event["data"],
        })

    async def match_joined(self, event):
        # broadcast when someone joins
        await self.send_json({
            "event": "match_joined",
            "data": event["data"],
        })



class MatchConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.match_id   = self.scope["url_route"]["kwargs"]["match_id"]
        self.group_name = f"match_{self.match_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        try:
            state = await self._get_full_state()
            await self.send(text_data=json.dumps(state))
        except Exception as e:
            # this will show up in your Daphne console
            import traceback; traceback.print_exc()
            # and close the socket immediately
        
            # use a valid close code (1000 = normal; 3000–4999 = app-specific)
            await self.close(code=3001)


    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        data = json.loads(text_data)
        if data.get("type") == "move":
            # 3) Call your DRF make_move, which handles human+bot
            result = await self._call_make_move(data["payload"])

            # 4) Broadcast that result to the entire room
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type":    "broadcast_move",
                    "payload": result,
                }
            )

    # 5) Handler for the "broadcast_move" event:
    async def broadcast_move(self, event):
        await self.send(text_data=json.dumps(event["payload"]))

    async def state_update(self, event):
        # called by group_send with type="state_update"
        await self.send(text_data=json.dumps(event["data"]))

    async def match_move(self, event):
        # Send the move‐response JSON back down the websocket
        await self.send(text_data=json.dumps(event["data"]))


    #
    # — Helpers to call your DRF views in a sync context —
    #
    @database_sync_to_async
    def _get_full_state(self):
        """
        Wraps your DRF `get_match_state` view.
        """
        factory = APIRequestFactory()
        request = factory.get(f"/game/api/match/{self.match_id}/state/")
        # Attach the real user so permissions pass
        request.user = self.scope["user"]
        return _get_state_api(request, match_id=self.match_id).data

    def _dummy_request(self, data):
        """
        Build a minimal fake `request` for DRF make_move.
        """
        factory = APIRequestFactory()
        req = factory.post("/game/api/move/", data, format="json")
        req.user = self.scope["user"]
        return req

    @database_sync_to_async
    def _call_make_move(self, payload):
        """
        Wraps your DRF `make_move` view.
        """
        return _make_move_api(self._dummy_request(payload)).data