PERMISSIONS = {
    "send_messages": "send_messages",
    "upload_media": "upload_media",
    "edit_messages": "edit_messages",
    "delete_messages": "delete_messages",
    "manage_members": "manage_members",
    "manage_channel": "manage_channel",
}

DEFAULT_ROLES = {
    "admin": ["send_messages", "upload_media", "edit_messages", "delete_messages", "manage_members", "manage_channel"],
    "moderator": ["send_messages", "upload_media", "edit_messages", "delete_messages"],
    "member": ["send_messages", "upload_media"],
}