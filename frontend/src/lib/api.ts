// Clerk server APIs must not be imported in client modules.
// We will acquire tokens via window.Clerk or via a setter from pages.

declare global {
  interface Window {
    Clerk?: {
      session?: {
        getToken: () => Promise<string | null>
      }
    }
  }
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api/v1'

// Add production environment check
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_API_BASE_URL) {
  console.error('CRITICAL: NEXT_PUBLIC_API_BASE_URL is not set in production environment')
}

// Check if we're in production and using localhost (which will fail)
const isProductionWithLocalhost = typeof window !== 'undefined' && 
  process.env.NODE_ENV === 'production' && 
  API_BASE_URL.includes('localhost')

if (isProductionWithLocalhost) {
  console.error('ERROR: Production deployment is trying to use localhost API URL:', API_BASE_URL)
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Weather types aligned with backend `/weather-suggestion` response
export interface CurrentWeather {
  temperature: number
  feels_like: number
  humidity: number
  pressure: number
  description: string
  main: string
  icon: string
  wind_speed: number
  wind_direction: number
  visibility: number
  uv_index: number
  city_name: string
  country: string
  sunrise: string
  sunset: string
  timestamp: string
}

export interface ForecastDaySummary {
  date: string
  min_temp: number
  max_temp: number
  total_rain: number
  avg_humidity: number
  main_condition: string
}

export interface AgriculturalSuggestions {
  immediate_actions: string[]
  weekly_planning: string[]
  crop_care: string[]
  irrigation: string[]
  pest_disease_alerts: string[]
}

export interface WeatherData {
  current_weather: CurrentWeather
  forecast_summary: ForecastDaySummary[]
  agricultural_suggestions: AgriculturalSuggestions
  location: {
    latitude: number
    longitude: number
    city: string
  }
}

export interface AnalysisResult {
  analysis_type?: string
  raw_analysis?: string
  structured_data?: string[]
  confidence_level?: number
  [key: string]: unknown
}

export interface SoilData {
  report_type?: string
  extracted_text?: string
  key_findings?: string[]
  ph_level?: number
  organic_matter?: number
  nitrogen?: number
  phosphorus?: number
  potassium?: number
  [key: string]: unknown
}

export interface ImageAnalysis {
  id: number
  analysis_type: string
  analysis: AnalysisResult
  timestamp: string
}

export interface SoilReport {
  id: number
  extracted_text: string
  soil_data: SoilData
  recommendations: string
  timestamp: string
}

export interface ChatMessage {
  id: number
  session_id: number
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface ChatSession {
  id: number
  session_title: string
  created_at: string
  updated_at: string
  message_count: number
}

class ApiService {
  private authToken: string | null = null

  setAuthToken(token: string | null) {
    this.authToken = token
  }

  private async getAuthHeaders(): Promise<HeadersInit> {
    try {
      let token = this.authToken

      if (!token && typeof window !== 'undefined' && window.Clerk?.session) {
        token = await window.Clerk.session.getToken()
      }

      const headers: HeadersInit = { 'Content-Type': 'application/json' }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      return headers
    } catch (error) {
      console.error('Failed to get auth token:', error)
      return { 'Content-Type': 'application/json' }
    }
  }

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      // Check if we're trying to use localhost in production
      if (isProductionWithLocalhost) {
        return {
          success: false,
          error: 'API not configured for production. Please set NEXT_PUBLIC_API_BASE_URL environment variable.'
        }
      }

      const headers = await this.getAuthHeaders()
      
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          ...headers,
          ...options.headers
        }
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP ${response.status}: ${response.statusText}`
        }
      }

      // Normalize successful responses: if `data` field is missing, wrap payload
      // so callers consistently receive `{ success, data }`.
      if (data && data.success === true && typeof data.data === 'undefined') {
        const { success, ...payload } = data
        return { success: true, data: payload as T }
      }

      return data
    } catch (error) {
      console.error('API request failed:', error)
      
      // Provide more specific error messages for common issues
      let errorMessage = 'Network error'
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch')) {
          errorMessage = 'Unable to connect to server. Please check your internet connection.'
        } else {
          errorMessage = error.message
        }
      }
      
      return {
        success: false,
        error: errorMessage
      }
    }
  }

  // Location API
  async updateLocation(latitude: number, longitude: number): Promise<ApiResponse> {
    return this.request('/update-location', {
      method: 'POST',
      body: JSON.stringify({ latitude, longitude })
    })
  }

  // Weather API
  async getWeatherSuggestions(): Promise<ApiResponse<WeatherData>> {
    return this.request('/weather-suggestion')
  }

  // Image Analysis API
  async analyzeCropImage(
    imageData: string, 
    analysisType: string = 'crop_health'
  ): Promise<ApiResponse<ImageAnalysis>> {
    return this.request('/analyze-image', {
      method: 'POST',
      body: JSON.stringify({ 
        image: imageData, 
        analysis_type: analysisType 
      })
    })
  }

  // Soil Report API
  async analyzeSoilReport(imageData: string): Promise<ApiResponse<SoilReport>> {
    return this.request('/soil-report', {
      method: 'POST',
      body: JSON.stringify({ image: imageData })
    })
  }

  // Chat API
  async sendChatMessage(
    message: string, 
    sessionId?: number
  ): Promise<ApiResponse<{
    session_id: number
    response: string
    message_id: number
    timestamp: string
  }>> {
    return this.request('/chat', {
      method: 'POST',
      body: JSON.stringify({ 
        message, 
        session_id: sessionId 
      })
    })
  }

  async getChatSessions(): Promise<ApiResponse<{ sessions: ChatSession[] }>> {
    return this.request('/chat/sessions')
  }

  async getChatMessages(sessionId: number): Promise<ApiResponse<{
    session: ChatSession
    messages: ChatMessage[]
  }>> {
    return this.request(`/chat/sessions/${sessionId}/messages`)
  }

  // User API
  async getUserProfile(): Promise<ApiResponse<{
    user: {
      id: number
      clerk_user_id: string
      email?: string
      first_name?: string
      last_name?: string
      latitude?: number
      longitude?: number
      location_updated_at?: string
      created_at: string
      updated_at: string
    }
  }>> {
    return this.request('/user/profile')
  }

  async getUserHistory(): Promise<ApiResponse<{
    image_analyses: ImageAnalysis[]
    soil_reports: SoilReport[]
  }>> {
    return this.request('/user/history')
  }

  // Health Check
  async healthCheck(): Promise<ApiResponse> {
    return this.request('/health')
  }

  // Translation API
  async translate(
    texts: string[] | string,
    target: 'en' | 'hi' | 'mr'
  ): Promise<ApiResponse<{ translations: string[] }>> {
    const body = Array.isArray(texts) ? { texts, target } : { text: texts, target }
    return this.request('/translate', {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }
}

export const apiService = new ApiService()

// Utility functions for image handling
export const convertFileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      const result = reader.result as string
      resolve(result)
    }
    reader.onerror = (error) => reject(error)
  })
}

export const resizeImage = (
  file: File, 
  maxWidth: number = 1024, 
  maxHeight: number = 1024, 
  quality: number = 0.8
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    img.onload = () => {
      // Calculate new dimensions
      let { width, height } = img
      
      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height
          height = maxHeight
        }
      }

      canvas.width = width
      canvas.height = height

      // Draw and compress
      ctx?.drawImage(img, 0, 0, width, height)
      const dataUrl = canvas.toDataURL('image/jpeg', quality)
      resolve(dataUrl)
    }

    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}