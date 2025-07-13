# game/events.py 
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

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



def broadcast_match_created(match):
    async_to_sync(get_channel_layer().group_send)(
        "match_list",
        {
            "type": "match_created",
            "data": {"id": match.id, "player_one": match.player_one.user.username}
        }
    )

def broadcast_match_joined(match):
    async_to_sync(get_channel_layer().group_send)(
        "match_list",
        {
            "type": "match_joined",
            "data": {
                "match_id":   match.id,
                "player_two": match.player_two.user.username
            }
        }
    )
