"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@clerk/nextjs"
import { toast } from "sonner"
import { apiService, convertFileToBase64, resizeImage, type SoilReport, type SoilData } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

export default function SoilReportsPage() {
  const { isSignedIn, getToken } = useAuth()
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [report, setReport] = useState<SoilReport | null>(null)

  useEffect(() => {
    const initToken = async () => {
      if (isSignedIn) {
        const token = await getToken()
        apiService.setAuthToken(token || null)
      }
    }
    void initToken()
  }, [isSignedIn])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null
    setFile(f)
    setReport(null)
  }

  const onAnalyze = async () => {
    if (!file) {
      toast.error("Please select a soil report image")
      return
    }

    try {
      setLoading(true)
      setProgress(10)
      const resized = await resizeImage(file, 1400, 1400, 0.9)
      setProgress(40)
      const imageData = resized || (await convertFileToBase64(file))
      setProgress(70)
      const resp = await apiService.analyzeSoilReport(imageData)
      setProgress(100)
      if (resp.success && resp.data) {
        setReport(resp.data as SoilReport)
        toast.success("Soil report analyzed successfully")
      } else {
        toast.error(resp.error || "Failed to analyze soil report")
      }
    } catch (err) {
      console.error(err)
      toast.error("Unexpected error while analyzing soil report")
    } finally {
      setLoading(false)
      setTimeout(() => setProgress(0), 800)
    }
  }

  const renderSoilData = (data: SoilData) => {
    // Only show primitive values and arrays; hide nested JSON objects
    const entries = Object.entries(data).filter(([_, v]) => {
      if (v === undefined || v === null) return false
      // Hide objects (except arrays) to avoid [object Object] noise
      if (typeof v === 'object' && !Array.isArray(v)) return false
      return true
    })
    if (entries.length === 0) return <p className="text-sm text-muted-foreground">No structured soil data.</p>
    return (
      <ul className="list-disc list-inside text-sm space-y-1">
        {entries.map(([key, value]) => (
          <li key={key}>
            <span className="font-semibold capitalize">{key.replace(/_/g, " ")}: </span>
            {Array.isArray(value) ? (value as unknown[]).join(", ") : String(value)}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Page Heading */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Soil Data & Recommendations:</h1>
        <p className="text-muted-foreground">Upload a soil lab report image to extract key data and get tailored recommendations.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Soil Report OCR & Analysis</CardTitle>
          <CardDescription>Upload a soil lab report image to extract key data and get recommendations.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <input type="file" accept="image/*" onChange={onFileChange} className="mb-4" />
              <div className="mt-4 flex items-center gap-3">
                <Button onClick={onAnalyze} disabled={loading || !file}>
                  {loading ? "Analyzing..." : "Analyze Soil Report"}
                </Button>
                {loading && <Progress value={progress} className="w-40" />}
              </div>
            </div>
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>Results</CardTitle>
                </CardHeader>
                <CardContent>
                  {!report && <p className="text-sm text-muted-foreground">No analysis yet. Upload a report image and click analyze.</p>}
                  {report && (
                    <div className="space-y-4">
                      {report.soil_data && (
                        <div>
                          <p className="font-semibold">Soil Data:</p>
                          {renderSoilData(report.soil_data)}
                        </div>
                      )}
                      {report.recommendations && (
                        <div>
                          <p className="font-semibold">Recommendations:</p>
                          <p className="text-sm whitespace-pre-wrap">{report.recommendations}</p>
                        </div>
                      )}
                      {report.timestamp && (
                        <p className="text-xs text-muted-foreground">Analyzed at {report.timestamp}</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}