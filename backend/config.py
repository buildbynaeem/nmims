import os
from dotenv import load_dotenv

# Resolve project base dir and explicitly load .env.local first.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_LOCAL_PATH = os.path.join(BASE_DIR, ".env.local")

# Load variables from .env.local without overriding any existing envs.
load_dotenv(ENV_LOCAL_PATH, override=False)
 # Also load .env if present, as a secondary source.
load_dotenv(override=False)

class Config:
    """Application configuration class."""
    
    # Flask Configuration
    SECRET_KEY = (
        os.environ.get('SECRET_KEY')
        or os.environ.get('SESSION_SECRET')
        or 'dev-secret-key-change-in-production'
    )
    DEBUG = os.environ.get('FLASK_DEBUG', 'True').lower() == 'true'
    
    # Database Configuration
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or 'sqlite:///agritech.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Clerk Configuration
    CLERK_SECRET_KEY = os.environ.get('CLERK_SECRET_KEY')
    
    # Gemini API Configuration
    GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
    
    # OpenWeatherMap API Configuration
    OPENWEATHER_API_KEY = os.environ.get('OPENWEATHER_API_KEY')
    OPENWEATHER_BASE_URL = 'https://api.openweathermap.org/data/2.5'
    
    # CORS Configuration
    CORS_ORIGINS = [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3001',
        'http://localhost:3002',
        'http://127.0.0.1:3002',
        'http://localhost:3004',
        'http://127.0.0.1:3004',
    ]