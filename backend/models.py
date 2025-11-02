from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import json

db = SQLAlchemy()

class User(db.Model):
    """User model to store user information and location data."""
    
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    clerk_user_id = db.Column(db.String(255), unique=True, nullable=False, index=True)
    email = db.Column(db.String(255), nullable=True)
    first_name = db.Column(db.String(100), nullable=True)
    last_name = db.Column(db.String(100), nullable=True)
    
    # Location data
    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)
    location_updated_at = db.Column(db.DateTime, nullable=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    chat_sessions = db.relationship('ChatSession', backref='user', lazy=True, cascade='all, delete-orphan')
    image_analyses = db.relationship('ImageAnalysis', backref='user', lazy=True, cascade='all, delete-orphan')
    soil_reports = db.relationship('SoilReport', backref='user', lazy=True, cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<User {self.clerk_user_id}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'clerk_user_id': self.clerk_user_id,
            'email': self.email,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'location_updated_at': self.location_updated_at.isoformat() if self.location_updated_at else None,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

class ChatSession(db.Model):
    """Chat session model to store farmer chatbot conversations."""
    
    __tablename__ = 'chat_sessions'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    session_title = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    messages = db.relationship('ChatMessage', backref='session', lazy=True, cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<ChatSession {self.id}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'session_title': self.session_title,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'message_count': len(self.messages)
        }

class ChatMessage(db.Model):
    """Individual chat messages within a session."""
    
    __tablename__ = 'chat_messages'
    
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('chat_sessions.id'), nullable=False)
    role = db.Column(db.String(20), nullable=False)  # 'user' or 'assistant'
    content = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<ChatMessage {self.id}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'session_id': self.session_id,
            'role': self.role,
            'content': self.content,
            'timestamp': self.timestamp.isoformat()
        }

class ImageAnalysis(db.Model):
    """Store image analysis results from Gemini API."""
    
    __tablename__ = 'image_analyses'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    image_filename = db.Column(db.String(255), nullable=True)
    analysis_type = db.Column(db.String(50), nullable=False)  # 'crop_disease', 'pest_identification', etc.
    analysis_result = db.Column(db.Text, nullable=False)  # JSON string of analysis results
    confidence_score = db.Column(db.Float, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<ImageAnalysis {self.id}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'image_filename': self.image_filename,
            'analysis_type': self.analysis_type,
            'analysis_result': json.loads(self.analysis_result) if self.analysis_result else None,
            'confidence_score': self.confidence_score,
            'created_at': self.created_at.isoformat()
        }

class SoilReport(db.Model):
    """Store soil report OCR and analysis results."""
    
    __tablename__ = 'soil_reports'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    report_filename = db.Column(db.String(255), nullable=True)
    extracted_text = db.Column(db.Text, nullable=True)  # OCR extracted text
    analysis_result = db.Column(db.Text, nullable=False)  # JSON string of parsed soil data
    recommendations = db.Column(db.Text, nullable=True)  # AI-generated recommendations
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<SoilReport {self.id}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'report_filename': self.report_filename,
            'extracted_text': self.extracted_text,
            'analysis_result': json.loads(self.analysis_result) if self.analysis_result else None,
            'recommendations': self.recommendations,
            'created_at': self.created_at.isoformat()
        }