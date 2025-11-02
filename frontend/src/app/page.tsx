import Link from 'next/link'
import { SignInButton, SignUpButton, SignedIn, SignedOut } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import LanguageToggle from '@/components/LanguageToggle'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Leaf, Camera, FileText, MessageSquare, Cloud, TrendingUp, Shield, Zap } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-2">
              <Leaf className="h-8 w-8 text-green-600" />
              <span className="text-2xl font-bold text-gray-900">AgriTech Dashboard</span>
            </div>
            
            <div className="flex items-center space-x-4">
              <SignedOut>
                <SignInButton mode="modal">
                  <Button variant="outline">Sign In</Button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <Button>Get Started</Button>
                </SignUpButton>
              </SignedOut>
              <SignedIn>
                {/* Place language toggle to the left of the dashboard button */}
                <LanguageToggle variant="inline" />
                <Link href="/dashboard">
                  <Button>Go to Dashboard</Button>
                </Link>
              </SignedIn>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            Smart Farming with
            <span className="text-green-600"> AI Technology</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Revolutionize your agricultural practices with AI-powered crop monitoring, 
            disease detection, soil analysis, and weather-based recommendations.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <SignedOut>
              <SignUpButton mode="modal">
                <Button size="lg" className="text-lg px-8 py-3">
                  Start Free Trial
                </Button>
              </SignUpButton>
              <SignInButton mode="modal">
                <Button variant="outline" size="lg" className="text-lg px-8 py-3">
                  Sign In
                </Button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <Link href="/dashboard">
                <Button size="lg" className="text-lg px-8 py-3">
                  Go to Dashboard
                </Button>
              </Link>
            </SignedIn>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Powerful Features for Modern Farmers
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Everything you need to optimize your farming operations and maximize crop yields
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="text-center">
              <CardHeader>
                <Camera className="h-12 w-12 mx-auto mb-4 text-blue-500" />
                <CardTitle>AI Image Analysis</CardTitle>
                <CardDescription>
                  Upload crop photos for instant disease and pest detection using advanced AI
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <FileText className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <CardTitle>Soil Report OCR</CardTitle>
                <CardDescription>
                  Automatically extract and analyze data from soil test reports with recommendations
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <MessageSquare className="h-12 w-12 mx-auto mb-4 text-purple-500" />
                <CardTitle>AI Assistant</CardTitle>
                <CardDescription>
                  Get personalized farming advice from our intelligent agricultural chatbot
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <Cloud className="h-12 w-12 mx-auto mb-4 text-cyan-500" />
                <CardTitle>Weather Integration</CardTitle>
                <CardDescription>
                  Location-aware weather data with agricultural suggestions for optimal farming
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <TrendingUp className="h-12 w-12 mx-auto mb-4 text-orange-500" />
                <CardTitle>Analytics Dashboard</CardTitle>
                <CardDescription>
                  Track your farming progress with comprehensive analytics and insights
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <Shield className="h-12 w-12 mx-auto mb-4 text-red-500" />
                <CardTitle>Secure & Private</CardTitle>
                <CardDescription>
                  Your farming data is protected with enterprise-grade security and privacy
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-green-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                Why Choose AgriTech Dashboard?
              </h2>
              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <Zap className="h-6 w-6 text-green-600 mt-1" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Instant AI Analysis</h3>
                    <p className="text-gray-600">Get immediate insights from crop images and soil reports using cutting-edge AI technology.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <TrendingUp className="h-6 w-6 text-green-600 mt-1" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Increase Yields</h3>
                    <p className="text-gray-600">Make data-driven decisions to optimize crop health and maximize your harvest.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <Shield className="h-6 w-6 text-green-600 mt-1" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Prevent Crop Loss</h3>
                    <p className="text-gray-600">Early detection of diseases and pests helps prevent significant crop losses.</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-8 rounded-lg shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">
                Ready to Transform Your Farm?
              </h3>
              <div className="text-center">
                <SignedOut>
                  <SignUpButton mode="modal">
                    <Button size="lg" className="w-full mb-4">
                      Start Your Free Trial
                    </Button>
                  </SignUpButton>
                  <p className="text-sm text-gray-600">
                    No credit card required • 14-day free trial
                  </p>
                </SignedOut>
                <SignedIn>
                  <Link href="/dashboard">
                    <Button size="lg" className="w-full mb-4">
                      Access Your Dashboard
                    </Button>
                  </Link>
                  <p className="text-sm text-gray-600">
                    Welcome back! Continue managing your farm.
                  </p>
                </SignedIn>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <Leaf className="h-8 w-8 text-green-400" />
              <span className="text-2xl font-bold">AgriTech Dashboard</span>
            </div>
            <p className="text-gray-400 mb-4">
              Empowering farmers with AI-driven agricultural solutions
            </p>
            <p className="text-sm text-gray-500">
              © 2024 AgriTech Dashboard. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}