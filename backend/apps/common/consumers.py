import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from rest_framework.authtoken.models import Token
from django.contrib.auth.models import AnonymousUser

class UpdatesConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Extract token from query parameters
        query_string = self.scope.get("query_string", b"").decode("utf-8")
        params = dict(x.split("=") for x in query_string.split("&") if "=" in x)
        token_key = params.get("token")

        self.user = await self.get_user_from_token(token_key)
        
        if self.user is None or self.user.is_anonymous:
            # Reject connection if unauthorized
            await self.close()
        else:
            await self.accept()

            # Join private user notifications group
            self.user_group = f"user_{self.user.user_id}"
            await self.channel_layer.group_add(self.user_group, self.channel_name)

            # Join general tickets update group
            self.tickets_group = "tickets_updates"
            await self.channel_layer.group_add(self.tickets_group, self.channel_name)

            # Track chat groups this client has joined
            self.joined_chat_groups = set()

    async def disconnect(self, close_code):
        if hasattr(self, 'user_group'):
            await self.channel_layer.group_discard(self.user_group, self.channel_name)
        if hasattr(self, 'tickets_group'):
            await self.channel_layer.group_discard(self.tickets_group, self.channel_name)
        
        # Discard all joined chat groups
        if hasattr(self, 'joined_chat_groups'):
            for group in self.joined_chat_groups:
                await self.channel_layer.group_discard(group, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            action = data.get("action")
            
            if action == "join_chat":
                ticket_id = data.get("ticket_id")
                if ticket_id:
                    # Validate access permission for this ticket
                    has_access = await self.check_ticket_access(ticket_id)
                    if has_access:
                        chat_group = f"chat_ticket_{ticket_id}"
                        await self.channel_layer.group_add(chat_group, self.channel_name)
                        self.joined_chat_groups.add(chat_group)
                        await self.send(json.dumps({
                            "type": "chat_joined",
                            "ticket_id": ticket_id,
                            "success": True
                        }))
                    else:
                        await self.send(json.dumps({
                            "type": "error",
                            "message": "Access denied for this ticket chatroom."
                        }))

            elif action == "leave_chat":
                ticket_id = data.get("ticket_id")
                if ticket_id:
                    chat_group = f"chat_ticket_{ticket_id}"
                    await self.channel_layer.group_discard(chat_group, self.channel_name)
                    self.joined_chat_groups.discard(chat_group)
                    await self.send(json.dumps({
                        "type": "chat_left",
                        "ticket_id": ticket_id
                    }))

        except Exception as e:
            print("[WebSocket Consumer] Error processing message:", e)

    # handlers for broadcasts from channel layer
    async def ticket_updated(self, event):
        metadata = event.get("metadata", {})
        
        # Enforce server-side authorization check before forwarding update
        has_access = await self.check_metadata_access(metadata)
        if has_access:
            await self.send(json.dumps({
                "type": "ticket_updated",
                "ticket": event.get("ticket_data")
            }))

    async def chat_message(self, event):
        await self.send(json.dumps({
            "type": "chat_message",
            "message": event.get("message_data")
        }))

    async def notification(self, event):
        await self.send(json.dumps({
            "type": "notification",
            "notification": event.get("notification_data")
        }))

    # DB queries in database_sync_to_async helpers
    @database_sync_to_async
    def get_user_from_token(self, token_key):
        if not token_key:
            return AnonymousUser()
        try:
            token = Token.objects.select_related("user").get(key=token_key)
            return token.user
        except Token.DoesNotExist:
            return AnonymousUser()

    @database_sync_to_async
    def check_ticket_access(self, ticket_id):
        try:
            from apps.maintenance.models import Ticket
            ticket = Ticket.objects.get(pk=ticket_id)
            return self.user_has_access_to_ticket(ticket)
        except Exception:
            return False

    @database_sync_to_async
    def check_metadata_access(self, metadata):
        return self.user_has_access_to_ticket_metadata(metadata)

    def user_has_access_to_ticket(self, ticket):
        user = self.user
        if user.is_superuser:
            return True
        
        status = ticket.status
        if status:
            codename = 'can_view_{}_ticket'.format(status.status_name.lower().replace(' ', '_'))
            perm = 'maintenance.{}'.format(codename)
            if not user.has_perm(perm):
                return False

        role_name = (user.role.role_name.lower() if hasattr(user, 'role') and user.role else '')
        if role_name == 'technician':
            return ticket.allocations.filter(worker=user).exists()
        
        accessible_store_ids = list(user.accessible_stores.values_list('store_id', flat=True))
        if accessible_store_ids and ticket.store_id not in accessible_store_ids:
            return False
        elif not accessible_store_ids:
            return False

        user_groups_lower = [g.lower().strip() for g in user.groups.values_list('name', flat=True)]
        can_view_all_depts = (
            user.has_perm('maintenance.view_all_department_tickets') or
            user.has_perm('maintenance.create_ticket_all_departments') or
            'main_admin' in user_groups_lower or
            'main administrator' in user_groups_lower or
            'administrator' in user_groups_lower
        )
        if not can_view_all_depts:
            user_dept_ids = list(user.sub_departments.values_list('department_id', flat=True))
            if ticket.department_id not in user_dept_ids:
                return False

        return True

    def user_has_access_to_ticket_metadata(self, metadata):
        user = self.user
        if user.is_superuser:
            return True
        
        status_name = metadata.get('status_name')
        if status_name:
            codename = 'can_view_{}_ticket'.format(status_name.lower().replace(' ', '_'))
            perm = 'maintenance.{}'.format(codename)
            if not user.has_perm(perm):
                return False

        role_name = (user.role.role_name.lower() if hasattr(user, 'role') and user.role else '')
        if role_name == 'technician':
            allocated_worker_ids = metadata.get('allocated_worker_ids', [])
            return user.user_id in allocated_worker_ids

        store_id = metadata.get('store_id')
        accessible_store_ids = list(user.accessible_stores.values_list('store_id', flat=True))
        if accessible_store_ids and store_id not in accessible_store_ids:
            return False
        elif not accessible_store_ids:
            return False

        user_groups_lower = [g.lower().strip() for g in user.groups.values_list('name', flat=True)]
        can_view_all_depts = (
            user.has_perm('maintenance.view_all_department_tickets') or
            user.has_perm('maintenance.create_ticket_all_departments') or
            'main_admin' in user_groups_lower or
            'main administrator' in user_groups_lower or
            'administrator' in user_groups_lower
        )
        if not can_view_all_depts:
            user_dept_ids = list(user.sub_departments.values_list('department_id', flat=True))
            if metadata.get('department_id') not in user_dept_ids:
                return False

        return True
