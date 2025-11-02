import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FileUp, Wand2, Check, AlertTriangle, Upload, FileText, Image, ChevronDown, ChevronUp, History, Info } from "lucide-react";
import { toast } from "sonner";
import * as pdfjsLib from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import { createWorker } from 'tesseract.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { useUser } from '@clerk/clerk-react';
import { dbOperations } from '@/lib/supabase';
import { googleHealthcareAPI } from '@/lib/googleHealthcare';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface Medication {
  original: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  plain_english: string;
  times_per_day: number;
  food_timing?: string; // "before_food", "after_food", "with_food", or "anytime"
  sideEffects?: Array<{
    effect: string;
    severity: 'mild' | 'moderate' | 'severe';
    frequency: 'common' | 'uncommon' | 'rare' | 'very-rare';
    description?: string;
  }>;
}

interface PrescriptionHistory {
  id: string;
  user_id: string;
  original_text: string;
  processed_data: Record<string, unknown>;
  image_url: string | null;
  status: 'processing' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
}

interface PrescriptionDecoderProps {
  onMedicationsDecoded: (medications: Medication[]) => void;
}

export const PrescriptionDecoder = ({ onMedicationsDecoded }: PrescriptionDecoderProps) => {
  const [prescriptionText, setPrescriptionText] = useState("");
  const [decodedMedications, setDecodedMedications] = useState<Medication[]>([]);
  const [medicationsWithSideEffects, setMedicationsWithSideEffects] = useState<Medication[]>([]);
  const [loadingSideEffects, setLoadingSideEffects] = useState(false);
  const [isDecoding, setIsDecoding] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [showPrescriptionText, setShowPrescriptionText] = useState(false);
  const [prescriptionHistory, setPrescriptionHistory] = useState<PrescriptionHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useUser();

  // Load side effects when medications are decoded
  useEffect(() => {
    const loadSideEffects = async () => {
      if (decodedMedications.length === 0) return;
      
      setLoadingSideEffects(true);
      try {
        const medicationsWithEffects = await Promise.all(
          decodedMedications.map(async (med) => {
            try {
              const medicationWithSideEffects = await googleHealthcareAPI.getMedicationWithSideEffects(med.medication_name);
              return {
                ...med,
                sideEffects: medicationWithSideEffects.sideEffects || []
              };
            } catch (error) {
              console.error(`Failed to load side effects for ${med.medication_name}:`, error);
              return med; // Return original medication if side effects loading fails
            }
          })
        );
        setMedicationsWithSideEffects(medicationsWithEffects);
        // Update parent component with medications including side effects
        onMedicationsDecoded(medicationsWithEffects);
      } catch (error) {
        console.error('Failed to load side effects:', error);
        setMedicationsWithSideEffects(decodedMedications); // Fallback to original medications
        onMedicationsDecoded(decodedMedications);
      } finally {
        setLoadingSideEffects(false);
      }
    };

    loadSideEffects();
  }, [decodedMedications, onMedicationsDecoded]);

  // Get side effect badge color variant
  const getSideEffectBadgeColor = (severity: 'mild' | 'moderate' | 'severe') => {
    switch (severity) {
      case 'mild': return 'secondary';
      case 'moderate': return 'default';
      case 'severe': return 'destructive';
      default: return 'outline';
    }
  };

  // Extract text from PDF file
  const extractTextFromPDF = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .filter((item): item is TextItem => 'str' in item)
        .map((item) => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }

    return fullText.trim();
  };

  // Extract text from image using OCR
  const extractTextFromImage = async (file: File): Promise<string> => {
    const worker = await createWorker('eng');
    const { data: { text } } = await worker.recognize(file);
    await worker.terminate();
    return text.trim();
  };

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setUploadedFileName(file.name);

    try {
      let extractedText = '';

      if (file.type === 'application/pdf') {
        toast.info("Processing PDF file...");
        extractedText = await extractTextFromPDF(file);
      } else if (file.type.startsWith('image/')) {
        toast.info("Processing image with OCR...");
        extractedText = await extractTextFromImage(file);
      } else {
        throw new Error('Unsupported file type. Please upload a PDF or image file.');
      }

      if (extractedText) {
        setPrescriptionText(extractedText);
        toast.success("Text extracted successfully!");
      } else {
        toast.error("No text could be extracted from the file.");
      }
    } catch (error) {
      console.error('Error processing file:', error);
      toast.error(error instanceof Error ? error.message : "Failed to process file");
    } finally {
      setIsProcessingFile(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Trigger file input
  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  // Mock prescription decoder - in real app this would call an AI service
  const decodePrescription = async () => {
    if (!prescriptionText.trim()) {
      toast.error("Please enter prescription text to decode");
      return;
    }

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      toast.error("Please configure your Gemini API key in the .env file");
      return;
    }

    setIsDecoding(true);

    try {
      // Initialize Gemini AI
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      // Create a detailed prompt for prescription parsing
      const prompt = `
You are a medical prescription parser. Parse the following prescription text and extract medication information in JSON format.

Prescription text: "${prescriptionText}"

Please return a JSON array of medications with the following structure for each medication:
{
  "original": "exact original text from prescription",
  "medication_name": "name of the medication",
  "dosage": "dosage amount with units",
  "frequency": "frequency in plain English (e.g., 'twice daily', 'once daily')",
  "plain_english": "complete instruction in plain English",
  "times_per_day": number of times per day as integer,
  "food_timing": "before_food" | "after_food" | "with_food" | "anytime"
}

Rules:
- Only extract actual medications, ignore other text
- Convert medical abbreviations to plain English (BID = twice daily, QD = once daily, TID = three times daily, QID = four times daily)
- Be precise with dosage units (mg, ml, tablets, etc.)
- For food_timing, analyze the prescription for food-related instructions:
  * "before_food" if mentions: before meals, before eating, on empty stomach, AC (ante cibum)
  * "after_food" if mentions: after meals, after eating, PC (post cibum), with/after food
  * "with_food" if mentions: with meals, during meals, with food
  * "anytime" if no food timing is specified or mentioned
- If unclear, make reasonable medical interpretations
- Return only valid JSON array, no additional text

Example input: "Tab Metformin 500mg PO BID AC, Lisinopril 10mg PO QD PC"
Example output: [{"original":"Tab Metformin 500mg PO BID AC","medication_name":"Metformin","dosage":"500mg","frequency":"twice daily","plain_english":"Take one 500 mg tablet of Metformin by mouth twice a day before meals","times_per_day":2,"food_timing":"before_food"},{"original":"Lisinopril 10mg PO QD PC","medication_name":"Lisinopril","dosage":"10mg","frequency":"once daily","plain_english":"Take one 10 mg tablet of Lisinopril by mouth once a day after meals","times_per_day":1,"food_timing":"after_food"}]
`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Try to parse the JSON response
      let parsedMedications: Medication[];
      try {
        // Clean the response text to extract JSON
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
          throw new Error("No JSON array found in response");
        }
        parsedMedications = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.error("Failed to parse AI response:", text);
        toast.error("Failed to parse prescription. Please try again or check the format.");
        return;
      }

      // Validate the parsed medications
      if (!Array.isArray(parsedMedications) || parsedMedications.length === 0) {
        toast.error("No medications found in the prescription text");
        return;
      }

      setDecodedMedications(parsedMedications);
      // Don't call onMedicationsDecoded here - let useEffect handle it with side effects
      
      // Save to database if user is authenticated
      if (user?.id) {
        try {
          await dbOperations.savePrescriptionHistory({
            user_id: user.id,
            original_text: prescriptionText,
            processed_data: { medications: parsedMedications },
            image_url: null, // No image URL for text input
            status: 'completed'
          });
          toast.success(`Successfully decoded ${parsedMedications.length} medication(s) and saved to history!`);
        } catch (dbError) {
          console.error('Failed to save prescription history:', dbError);
          toast.success(`Successfully decoded ${parsedMedications.length} medication(s)!`);
          toast.error("Failed to save to history, but decoding was successful.");
        }
      } else {
        toast.success(`Successfully decoded ${parsedMedications.length} medication(s)!`);
      }

    } catch (error) {
      console.error('Error calling Gemini API:', error);
      if (error instanceof Error) {
        if (error.message.includes('API_KEY_INVALID')) {
          toast.error("Invalid API key. Please check your Gemini API key configuration.");
        } else if (error.message.includes('QUOTA_EXCEEDED')) {
          toast.error("API quota exceeded. Please try again later.");
        } else {
          toast.error(`Failed to decode prescription: ${error.message}`);
        }
      } else {
        toast.error("Failed to decode prescription. Please try again.");
      }
    } finally {
      setIsDecoding(false);
    }
  };

  // Load prescription history
  const loadPrescriptionHistory = async () => {
    if (!user?.id) {
      toast.error("Please log in to view prescription history");
      return;
    }

    setIsLoadingHistory(true);
    try {
      console.log('Loading prescription history for user:', user.id);
      const history = await dbOperations.getPrescriptionHistory(user.id);
      console.log('Prescription history loaded:', history);
      setPrescriptionHistory(history || []);
      if (!history || history.length === 0) {
        toast.info("No prescription history found");
      } else {
        toast.success(`Loaded ${history.length} prescription(s) from history`);
      }
    } catch (error) {
      console.error('Failed to load prescription history:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Failed to load prescription history: ${errorMessage}`);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Load a prescription from history
  const loadFromHistory = (historyItem: PrescriptionHistory) => {
    setPrescriptionText(historyItem.original_text);
    if (historyItem.processed_data && 'medications' in historyItem.processed_data) {
      const medications = historyItem.processed_data.medications as Medication[];
      setDecodedMedications(medications);
      onMedicationsDecoded(medications);
      toast.success("Prescription loaded from history!");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-primary" />
              Prescription Decoder
            </div>
            {user && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowHistory(!showHistory);
                  if (!showHistory && prescriptionHistory.length === 0) {
                    loadPrescriptionHistory();
                  }
                }}
                className="gap-2"
              >
                <History className="h-4 w-4" />
                {showHistory ? 'Hide History' : 'View History'}
              </Button>
            )}
          </CardTitle>
          <CardDescription>
            Enter your prescription text or upload a document. We'll translate medical jargon into clear instructions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">
                Prescription Text
              </label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPrescriptionText(!showPrescriptionText)}
                className="gap-2 text-xs"
              >
                {showPrescriptionText ? (
                  <>
                    <ChevronUp className="h-3 w-3" />
                    Hide Text Input
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3" />
                    Show Text Input
                  </>
                )}
              </Button>
            </div>
            
            {showPrescriptionText && (
              <Textarea
                placeholder="Paste your prescription text here... e.g., 'Tab Metformin 500mg PO BID, Lisinopril 10mg PO QD'"
                value={prescriptionText}
                onChange={(e) => setPrescriptionText(e.target.value)}
                className="min-h-[120px] resize-none"
              />
            )}
          </div>

          {uploadedFileName && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Extracted from: {uploadedFileName}
              </span>
            </div>
          )}

          <div className="flex items-center gap-4">
            <Button 
              onClick={decodePrescription}
              disabled={isDecoding || isProcessingFile}
              className="gap-2"
            >
              {isDecoding ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Decoding...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" />
                  Decode Prescription
                </>
              )}
            </Button>

            <Button 
              variant="outline" 
              className="gap-2"
              onClick={triggerFileUpload}
              disabled={isProcessingFile}
            >
              {isProcessingFile ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
                  Processing...
                </>
              ) : (
                <>
                  <FileUp className="h-4 w-4" />
                  Upload Document
                </>
              )}
            </Button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          <div className="text-xs text-muted-foreground">
            Supported formats: PDF files and images (JPG, PNG, etc.)
          </div>
        </CardContent>
      </Card>

      {decodedMedications.length > 0 && (
        <Card className="animate-slide-up">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-success" />
              Decoded Medications
            </CardTitle>
            <CardDescription>
              Here are your medications translated into plain English
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingSideEffects && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
                <span className="text-sm text-muted-foreground">Loading side effects information...</span>
              </div>
            )}
            
            {(medicationsWithSideEffects.length > 0 ? medicationsWithSideEffects : decodedMedications).map((med, index) => (
              <div key={index} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{med.medication_name}</h3>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {med.dosage} • {med.frequency}
                      </Badge>
                      {med.food_timing && (
                        <Badge 
                          variant={
                            med.food_timing === 'before_food' ? 'destructive' : 
                            med.food_timing === 'after_food' ? 'default' : 
                            med.food_timing === 'with_food' ? 'secondary' : 'outline'
                          } 
                          className="text-xs"
                        >
                          {med.food_timing === 'before_food' ? '🍽️ Before Food' :
                           med.food_timing === 'after_food' ? '🍽️ After Food' :
                           med.food_timing === 'with_food' ? '🍽️ With Food' :
                           '⏰ Anytime'}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {med.times_per_day}x daily
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Original:</p>
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {med.original}
                    </code>
                  </div>
                  
                  <div>
                    <p className="text-sm text-muted-foreground">Plain English:</p>
                    <p className="text-sm font-medium">{med.plain_english}</p>
                  </div>

                  {/* Side Effects Display */}
                  {med.sideEffects && med.sideEffects.length > 0 && (
                    <div className="mt-3">
                      <Collapsible>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 p-2 text-xs w-full justify-start">
                            <AlertTriangle className="h-3 w-3 mr-2" />
                            Side Effects ({med.sideEffects.length})
                            <ChevronDown className="h-3 w-3 ml-auto" />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2">
                          <div className="space-y-2 pl-4 border-l-2 border-muted">
                            {med.sideEffects.map((sideEffect, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-xs">
                                <Badge 
                                  variant={getSideEffectBadgeColor(sideEffect.severity)}
                                  className="text-xs"
                                >
                                  {sideEffect.severity}
                                </Badge>
                                <Badge 
                                  variant="outline" 
                                  className="text-xs"
                                >
                                  {sideEffect.frequency}
                                </Badge>
                                <span className="text-muted-foreground flex-1">{sideEffect.effect}</span>
                                {sideEffect.description && (
                                  <div className="relative group">
                                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                                    <div className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 max-w-xs">
                                      {sideEffect.description}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  )}
                </div>
              </div>
            ))}

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Ready to create reminders? Go to the Schedule tab to set up automatic medication reminders.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Prescription History */}
      {showHistory && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Prescription History
            </CardTitle>
            <CardDescription>
              View and reload your previously decoded prescriptions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-sm text-muted-foreground">Loading history...</div>
              </div>
            ) : prescriptionHistory.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-sm text-muted-foreground">No prescription history found.</div>
              </div>
            ) : (
              <div className="space-y-3">
                {prescriptionHistory.map((item) => (
                  <div
                    key={item.id}
                    className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={item.status === 'completed' ? 'default' : 'secondary'}>
                            {item.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(item.created_at).toLocaleDateString()} at{' '}
                            {new Date(item.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {item.original_text.substring(0, 150)}
                          {item.original_text.length > 150 ? '...' : ''}
                        </p>
                        {item.processed_data && 'medications' in item.processed_data && (
                          <div className="text-xs text-muted-foreground">
                            {(item.processed_data.medications as Medication[]).length} medication(s) decoded
                          </div>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadFromHistory(item)}
                        className="ml-4"
                      >
                        Load
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};