"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { toast } from "sonner"
import { apiService, type WeatherData } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import useGeolocation from "@/hooks/useGeolocation"
import { MapPin, Cloud, Thermometer, Droplets, Wind, Eye, RefreshCw, Leaf } from "lucide-react"

export default function WeatherPage() {
  const { isSignedIn, getToken } = useAuth()
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(false)
  const [updatingLocation, setUpdatingLocation] = useState(false)

  const {
    latitude,
    longitude,
    hasLocation,
    getCurrentPosition,
  } = useGeolocation()

  // Initialize auth token for API service
  useEffect(() => {
    const init = async () => {
      try {
        if (isSignedIn) {
          const token = await getToken()
          apiService.setAuthToken(token || null)
        }
      } catch (e) {
        console.error("Failed to initialize auth token", e)
      }
    }
    void init()
  }, [isSignedIn])

  const fetchWeather = async () => {
    setLoading(true)
    try {
      const result = await apiService.getWeatherSuggestions()
      if (result.success && result.data) {
        setWeather(result.data)
      } else {
        toast.error(result.error || "Failed to fetch weather data")
      }
    } catch (error) {
      console.error("Weather fetch error:", error)
      toast.error("Failed to fetch weather data")
    } finally {
      setLoading(false)
    }
  }

  const updateLocation = async () => {
    setUpdatingLocation(true)
    try {
      await getCurrentPosition()
      if (latitude != null && longitude != null) {
        const res = await apiService.updateLocation(latitude, longitude)
        if (res.success) {
          toast.success("Location updated")
          await fetchWeather()
        } else {
          toast.error(res.error || "Failed to update location")
        }
      } else {
        toast.error("Location not available. Please allow location access.")
      }
    } catch (error) {
      console.error("Location update error:", error)
      toast.error("Failed to update location")
    } finally {
      setUpdatingLocation(false)
    }
  }

  // Auto-fetch on load if location already exists
  useEffect(() => {
    if (hasLocation && !weather) {
      void fetchWeather()
    }
  }, [hasLocation])

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Leaf className="h-5 w-5 text-green-600" />
            Weather & Farming Advice
          </CardTitle>
          <CardDescription>
            Get location-aware weather insights and practical farming recommendations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <Button onClick={updateLocation} disabled={updatingLocation} variant="outline">
              {updatingLocation ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <MapPin className="h-4 w-4" />
              )}
              <span className="ml-2">Update Location</span>
            </Button>
            <Button onClick={fetchWeather} disabled={loading}>
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Cloud className="h-4 w-4" />
              )}
              <span className="ml-2">Refresh Weather</span>
            </Button>
            {latitude != null && longitude != null && (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>
                  {latitude.toFixed(4)}, {longitude.toFixed(4)}
                </span>
              </div>
            )}
          </div>

          {weather ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Cloud className="h-5 w-5" />
                    Current Weather
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div className="flex items-center gap-2">
                      <Thermometer className="h-5 w-5" />
                      <span className="font-medium">{Math.round(weather.current_weather.temperature)}°C</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Droplets className="h-5 w-5" />
                      <span className="font-medium">{weather.current_weather.humidity}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Wind className="h-5 w-5" />
                      <span className="font-medium">{weather.current_weather.wind_speed} m/s</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Eye className="h-5 w-5" />
                      <span className="font-medium">{weather.current_weather.visibility} km</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Cloud className="h-5 w-5" />
                      <span className="font-medium">{weather.current_weather.description}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Farming Suggestions</CardTitle>
                </CardHeader>
                <CardContent>
                  {weather.agricultural_suggestions ? (
                    <div className="space-y-3">
                      {weather.agricultural_suggestions.immediate_actions.length > 0 && (
                        <div>
                          <p className="text-sm font-medium">Immediate Actions</p>
                          <ul className="list-disc list-inside text-sm text-muted-foreground">
                            {weather.agricultural_suggestions.immediate_actions.map((s, i) => (
                              <li key={`imm-${i}`}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {weather.agricultural_suggestions.weekly_planning.length > 0 && (
                        <div>
                          <p className="text-sm font-medium">Weekly Planning</p>
                          <ul className="list-disc list-inside text-sm text-muted-foreground">
                            {weather.agricultural_suggestions.weekly_planning.map((s, i) => (
                              <li key={`wk-${i}`}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {weather.agricultural_suggestions.irrigation.length > 0 && (
                        <div>
                          <p className="text-sm font-medium">Irrigation</p>
                          <ul className="list-disc list-inside text-sm text-muted-foreground">
                            {weather.agricultural_suggestions.irrigation.map((s, i) => (
                              <li key={`irr-${i}`}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {weather.agricultural_suggestions.crop_care.length > 0 && (
                        <div>
                          <p className="text-sm font-medium">Crop Care</p>
                          <ul className="list-disc list-inside text-sm text-muted-foreground">
                            {weather.agricultural_suggestions.crop_care.map((s, i) => (
                              <li key={`care-${i}`}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {weather.agricultural_suggestions.pest_disease_alerts.length > 0 && (
                        <div>
                          <p className="text-sm font-medium">Pest & Disease Alerts</p>
                          <ul className="list-disc list-inside text-sm text-muted-foreground">
                            {weather.agricultural_suggestions.pest_disease_alerts.map((s, i) => (
                              <li key={`pest-${i}`}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm">No suggestions available right now.</p>
                  )}
                  {weather.location && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Location: {weather.location.city} ({weather.location.latitude.toFixed(4)}, {weather.location.longitude.toFixed(4)})
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-12">
              <Cloud className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">Weather insights</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Update your location and refresh to receive weather-driven farming advice.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}