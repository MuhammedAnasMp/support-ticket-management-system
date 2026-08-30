from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from django.urls import reverse
from .models import PasswordResetOTP

User = get_user_model()

class PasswordResetTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="11111",
            employee_no="11111",
            full_name="Test User",
            email="test@example.com",
            phone="12345678",
            whatsapp_number="98765432",
            active=True
        )
        self.user.set_password("old-password-123")
        self.user.save()

        self.user_no_wa = User.objects.create_user(
            username="22222",
            employee_no="22222",
            full_name="No WA User",
            email="nowa@example.com",
            phone="87654321",
            whatsapp_number=None,
            active=True
        )
        self.user_no_wa.set_password("old-password-123")
        self.user_no_wa.save()

    def test_forgot_password_success(self):
        url = reverse('forgot-password')
        response = self.client.post(url, {'employee_no': '11111'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('whatsapp_number_masked', response.data)
        self.assertEqual(response.data['whatsapp_number_masked'], '******32')
        
        # Verify OTP record is created
        otp_count = PasswordResetOTP.objects.filter(user=self.user).count()
        self.assertEqual(otp_count, 1)

    def test_forgot_password_invalid_employee(self):
        url = reverse('forgot-password')
        response = self.client.post(url, {'employee_no': '99999'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['error'], 'User with this Employee Number does not exist.')

    def test_forgot_password_no_whatsapp(self):
        url = reverse('forgot-password')
        response = self.client.post(url, {'employee_no': '22222'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['error'], 'No WhatsApp number configured for this account. Please contact an admin.')

    def test_reset_password_success(self):
        # Create a valid OTP
        otp_record = PasswordResetOTP.objects.create(user=self.user, otp="123456")
        
        url = reverse('reset-password')
        data = {
            'employee_no': '11111',
            'otp': '123456',
            'new_password': 'new-password-123'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify OTP is marked as used
        otp_record.refresh_from_db()
        self.assertTrue(otp_record.is_used)

        # Verify password is changed
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('new-password-123'))

    def test_reset_password_invalid_otp(self):
        PasswordResetOTP.objects.create(user=self.user, otp="123456")
        
        url = reverse('reset-password')
        data = {
            'employee_no': '11111',
            'otp': '000000', # wrong OTP
            'new_password': 'new-password-123'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['error'], 'Invalid or expired verification code.')

    def test_reset_password_expired_otp(self):
        otp_record = PasswordResetOTP.objects.create(user=self.user, otp="123456")
        # Manually force created_at back by 11 minutes to simulate expiry
        otp_record.created_at = timezone.now() - timedelta(minutes=11)
        otp_record.save()
        
        url = reverse('reset-password')
        data = {
            'employee_no': '11111',
            'otp': '123456',
            'new_password': 'new-password-123'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['error'], 'Invalid or expired verification code.')


from django.core.exceptions import ValidationError
from django.test import TestCase
import io
from PIL import Image
from apps.accounts.validators import validate_profile_image_is_human

class ProfileImageValidatorTestCase(TestCase):
    def test_validate_profile_image_import_and_execution(self):
        img = Image.new('RGB', (100, 100), color='red')
        buf = io.BytesIO()
        img.save(buf, format='JPEG')
        buf.seek(0)
        
        with self.assertRaises(ValidationError) as cm:
            validate_profile_image_is_human(buf)
        
        self.assertNotIn("name 'Image' is not defined", str(cm.exception))


