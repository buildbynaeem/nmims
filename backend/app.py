from flask import Flask, request, jsonify
from flask_cors import CORS
from config import Config
from models import db, User, ChatSession, ChatMessage, ImageAnalysis, SoilReport
from auth import init_clerk, require_auth, get_current_user
from gemini_service import gemini_service
from weather_service import weather_service
import json
from datetime import datetime
import os

def create_app():
    """Application factory pattern."""
    app = Flask(__name__)
    app.config.from_object(Config)
    
    # Initialize extensions
    db.init_app(app)
    CORS(app, origins=app.config['CORS_ORIGINS'])
    
    # Initialize services
    init_clerk(app)
    
    if app.config['GEMINI_API_KEY']:
        gemini_service.initialize(app.config['GEMINI_API_KEY'])
    
    if app.config['OPENWEATHER_API_KEY']:
        weather_service.initialize(
            app.config['OPENWEATHER_API_KEY'],
            app.config['OPENWEATHER_BASE_URL']
        )
    
    # Create database tables
    with app.app_context():
        db.create_all()
    
    # Register routes
    register_routes(app)
    
    return app

def register_routes(app):
    """Register all API routes."""
    
    @app.route('/api/v1/health', methods=['GET'])
    def health_check():
        """Health check endpoint."""
        return jsonify({
            'status': 'healthy',
            'timestamp': datetime.utcnow().isoformat(),
            'version': '1.0.0'
        })
    
    @app.route('/api/v1/update-location', methods=['POST'])
    @require_auth
    def update_location():
        """Update user's location coordinates."""
        try:
            data = request.get_json()
            
            if not data or 'latitude' not in data or 'longitude' not in data:
                return jsonify({'error': 'Latitude and longitude are required'}), 400
            
            latitude = float(data['latitude'])
            longitude = float(data['longitude'])
            
            # Validate coordinates
            if not (-90 <= latitude <= 90) or not (-180 <= longitude <= 180):
                return jsonify({'error': 'Invalid coordinates'}), 400
            
            # Update user location
            user = get_current_user()
            user.latitude = latitude
            user.longitude = longitude
            user.location_updated_at = datetime.utcnow()
            
            db.session.commit()
            
            return jsonify({
                'success': True,
                'message': 'Location updated successfully',
                'location': {
                    'latitude': latitude,
                    'longitude': longitude,
                    'updated_at': user.location_updated_at.isoformat()
                }
            })
            
        except ValueError:
            return jsonify({'error': 'Invalid coordinate format'}), 400
        except Exception as e:
            app.logger.error(f"Location update error: {str(e)}")
            return jsonify({'error': 'Failed to update location'}), 500
    
    @app.route('/api/v1/weather-suggestion', methods=['GET'])
    @require_auth
    def get_weather_suggestions():
        """Get weather-based agricultural suggestions."""
        try:
            user = get_current_user()
            
            if not user.latitude or not user.longitude:
                return jsonify({
                    'error': 'Location not set. Please update your location first.'
                }), 400
            
            # Get weather suggestions
            result = weather_service.get_agricultural_suggestions(
                user.latitude, 
                user.longitude
            )
            
            if not result['success']:
                return jsonify({'error': result['error']}), 500
            
            return jsonify({
                'success': True,
                'data': result
            })
            
        except Exception as e:
            app.logger.error(f"Weather suggestions error: {str(e)}")
            return jsonify({'error': 'Failed to fetch weather suggestions'}), 500
    
    @app.route('/api/v1/analyze-image', methods=['POST'])
    @require_auth
    def analyze_image():
        """Analyze crop images using Gemini API."""
        try:
            data = request.get_json()
            
            if not data or 'image' not in data:
                return jsonify({'error': 'Image data is required'}), 400
            
            user = get_current_user()
            
            # Prepare user context
            user_context = {
                'user_id': user.id,
                'first_name': user.first_name,
                'latitude': user.latitude,
                'longitude': user.longitude
            }
            
            # Analyze image with Gemini
            result = gemini_service.analyze_crop_image(
                data['image'], 
                user_context
            )
            
            if not result['success']:
                return jsonify({'error': result['error']}), 500
            
            # Save analysis to database
            analysis = ImageAnalysis(
                user_id=user.id,
                analysis_type=data.get('analysis_type', 'crop_health'),
                analysis_result=json.dumps(result['analysis']),
                confidence_score=result['analysis'].get('confidence_level', 0) / 10.0 if isinstance(result['analysis'], dict) else None
            )
            
            db.session.add(analysis)
            db.session.commit()
            
            return jsonify({
                'success': True,
                'data': {
                    'id': analysis.id,
                    'analysis_type': data.get('analysis_type', 'crop_health'),
                    'analysis': result['analysis'],
                    'timestamp': analysis.created_at.isoformat()
                }
            })
            
        except Exception as e:
            app.logger.error(f"Image analysis error: {str(e)}")
            return jsonify({'error': 'Failed to analyze image'}), 500
    
    @app.route('/api/v1/soil-report', methods=['POST'])
    @require_auth
    def analyze_soil_report():
        """Analyze soil report images using OCR and Gemini API."""
        try:
            data = request.get_json()
            
            if not data or 'image' not in data:
                return jsonify({'error': 'Soil report image is required'}), 400
            
            user = get_current_user()
            
            # Prepare user context
            user_context = {
                'user_id': user.id,
                'first_name': user.first_name,
                'latitude': user.latitude,
                'longitude': user.longitude
            }
            
            # Analyze soil report with Gemini
            result = gemini_service.extract_soil_report_data(
                data['image'], 
                user_context
            )
            
            if not result['success']:
                return jsonify({'error': result['error']}), 500
            
            # Save soil report to database
            soil_report = SoilReport(
                user_id=user.id,
                extracted_text=result['extracted_text'],
                analysis_result=json.dumps(result['soil_data']),
                recommendations=result['recommendations']
            )
            
            db.session.add(soil_report)
            db.session.commit()
            
            return jsonify({
                'success': True,
                'data': {
                    'id': soil_report.id,
                    'extracted_text': result['extracted_text'],
                    'soil_data': result['soil_data'],
                    'recommendations': result['recommendations'],
                    'timestamp': soil_report.created_at.isoformat()
                }
            })
            
        except Exception as e:
            app.logger.error(f"Soil report analysis error: {str(e)}")
            return jsonify({'error': 'Failed to analyze soil report'}), 500
    
    @app.route('/api/v1/chat', methods=['POST'])
    @require_auth
    def chat_with_bot():
        """Chat with the agricultural AI assistant."""
        try:
            data = request.get_json()
            
            if not data or 'message' not in data:
                return jsonify({'error': 'Message is required'}), 400
            
            user = get_current_user()
            session_id = data.get('session_id')
            
            # Get or create chat session
            if session_id:
                chat_session = ChatSession.query.filter_by(
                    id=session_id, 
                    user_id=user.id
                ).first()
                if not chat_session:
                    return jsonify({'error': 'Chat session not found'}), 404
            else:
                # Create new session
                chat_session = ChatSession(
                    user_id=user.id,
                    session_title=data['message'][:50] + "..." if len(data['message']) > 50 else data['message']
                )
                db.session.add(chat_session)
                db.session.flush()  # Get the ID
            
            # Get chat history
            chat_history = []
            if chat_session.id:
                messages = ChatMessage.query.filter_by(
                    session_id=chat_session.id
                ).order_by(ChatMessage.timestamp.desc()).limit(20).all()
                chat_history = [msg.to_dict() for msg in reversed(messages)]
            
            # Prepare user context
            user_context = {
                'user_id': user.id,
                'first_name': user.first_name,
                'latitude': user.latitude,
                'longitude': user.longitude
            }
            
            # Generate response with Gemini
            result = gemini_service.chat_with_farmer(
                data['message'],
                chat_history,
                user_context
            )
            
            if not result['success']:
                return jsonify({'error': result['error']}), 500
            
            # Save user message
            user_message = ChatMessage(
                session_id=chat_session.id,
                role='user',
                content=data['message']
            )
            db.session.add(user_message)
            
            # Save bot response
            bot_message = ChatMessage(
                session_id=chat_session.id,
                role='assistant',
                content=result['response']
            )
            db.session.add(bot_message)
            
            db.session.commit()
            
            return jsonify({
                'success': True,
                'session_id': chat_session.id,
                'response': result['response'],
                'message_id': bot_message.id,
                'timestamp': bot_message.timestamp.isoformat()
            })
            
        except Exception as e:
            app.logger.error(f"Chat error: {str(e)}")
            return jsonify({'error': 'Failed to process chat message'}), 500
    
    @app.route('/api/v1/chat/sessions', methods=['GET'])
    @require_auth
    def get_chat_sessions():
        """Get user's chat sessions."""
        try:
            user = get_current_user()
            
            sessions = ChatSession.query.filter_by(user_id=user.id)\
                .order_by(ChatSession.updated_at.desc()).all()
            
            return jsonify({
                'success': True,
                'sessions': [session.to_dict() for session in sessions]
            })
            
        except Exception as e:
            app.logger.error(f"Get chat sessions error: {str(e)}")
            return jsonify({'error': 'Failed to fetch chat sessions'}), 500
    
    @app.route('/api/v1/chat/sessions/<int:session_id>/messages', methods=['GET'])
    @require_auth
    def get_chat_messages(session_id):
        """Get messages for a specific chat session."""
        try:
            user = get_current_user()
            
            # Verify session belongs to user
            session = ChatSession.query.filter_by(
                id=session_id, 
                user_id=user.id
            ).first()
            
            if not session:
                return jsonify({'error': 'Chat session not found'}), 404
            
            messages = ChatMessage.query.filter_by(session_id=session_id)\
                .order_by(ChatMessage.timestamp.asc()).all()
            
            return jsonify({
                'success': True,
                'session': session.to_dict(),
                'messages': [message.to_dict() for message in messages]
            })
            
        except Exception as e:
            app.logger.error(f"Get chat messages error: {str(e)}")
            return jsonify({'error': 'Failed to fetch chat messages'}), 500
    
    @app.route('/api/v1/user/profile', methods=['GET'])
    @require_auth
    def get_user_profile():
        """Get user profile information."""
        try:
            user = get_current_user()
            return jsonify({
                'success': True,
                'user': user.to_dict()
            })
            
        except Exception as e:
            app.logger.error(f"Get user profile error: {str(e)}")
            return jsonify({'error': 'Failed to fetch user profile'}), 500
    
    @app.route('/api/v1/user/history', methods=['GET'])
    @require_auth
    def get_user_history():
        """Get user's analysis history."""
        try:
            user = get_current_user()
            
            # Get recent image analyses
            image_analyses = ImageAnalysis.query.filter_by(user_id=user.id)\
                .order_by(ImageAnalysis.created_at.desc()).limit(10).all()
            
            # Get recent soil reports
            soil_reports = SoilReport.query.filter_by(user_id=user.id)\
                .order_by(SoilReport.created_at.desc()).limit(10).all()
            
            return jsonify({
                'success': True,
                'image_analyses': [analysis.to_dict() for analysis in image_analyses],
                'soil_reports': [report.to_dict() for report in soil_reports]
            })
            
        except Exception as e:
            app.logger.error(f"Get user history error: {str(e)}")
            return jsonify({'error': 'Failed to fetch user history'}), 500

if __name__ == '__main__':
    app = create_app()
    port = int(os.environ.get('PORT', '5000'))
    app.run(debug=True, host='0.0.0.0', port=port)