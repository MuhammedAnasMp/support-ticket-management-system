import os
from django.core.exceptions import ValidationError
from test_person import validate_human_photo

def validate_profile_image_is_human(profile_image):
    if not profile_image:
        return

    # Ensure we seek to 0 before validating
    if hasattr(profile_image, 'seek'):
        profile_image.seek(0)
    
    try:
        valid, reason = validate_human_photo(profile_image)
    except Exception as e:
        raise ValidationError(f"Invalid image format or error processing image: {str(e)}")
    
    if not valid:
        raise ValidationError(reason)
        
    # Seek back to 0 so other processes can read it
    if hasattr(profile_image, 'seek'):
        profile_image.seek(0)
