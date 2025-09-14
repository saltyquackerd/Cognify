import os
import uuid
from datetime import datetime
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

class SimpleAuth:
    def __init__(self):
        self.google_client_id = os.getenv('GOOGLE_CLIENT_ID')
        
    def verify_google_token(self, token):
        """Verify Google OAuth token and return user info"""
        try:
            if not self.google_client_id:
                return None
                
            # Verify the token with Google
            idinfo = id_token.verify_oauth2_token(
                token, google_requests.Request(), self.google_client_id
            )
            
            # Check if token is from correct issuer
            if idinfo['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
                raise ValueError('Wrong issuer.')
                
            return {
                'id': idinfo['sub'],
                'email': idinfo['email'],
                'name': idinfo.get('name', ''),
                'picture': idinfo.get('picture', ''),
                'verified_email': idinfo.get('email_verified', False)
            }
        except Exception as e:
            print(f"Token verification failed: {e}")
            return None
    
    def create_guest_user(self, username):
        """Create a guest user with just a username"""
        return {
            'id': str(uuid.uuid4()),
            'name': username,
            'email': '',
            'picture': '',
            'is_guest': True
        }
