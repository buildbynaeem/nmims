import google.generativeai as genai
from flask import current_app
import json
import base64
from PIL import Image
import io

class GeminiService:
    """Service class for interacting with Google's Gemini API."""
    
    def __init__(self):
        self.model = None
        self.vision_model = None
    
    def initialize(self, api_key):
        """Initialize the Gemini API with the provided API key."""
        genai.configure(api_key=api_key)
        # Use cheaper, widely available model for both text and vision
        # Prefer gemini-2.0-flash (available + economical), fallback to 2.5-flash
        try:
            self.model = genai.GenerativeModel('gemini-2.0-flash')
        except Exception:
            try:
                self.model = genai.GenerativeModel('gemini-2.5-flash')
            except Exception:
                self.model = None

        try:
            self.vision_model = genai.GenerativeModel('gemini-2.0-flash')
        except Exception:
            try:
                self.vision_model = genai.GenerativeModel('gemini-2.5-flash')
            except Exception:
                # If model initialization fails, keep None so dev fallback engages
                self.vision_model = None
    
    def analyze_crop_image(self, image_data, user_context=None):
        """Analyze crop images for diseases, pests, or general health assessment."""
        try:
            # Convert base64 image to PIL Image
            image = self._base64_to_image(image_data)
            
            # Create context-aware prompt
            prompt = self._create_crop_analysis_prompt(user_context)
            
            # Development fallback when Gemini is not initialized
            if not self.vision_model:
                analysis_result = {
                    'analysis_type': 'crop_health',
                    'raw_analysis': 'Dev mode: Gemini not configured. Returning sample analysis.',
                    'structured_data': [
                        'Crop appears healthy with minor leaf spots',
                        'Possible mild fungal activity; monitor conditions',
                        'Recommend neem oil spray, maintain good airflow',
                    ],
                    'confidence_level': 6
                }
                return {
                    'success': True,
                    'analysis': analysis_result,
                    'raw_response': json.dumps(analysis_result)
                }

            # Generate analysis (handle model or API errors gracefully)
            response = self.vision_model.generate_content([prompt, image])
            
            # Parse and structure the response
            analysis_result = self._parse_crop_analysis(response.text)
            
            return {
                'success': True,
                'analysis': analysis_result,
                'raw_response': response.text
            }
            
        except Exception as e:
            current_app.logger.error(f"Crop image analysis error: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def extract_soil_report_data(self, image_data, user_context=None):
        """Extract and analyze data from soil report images using OCR."""
        try:
            # Convert base64 image to PIL Image
            image = self._base64_to_image(image_data)
            
            # Create OCR and analysis prompt
            prompt = self._create_soil_report_prompt(user_context)
            
            # Development fallback when Gemini is not initialized
            if not self.vision_model:
                soil_data = {
                    'report_type': 'soil_analysis',
                    'ph_level': 6.5,
                    'organic_matter': 2.1,
                    'nitrogen': 'moderate',
                    'phosphorus': 'low',
                    'potassium': 'adequate',
                    'key_findings': [
                        'Slightly acidic soil',
                        'Phosphorus deficiency detected',
                        'Organic matter moderate'
                    ]
                }
                return {
                    'success': True,
                    'extracted_text': 'Dev mode OCR: sample soil report extracted.',
                    'soil_data': soil_data,
                    'recommendations': self._generate_soil_recommendations(soil_data, user_context)
                }

            # Generate OCR and analysis (handle model or API errors gracefully)
            response = self.vision_model.generate_content([prompt, image])
            
            # Parse the structured response
            soil_data = self._parse_soil_report(response.text)
            
            return {
                'success': True,
                'extracted_text': response.text,
                'soil_data': soil_data,
                'recommendations': self._generate_soil_recommendations(soil_data, user_context)
            }
            
        except Exception as e:
            current_app.logger.error(f"Soil report analysis error: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def chat_with_farmer(self, message, chat_history=None, user_context=None):
        """Handle farmer chatbot conversations with agricultural expertise."""
        try:
            # Build conversation context
            conversation_prompt = self._create_chat_prompt(message, chat_history, user_context)
            
            # Generate response
            response = self.model.generate_content(conversation_prompt)
            
            return {
                'success': True,
                'response': response.text,
                'message_type': 'text'
            }
            
        except Exception as e:
            current_app.logger.error(f"Chat generation error: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _base64_to_image(self, base64_string):
        """Convert base64 string to PIL Image."""
        # Remove data URL prefix if present
        if base64_string.startswith('data:image'):
            base64_string = base64_string.split(',')[1]
        
        # Decode base64 to bytes
        image_bytes = base64.b64decode(base64_string)
        
        # Convert to PIL Image
        image = Image.open(io.BytesIO(image_bytes))
        return image
    
    def _create_crop_analysis_prompt(self, user_context):
        """Create a detailed prompt for crop image analysis."""
        base_prompt = """
        You are an expert agricultural AI assistant specializing in crop health analysis. 
        Analyze this image and provide a comprehensive assessment including:
        
        1. **Crop Identification**: What type of crop/plant is this?
        2. **Health Status**: Overall health condition (Healthy/Stressed/Diseased)
        3. **Disease Detection**: Any visible diseases, symptoms, or abnormalities
        4. **Pest Identification**: Signs of pest damage or insect presence
        5. **Nutritional Assessment**: Signs of nutrient deficiency or excess
        6. **Growth Stage**: Current growth stage of the crop
        7. **Recommendations**: Specific actionable recommendations for treatment or care
        8. **Confidence Level**: Your confidence in this analysis (1-10 scale)
        
        Please provide your response in a structured JSON format with clear sections for each analysis point.
        """
        
        if user_context:
            location_info = ""
            if user_context.get('latitude') and user_context.get('longitude'):
                location_info = f"User location: {user_context['latitude']}, {user_context['longitude']}"
            
            context_prompt = f"""
            Additional Context:
            - {location_info}
            - User: {user_context.get('first_name', 'Farmer')}
            
            Consider the geographical location and local agricultural conditions in your analysis.
            """
            base_prompt += context_prompt
        
        return base_prompt
    
    def _create_soil_report_prompt(self, user_context):
        """Create a prompt for soil report OCR and analysis."""
        return """
        You are an expert agricultural AI assistant specializing in soil analysis reports.
        
        Please perform OCR on this soil report image and extract all relevant data including:
        
        1. **Basic Information**: Lab name, report date, sample ID
        2. **Physical Properties**: Soil texture, color, structure
        3. **Chemical Properties**: 
           - pH level
           - Organic matter content
           - Nitrogen (N), Phosphorus (P), Potassium (K) levels
           - Micronutrients (Iron, Zinc, Manganese, etc.)
           - Electrical conductivity (EC)
           - Cation Exchange Capacity (CEC)
        4. **Nutrient Analysis**: Available and total nutrient content
        5. **Recommendations**: Any existing recommendations in the report
        
        Please structure your response as JSON with clearly labeled sections.
        If any values are unclear or unreadable, mark them as "unclear" or "not_detected".
        
        After extraction, provide agricultural recommendations based on the soil data.
        """
    
    def _create_chat_prompt(self, message, chat_history, user_context):
        """Create a conversational prompt for the farmer chatbot."""
        system_prompt = """
        You are AgriBot, an expert agricultural AI assistant helping farmers with:
        - Crop management and farming techniques
        - Pest and disease identification and treatment
        - Soil health and fertilization advice
        - Weather-related farming decisions
        - Sustainable farming practices
        - Market insights and crop planning
        
        Always provide practical, actionable advice tailored to the farmer's specific situation.
        Be encouraging and supportive while maintaining scientific accuracy.
        """
        
        context_info = ""
        if user_context:
            if user_context.get('latitude') and user_context.get('longitude'):
                context_info += f"Farmer's location: {user_context['latitude']}, {user_context['longitude']}\n"
            if user_context.get('first_name'):
                context_info += f"Farmer's name: {user_context['first_name']}\n"
        
        conversation = ""
        if chat_history:
            conversation = "Previous conversation:\n"
            for msg in chat_history[-10:]:  # Last 10 messages for context
                conversation += f"{msg['role']}: {msg['content']}\n"
        
        full_prompt = f"{system_prompt}\n\n{context_info}\n{conversation}\nFarmer: {message}\nAgriBot:"
        return full_prompt
    
    def _parse_crop_analysis(self, response_text):
        """Parse and structure crop analysis response."""
        try:
            # Try to extract JSON if present
            if '{' in response_text and '}' in response_text:
                start = response_text.find('{')
                end = response_text.rfind('}') + 1
                json_str = response_text[start:end]
                return json.loads(json_str)
        except:
            pass
        
        # Fallback: return structured text analysis
        return {
            'analysis_type': 'crop_health',
            'raw_analysis': response_text,
            'structured_data': self._extract_key_points(response_text)
        }
    
    def _parse_soil_report(self, response_text):
        """Parse soil report analysis response."""
        try:
            # Try to extract JSON if present
            if '{' in response_text and '}' in response_text:
                start = response_text.find('{')
                end = response_text.rfind('}') + 1
                json_str = response_text[start:end]
                return json.loads(json_str)
        except:
            pass
        
        # Fallback: return structured text analysis
        return {
            'report_type': 'soil_analysis',
            'extracted_text': response_text,
            'key_findings': self._extract_key_points(response_text)
        }
    
    def _generate_soil_recommendations(self, soil_data, user_context):
        """Generate recommendations based on soil analysis."""
        try:
            recommendations_prompt = f"""
            Based on this soil analysis data: {json.dumps(soil_data)}
            
            Provide specific agricultural recommendations including:
            1. Fertilizer recommendations with quantities
            2. Soil amendment suggestions
            3. Suitable crops for this soil type
            4. Irrigation recommendations
            5. Timing for soil treatments
            
            Keep recommendations practical and region-appropriate.
            """
            
            response = self.model.generate_content(recommendations_prompt)
            return response.text
            
        except Exception as e:
            current_app.logger.error(f"Recommendation generation error: {str(e)}")
            return "Unable to generate specific recommendations at this time."
    
    def _extract_key_points(self, text):
        """Extract key points from unstructured text."""
        # Simple extraction of bullet points or numbered items
        lines = text.split('\n')
        key_points = []
        
        for line in lines:
            line = line.strip()
            if line and (line.startswith('-') or line.startswith('•') or 
                        line.startswith('*') or any(line.startswith(f'{i}.') for i in range(1, 10))):
                key_points.append(line)
        
        return key_points if key_points else [text[:200] + "..." if len(text) > 200 else text]

# Global service instance
gemini_service = GeminiService()