"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@clerk/nextjs"
import { toast } from "sonner"
import { 
  apiService, 
  convertFileToBase64, 
  resizeImage, 
  type ImageAnalysis, 
  type AnalysisResult 
} from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

export default function AnalysisPage() {
  const { isSignedIn, getToken } = useAuth()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<AnalysisResult | null>(null)

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
    setResult(null)
    if (f) {
      setPreview(URL.createObjectURL(f))
    } else {
      setPreview(null)
    }
  }

  const onAnalyze = async () => {
    if (!file) {
      toast.error("Please select an image to analyze")
      return
    }

    try {
      setLoading(true)
      setProgress(10)
      // Resize to optimize payload
      const resized = await resizeImage(file, 1200, 1200, 0.85)
      setProgress(40)
      // If resize failed for any reason, fallback to base64 directly
      const imageData = resized || (await convertFileToBase64(file))
      setProgress(70)
      const resp = await apiService.analyzeImage(imageData, "crop_health")
      setProgress(100)
      if (resp.success && resp.data) {
        setResult((resp.data as ImageAnalysis).analysis)
        toast.success("Image analyzed successfully")
      } else {
        toast.error(resp.error || "Failed to analyze image")
      }
    } catch (err) {
      console.error(err)
      toast.error("Unexpected error while analyzing image")
    } finally {
      setLoading(false)
      setTimeout(() => setProgress(0), 800)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Image Analysis</CardTitle>
          <CardDescription>Upload a crop image to detect issues and get recommendations.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <input
                type="file"
                accept="image/*"
                onChange={onFileChange}
                className="mb-4"
              />
              {preview && (
                <div className="relative w-full h-64 border rounded-md overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="preview" className="object-cover w-full h-full" />
                </div>
              )}
              <div className="mt-4 flex items-center gap-3">
                <Button onClick={onAnalyze} disabled={loading}>
                  {loading ? "Analyzing..." : "Analyze Image"}
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
                  {!result && <p className="text-sm text-muted-foreground">No analysis yet. Upload an image and click analyze.</p>}
                  {result && (
                    <div className="space-y-3">
                      {result.analysis_type && (
                        <p><span className="font-semibold">Type:</span> {result.analysis_type}</p>
                      )}
                      {typeof result.confidence_level === "number" && (
                        <p><span className="font-semibold">Confidence:</span> {Math.round(result.confidence_level * 10) / 10}</p>
                      )}
                      {result.raw_analysis && (
                        <div>
                          <p className="font-semibold">Summary:</p>
                          <p className="text-sm whitespace-pre-wrap">{result.raw_analysis}</p>
                        </div>
                      )}
                      {Array.isArray(result.structured_data) && result.structured_data.length > 0 && (
                        <div>
                          <p className="font-semibold">Key Findings:</p>
                          <ul className="list-disc list-inside text-sm">
                            {result.structured_data.map((item, idx) => (
                              <li key={idx}>{String(item)}</li>
                            ))}
                          </ul>
                        </div>
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