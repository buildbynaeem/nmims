import requests
from flask import current_app
from datetime import datetime, timedelta

class WeatherService:
    """Service class for interacting with OpenWeatherMap API."""
    
    def __init__(self):
        self.api_key = None
        self.base_url = None
    
    def initialize(self, api_key, base_url):
        """Initialize the weather service with API credentials."""
        self.api_key = api_key
        self.base_url = base_url
    
    def get_current_weather(self, latitude, longitude):
        """Get current weather data for the given coordinates."""
        try:
            url = f"{self.base_url}/weather"
            params = {
                'lat': latitude,
                'lon': longitude,
                'appid': self.api_key,
                'units': 'metric'  # Use Celsius
            }
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            
            return {
                'success': True,
                'current_weather': self._format_current_weather(data)
            }
            
        except requests.exceptions.RequestException as e:
            current_app.logger.error(f"Weather API request error: {str(e)}")
            return {
                'success': False,
                'error': f"Failed to fetch weather data: {str(e)}"
            }
        except Exception as e:
            current_app.logger.error(f"Weather processing error: {str(e)}")
            return {
                'success': False,
                'error': f"Weather data processing error: {str(e)}"
            }
    
    def get_weather_forecast(self, latitude, longitude, days=5):
        """Get weather forecast for the given coordinates."""
        try:
            url = f"{self.base_url}/forecast"
            params = {
                'lat': latitude,
                'lon': longitude,
                'appid': self.api_key,
                'units': 'metric',
                'cnt': days * 8  # 8 forecasts per day (3-hour intervals)
            }
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            
            return {
                'success': True,
                'forecast': self._format_forecast_data(data)
            }
            
        except requests.exceptions.RequestException as e:
            current_app.logger.error(f"Forecast API request error: {str(e)}")
            return {
                'success': False,
                'error': f"Failed to fetch forecast data: {str(e)}"
            }
        except Exception as e:
            current_app.logger.error(f"Forecast processing error: {str(e)}")
            return {
                'success': False,
                'error': f"Forecast data processing error: {str(e)}"
            }
    
    def get_agricultural_suggestions(self, latitude, longitude):
        """Get weather-based agricultural suggestions."""
        try:
            # Get current weather and forecast
            current_result = self.get_current_weather(latitude, longitude)
            forecast_result = self.get_weather_forecast(latitude, longitude)
            
            if not current_result['success'] or not forecast_result['success']:
                return {
                    'success': False,
                    'error': 'Failed to fetch weather data for suggestions'
                }
            
            current_weather = current_result['current_weather']
            forecast = forecast_result['forecast']
            
            # Generate agricultural suggestions based on weather data
            suggestions = self._generate_agricultural_suggestions(current_weather, forecast)
            
            return {
                'success': True,
                'current_weather': current_weather,
                'forecast_summary': self._get_forecast_summary(forecast),
                'agricultural_suggestions': suggestions,
                'location': {
                    'latitude': latitude,
                    'longitude': longitude,
                    'city': current_weather.get('city_name', 'Unknown')
                }
            }
            
        except Exception as e:
            current_app.logger.error(f"Agricultural suggestions error: {str(e)}")
            return {
                'success': False,
                'error': f"Failed to generate agricultural suggestions: {str(e)}"
            }
    
    def _format_current_weather(self, data):
        """Format current weather data from OpenWeatherMap API."""
        return {
            'temperature': data['main']['temp'],
            'feels_like': data['main']['feels_like'],
            'humidity': data['main']['humidity'],
            'pressure': data['main']['pressure'],
            'description': data['weather'][0]['description'].title(),
            'main': data['weather'][0]['main'],
            'icon': data['weather'][0]['icon'],
            'wind_speed': data['wind']['speed'],
            'wind_direction': data['wind'].get('deg', 0),
            'visibility': data.get('visibility', 0) / 1000,  # Convert to km
            'uv_index': data.get('uvi', 0),
            'city_name': data['name'],
            'country': data['sys']['country'],
            'sunrise': datetime.fromtimestamp(data['sys']['sunrise']).isoformat(),
            'sunset': datetime.fromtimestamp(data['sys']['sunset']).isoformat(),
            'timestamp': datetime.fromtimestamp(data['dt']).isoformat()
        }
    
    def _format_forecast_data(self, data):
        """Format forecast data from OpenWeatherMap API."""
        formatted_forecast = []
        
        for item in data['list']:
            formatted_forecast.append({
                'datetime': datetime.fromtimestamp(item['dt']).isoformat(),
                'temperature': item['main']['temp'],
                'feels_like': item['main']['feels_like'],
                'humidity': item['main']['humidity'],
                'pressure': item['main']['pressure'],
                'description': item['weather'][0]['description'].title(),
                'main': item['weather'][0]['main'],
                'icon': item['weather'][0]['icon'],
                'wind_speed': item['wind']['speed'],
                'wind_direction': item['wind'].get('deg', 0),
                'precipitation_probability': item.get('pop', 0) * 100,  # Convert to percentage
                'rain': item.get('rain', {}).get('3h', 0),  # 3-hour rainfall in mm
                'snow': item.get('snow', {}).get('3h', 0)   # 3-hour snowfall in mm
            })
        
        return formatted_forecast
    
    def _get_forecast_summary(self, forecast):
        """Get a summary of the forecast data."""
        if not forecast:
            return {}
        
        # Calculate daily summaries
        daily_summaries = {}
        
        for item in forecast:
            date = item['datetime'][:10]  # Get date part (YYYY-MM-DD)
            
            if date not in daily_summaries:
                daily_summaries[date] = {
                    'date': date,
                    'min_temp': item['temperature'],
                    'max_temp': item['temperature'],
                    'total_rain': 0,
                    'avg_humidity': 0,
                    'conditions': [],
                    'count': 0
                }
            
            summary = daily_summaries[date]
            summary['min_temp'] = min(summary['min_temp'], item['temperature'])
            summary['max_temp'] = max(summary['max_temp'], item['temperature'])
            summary['total_rain'] += item['rain']
            summary['avg_humidity'] += item['humidity']
            summary['conditions'].append(item['main'])
            summary['count'] += 1
        
        # Finalize daily summaries
        for date, summary in daily_summaries.items():
            summary['avg_humidity'] = summary['avg_humidity'] / summary['count']
            # Get most common condition
            condition_counts = {}
            for condition in summary['conditions']:
                condition_counts[condition] = condition_counts.get(condition, 0) + 1
            summary['main_condition'] = max(condition_counts, key=condition_counts.get)
            del summary['conditions']
            del summary['count']
        
        return list(daily_summaries.values())
    
    def _generate_agricultural_suggestions(self, current_weather, forecast):
        """Generate agricultural suggestions based on weather data."""
        suggestions = {
            'immediate_actions': [],
            'weekly_planning': [],
            'crop_care': [],
            'irrigation': [],
            'pest_disease_alerts': []
        }
        
        temp = current_weather['temperature']
        humidity = current_weather['humidity']
        description = current_weather['description'].lower()
        
        # Temperature-based suggestions
        if temp < 5:
            suggestions['immediate_actions'].append("Protect sensitive crops from frost damage")
            suggestions['crop_care'].append("Consider covering young plants or moving potted plants indoors")
        elif temp > 35:
            suggestions['immediate_actions'].append("Provide shade for sensitive crops during peak heat")
            suggestions['irrigation'].append("Increase watering frequency due to high temperatures")
        
        # Humidity-based suggestions
        if humidity > 80:
            suggestions['pest_disease_alerts'].append("High humidity increases fungal disease risk - monitor crops closely")
            suggestions['crop_care'].append("Ensure good air circulation around plants")
        elif humidity < 30:
            suggestions['irrigation'].append("Low humidity may increase water needs")
        
        # Weather condition-based suggestions
        if 'rain' in description:
            suggestions['immediate_actions'].append("Postpone irrigation - natural rainfall occurring")
            suggestions['crop_care'].append("Check for waterlogging in low-lying areas")
        elif 'clear' in description or 'sunny' in description:
            suggestions['irrigation'].append("Good conditions for watering early morning or evening")
            suggestions['weekly_planning'].append("Ideal weather for field work and harvesting")
        
        # Wind-based suggestions
        wind_speed = current_weather['wind_speed']
        if wind_speed > 10:  # Strong wind (>36 km/h)
            suggestions['immediate_actions'].append("Secure tall plants and check for wind damage")
            suggestions['crop_care'].append("Avoid spraying pesticides or fertilizers in windy conditions")
        
        # Forecast-based planning
        forecast_summary = self._get_forecast_summary(forecast)
        if forecast_summary:
            # Check for upcoming rain
            upcoming_rain = sum(day['total_rain'] for day in forecast_summary[:3])  # Next 3 days
            if upcoming_rain > 10:  # Significant rain expected
                suggestions['weekly_planning'].append("Heavy rain expected - prepare drainage and postpone outdoor activities")
                suggestions['irrigation'].append("Reduce watering schedule due to expected rainfall")
            elif upcoming_rain < 1:  # No rain expected
                suggestions['irrigation'].append("No rain expected - maintain regular watering schedule")
            
            # Temperature trends
            avg_temp = sum(day['max_temp'] for day in forecast_summary[:3]) / len(forecast_summary[:3])
            if avg_temp > temp + 5:
                suggestions['weekly_planning'].append("Temperature rising - prepare for increased water needs")
            elif avg_temp < temp - 5:
                suggestions['weekly_planning'].append("Temperature dropping - protect sensitive crops")
        
        # Seasonal suggestions based on current month
        current_month = datetime.now().month
        if current_month in [12, 1, 2]:  # Winter
            suggestions['crop_care'].append("Winter season - focus on cold-hardy crops and protection")
        elif current_month in [3, 4, 5]:  # Spring
            suggestions['weekly_planning'].append("Spring season - ideal time for planting and soil preparation")
        elif current_month in [6, 7, 8]:  # Summer
            suggestions['irrigation'].append("Summer season - maintain consistent watering and mulching")
        elif current_month in [9, 10, 11]:  # Fall
            suggestions['weekly_planning'].append("Fall season - harvest time and winter preparation")
        
        return suggestions

# Global service instance
weather_service = WeatherService()