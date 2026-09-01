import os
import sys
import django

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.accounts.models import Role, CustomUser
from apps.accounts.serializers import CustomUserSerializer

def main():
    print("=== VERIFYING MANAGEMENT ROLE EMPLOYEE APPROVAL ===")
    
    role = Role.objects.filter(role_name="Management").first()
    if not role:
        role = Role.objects.create(role_name="Management")
    
    # Test serializer validation with Management role and NO accessible stores
    data = {
        "username": "mgt_approval_test",
        "email": "mgt_test@example.com",
        "full_name": "Management Test User",
        "phone": "12345678",
        "whatsapp_number": "12345678",
        "password": "TestPassword123!",
        "role": role.pk,
        "active": True,
        "accessible_stores": []
    }
    
    serializer = CustomUserSerializer(data=data)
    is_valid = serializer.is_valid()
    
    print(f"Serializer Is Valid with 0 store allocations for Management Role: {is_valid}")
    if not is_valid:
        print(f"Validation Errors: {serializer.errors}")
    else:
        print("PASS: Management role employee can be approved/saved without manual store allocations!")

if __name__ == '__main__':
    main()
