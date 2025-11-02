'use client'

import { useState, useEffect } from 'react'
import { useUser, useAuth } from '@clerk/nextjs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'

import { 
  MapPin, 
  Cloud, 
  Thermometer, 
  Droplets, 
  Wind, 
  Eye, 
  Camera, 
  FileText, 
  MessageSquare,
  Leaf,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw
} from 'lucide-react'
import { toast } from 'sonner'
import { apiService, type WeatherData, type ImageAnalysis, type SoilReport } from '@/lib/api'
import useGeolocation from '@/hooks/useGeolocation'

interface UserProfile {
  id: number
  clerk_user_id: string
  email?: string | null
  first_name?: string | null
  last_name?: string | null
  latitude?: number | null
  longitude?: number | null
  location_updated_at?: string | null
  created_at: string
  updated_at: string
}

export default function DashboardPage() {
  const { user } = useUser()
  const { isSignedIn, getToken } = useAuth()
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null)
  const [recentAnalyses, setRecentAnalyses] = useState<ImageAnalysis[]>([])
  const [recentSoilReports, setRecentSoilReports] = useState<SoilReport[]>([])
  const [loading, setLoading] = useState(true)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [hasStoredLocation, setHasStoredLocation] = useState(false)

  const {
    latitude,
    longitude,
    loading: locationLoading,
    error: locationError,
    getCurrentPosition,
    updateLocationOnServer,
    hasLocation
  } = useGeolocation()

  // Fetch user profile data
  const fetchUserProfile = async () => {
    try {
      const result = await apiService.getUserProfile()
      if (result.success && result.data) {
        setUserProfile(result.data.user)
        const hasLocation = result.data.user.latitude !== null && result.data.user.longitude !== null
        setHasStoredLocation(hasLocation)
        return hasLocation
      }
    } catch (error) {
      console.error('Profile fetch error:', error)
    }
    return false
  }

  // Fetch weather data
  const fetchWeatherData = async () => {
    if (!hasStoredLocation) return
    
    setWeatherLoading(true)
    try {
      const result = await apiService.getWeatherSuggestions()
      if (result.success && result.data) {
        setWeatherData(result.data)
      } else {
        toast.error('Failed to fetch weather data')
      }
    } catch (error) {
      console.error('Weather fetch error:', error)
      toast.error('Failed to fetch weather data')
    } finally {
      setWeatherLoading(false)
    }
  }

  // Fetch user history
  const fetchUserHistory = async () => {
    try {
      const result = await apiService.getUserHistory()
      if (result.success && result.data) {
        setRecentAnalyses(result.data.image_analyses.slice(0, 3))
        setRecentSoilReports(result.data.soil_reports.slice(0, 3))
      }
    } catch (error) {
      console.error('History fetch error:', error)
    }
  }

  // Handle location update
  const handleLocationUpdate = async () => {
    await getCurrentPosition()
    if (latitude && longitude) {
      const success = await updateLocationOnServer()
      if (success) {
        // Mark stored location available and reflect immediately
        setHasStoredLocation(true)
        setUserProfile(prev => prev ? {
          ...prev,
          latitude: latitude ?? prev.latitude ?? null,
          longitude: longitude ?? prev.longitude ?? null,
          location_updated_at: new Date().toISOString()
        } : prev)
        toast.success('Location updated')
        fetchWeatherData()
      }
    }
  }

  // Initial data fetch
  useEffect(() => {
    const initializeDashboard = async () => {
      setLoading(true)
      // Initialize API auth token from Clerk
      try {
        if (isSignedIn) {
          const token = await getToken()
          apiService.setAuthToken(token || null)
        }
      } catch (e) {
        console.error('Failed to initialize auth token', e)
      }
      
      // Fetch user profile first to check for stored location
      const hasStoredLoc = await fetchUserProfile()
      
      await Promise.all([
        fetchUserHistory(),
        hasStoredLoc ? fetchWeatherData() : Promise.resolve()
      ])
      setLoading(false)
    }

    initializeDashboard()
  }, [isSignedIn])

  // Auto-fetch weather when stored location is available
  useEffect(() => {
    if (hasStoredLocation && !weatherData) {
      fetchWeatherData()
    }
  }, [hasStoredLocation])

  const getWeatherIcon = (condition: string) => {
    const lowerCondition = condition.toLowerCase()
    if (lowerCondition.includes('rain')) return <Droplets className="h-6 w-6 text-blue-500" />
    if (lowerCondition.includes('cloud')) return <Cloud className="h-6 w-6 text-gray-500" />
    if (lowerCondition.includes('sun') || lowerCondition.includes('clear')) return <Thermometer className="h-6 w-6 text-yellow-500" />
    return <Cloud className="h-6 w-6 text-gray-500" />
  }

  const getAnalysisStatusIcon = (analysisType: string) => {
    switch (analysisType.toLowerCase()) {
      case 'disease_detection':
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      case 'pest_identification':
        return <Eye className="h-4 w-4 text-orange-500" />
      case 'crop_health':
        return <Leaf className="h-4 w-4 text-green-500" />
      default:
        return <CheckCircle className="h-4 w-4 text-blue-500" />
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Loading dashboard...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">AgriTech Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {user?.firstName || 'Farmer'}! Monitor your crops and get AI-powered insights.
        </p>
      </div>

      {/* Location Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Location Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasStoredLocation ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span>
                  Location: {userProfile?.latitude?.toFixed(4)}, {userProfile?.longitude?.toFixed(4)}
                </span>
              </div>
              <Button variant="outline" onClick={handleLocationUpdate} disabled={locationLoading}>
                {locationLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Update Location'}
              </Button>
            </div>
          ) : locationError ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-4 w-4" />
                <span>{locationError}</span>
              </div>
              <Button onClick={handleLocationUpdate} disabled={locationLoading}>
                {locationLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Enable Location'}
              </Button>
            </div>
          ) : hasLocation ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span>Location: {latitude?.toFixed(4)}, {longitude?.toFixed(4)}</span>
              </div>
              <Button variant="outline" onClick={handleLocationUpdate} disabled={locationLoading}>
                {locationLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Save to Profile'}
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-yellow-600">
                <Clock className="h-4 w-4" />
                <span>Location not set</span>
              </div>
              <Button onClick={handleLocationUpdate} disabled={locationLoading}>
                {locationLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Get Location'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Weather Card */}
      {weatherData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getWeatherIcon(weatherData.current_weather.main)}
              Weather & Suggestions
            </CardTitle>
            <CardDescription>
              Current conditions and agricultural recommendations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <Thermometer className="h-6 w-6 mx-auto mb-2 text-red-500" />
                <p className="text-2xl font-bold">{Math.round(weatherData.current_weather.temperature)}°C</p>
                <p className="text-sm text-muted-foreground">Temperature</p>
              </div>
              <div className="text-center">
                <Droplets className="h-6 w-6 mx-auto mb-2 text-blue-500" />
                <p className="text-2xl font-bold">{weatherData.current_weather.humidity}%</p>
                <p className="text-sm text-muted-foreground">Humidity</p>
              </div>
              <div className="text-center">
                <Wind className="h-6 w-6 mx-auto mb-2 text-gray-500" />
                <p className="text-2xl font-bold">{weatherData.current_weather.wind_speed} m/s</p>
                <p className="text-sm text-muted-foreground">Wind Speed</p>
              </div>
              <div className="text-center">
                <Eye className="h-6 w-6 mx-auto mb-2 text-yellow-500" />
                <p className="text-2xl font-bold">{weatherData.current_weather.visibility} km</p>
                <p className="text-sm text-muted-foreground">Visibility</p>
              </div>
            </div>
            
            {weatherData.agricultural_suggestions && (
              <div className="mt-4 p-4 bg-green-50 rounded-lg">
                <h4 className="font-semibold text-green-800 mb-2">Agricultural Suggestions</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {weatherData.agricultural_suggestions.immediate_actions.length > 0 && (
                    <div>
                      <p className="text-sm font-medium">Immediate Actions</p>
                      <ul className="list-disc list-inside text-sm text-green-700">
                        {weatherData.agricultural_suggestions.immediate_actions.slice(0,3).map((s, i) => (
                          <li key={`imm-${i}`}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {weatherData.agricultural_suggestions.weekly_planning.length > 0 && (
                    <div>
                      <p className="text-sm font-medium">Weekly Planning</p>
                      <ul className="list-disc list-inside text-sm text-green-700">
                        {weatherData.agricultural_suggestions.weekly_planning.slice(0,3).map((s, i) => (
                          <li key={`wk-${i}`}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                {weatherData.location && (
                  <p className="text-xs text-green-800 mt-2">
                    Location: {weatherData.location.city} ({weatherData.location.latitude.toFixed(4)}, {weatherData.location.longitude.toFixed(4)})
                  </p>
                )}
              </div>
            )}
            
            <Button 
              variant="outline" 
              onClick={fetchWeatherData} 
              disabled={weatherLoading}
              className="mt-4"
            >
              {weatherLoading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
              Refresh Weather
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow">
          <CardHeader className="text-center">
            <Camera className="h-12 w-12 mx-auto mb-2 text-blue-500" />
            <CardTitle>Analyze Crop Image</CardTitle>
            <CardDescription>
              Upload crop photos for AI-powered disease and pest detection
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow">
          <CardHeader className="text-center">
            <FileText className="h-12 w-12 mx-auto mb-2 text-green-500" />
            <CardTitle>Soil Report Analysis</CardTitle>
            <CardDescription>
              Upload soil test reports for detailed analysis and recommendations
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow">
          <CardHeader className="text-center">
            <MessageSquare className="h-12 w-12 mx-auto mb-2 text-purple-500" />
            <CardTitle>AI Assistant</CardTitle>
            <CardDescription>
              Chat with our agricultural AI for personalized farming advice
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Recent Activity */}
      <Tabs defaultValue="analyses" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="analyses">Recent Image Analyses</TabsTrigger>
          <TabsTrigger value="soil-reports">Recent Soil Reports</TabsTrigger>
        </TabsList>
        
        <TabsContent value="analyses" className="space-y-4">
          {recentAnalyses.length > 0 ? (
            recentAnalyses.map((analysis) => (
              <Card key={analysis.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      {getAnalysisStatusIcon(analysis.analysis_type)}
                      {analysis.analysis_type.replace('_', ' ').toUpperCase()}
                    </CardTitle>
                    <Badge variant="outline">
                      {new Date(analysis.timestamp).toLocaleDateString()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Analysis completed on {new Date(analysis.timestamp).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <Camera className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No image analyses yet</p>
                <p className="text-sm text-muted-foreground">Upload your first crop image to get started</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="soil-reports" className="space-y-4">
          {recentSoilReports.length > 0 ? (
            recentSoilReports.map((report) => (
              <Card key={report.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Soil Report Analysis
                    </CardTitle>
                    <Badge variant="outline">
                      {new Date(report.timestamp).toLocaleDateString()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-2">
                    {report.extracted_text.substring(0, 100)}...
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Analyzed on {new Date(report.timestamp).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No soil reports yet</p>
                <p className="text-sm text-muted-foreground">Upload your first soil test report to get started</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}