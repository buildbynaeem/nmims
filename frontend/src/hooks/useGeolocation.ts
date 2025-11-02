'use client'

import { useState, useEffect } from 'react'
import { apiService } from '@/lib/api'
import { toast } from 'sonner'

interface GeolocationState {
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  error: string | null
  loading: boolean
  supported: boolean
}

interface UseGeolocationOptions {
  enableHighAccuracy?: boolean
  timeout?: number
  maximumAge?: number
  autoUpdate?: boolean
}

export const useGeolocation = (options: UseGeolocationOptions = {}) => {
  const {
    enableHighAccuracy = true,
    timeout = 10000,
    maximumAge = 300000, // 5 minutes
    autoUpdate = false
  } = options

  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
    loading: false,
    supported: typeof navigator !== 'undefined' && 'geolocation' in navigator
  })

  const getCurrentPosition = async (): Promise<void> => {
    if (!state.supported) {
      setState(prev => ({
        ...prev,
        error: 'Geolocation is not supported by this browser'
      }))
      return
    }

    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy,
            timeout,
            maximumAge
          }
        )
      })

      const { latitude, longitude, accuracy } = position.coords

      setState(prev => ({
        ...prev,
        latitude,
        longitude,
        accuracy,
        loading: false,
        error: null
      }))

      // Automatically update location on backend
      if (autoUpdate) {
        try {
          const result = await apiService.updateLocation(latitude, longitude)
          if (result.success) {
            toast.success('Location updated successfully')
          } else {
            toast.error(`Failed to update location: ${result.error}`)
          }
        } catch (error) {
          console.error('Failed to update location on backend:', error)
          toast.error('Failed to save location to server')
        }
      }

    } catch (error) {
      let errorMessage = 'Failed to get location'
      
      if (error instanceof GeolocationPositionError) {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied by user'
            break
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable'
            break
          case error.TIMEOUT:
            errorMessage = 'Location request timed out'
            break
          default:
            errorMessage = 'Unknown location error'
        }
      }

      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }))

      toast.error(errorMessage)
    }
  }

  const updateLocationOnServer = async (): Promise<boolean> => {
    if (!state.latitude || !state.longitude) {
      toast.error('No location data available')
      return false
    }

    try {
      const result = await apiService.updateLocation(state.latitude, state.longitude)
      if (result.success) {
        toast.success('Location updated on server')
        return true
      } else {
        toast.error(`Failed to update location: ${result.error}`)
        return false
      }
    } catch (error) {
      console.error('Failed to update location on server:', error)
      toast.error('Failed to save location to server')
      return false
    }
  }

  const watchPosition = (): number | null => {
    if (!state.supported) return null

    return navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords
        setState(prev => ({
          ...prev,
          latitude,
          longitude,
          accuracy,
          error: null
        }))
      },
      (error) => {
        setState(prev => ({
          ...prev,
          error: error.message
        }))
      },
      {
        enableHighAccuracy,
        timeout,
        maximumAge
      }
    )
  }

  const clearWatch = (watchId: number): void => {
    if (state.supported) {
      navigator.geolocation.clearWatch(watchId)
    }
  }

  const requestPermission = async (): Promise<PermissionState | null> => {
    if (!('permissions' in navigator)) {
      return null
    }

    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' })
      return permission.state
    } catch (error) {
      console.error('Failed to query geolocation permission:', error)
      return null
    }
  }

  // Auto-get location on mount if autoUpdate is enabled
  useEffect(() => {
    if (autoUpdate && state.supported) {
      getCurrentPosition()
    }
  }, [autoUpdate, state.supported])

  return {
    ...state,
    getCurrentPosition,
    updateLocationOnServer,
    watchPosition,
    clearWatch,
    requestPermission,
    hasLocation: state.latitude !== null && state.longitude !== null
  }
}

export default useGeolocation