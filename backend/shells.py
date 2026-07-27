from django.contrib.auth.models import Group, Permission
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()


group = Group.objects.get(id=2)
group.permissions.set(Permission.objects.all())

print(f"Assigned {group.permissions.count()} permissions to '{group.name}'")
