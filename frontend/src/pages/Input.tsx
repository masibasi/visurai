import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Upload, FileText, Image as ImageIcon, Sparkles, Loader2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useStoryStore } from '@/store/useStoryStore';
import { DyslexiaToggle } from '@/components/DyslexiaToggle';
import visuraiLogo from '@/assets/visurai-logo-text.png';

const SAMPLE_TEXT = `The Moon is Earth's only natural satellite. It orbits our planet at an average distance of 384,400 kilometers. The Moon has fascinated humans for thousands of years with its changing phases and mysterious surface. Ancient civilizations created myths and legends about the Moon. Today, we know the Moon has mountains, valleys, and craters formed by asteroid impacts millions of years ago.`;

const MIN_CHARS = 200;
const MAX_CHARS = 3000;

export default function Input() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { setScenes, setLastInputText, setStoryTitle, lastInputText } = useStoryStore();
  
  const [text, setText] = useState(lastInputText || '');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const charCount = text.length;
  const isValidLength = charCount >= MIN_CHARS && charCount <= MAX_CHARS;

  useEffect(() => {
    setText(lastInputText || '');
  }, [lastInputText]);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (!file) return;

    if (file.type === 'text/plain' || file.type === 'application/pdf') {
      setSelectedFile(file);
      setSelectedImage(null);
      setImagePreview(null);
      toast({
        title: '📄 File selected!',
        description: file.name,
      });
    } else if (file.type.startsWith('image/')) {
      setSelectedImage(file);
      setSelectedFile(null);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
      toast({
        title: '🖼️ Image selected!',
        description: file.name,
      });
    }
  }, [toast]);

  const handleGenerate = async () => {
    setIsLoading(true);
    
    try {
      let finalText = text;

      // Extract text from file/image if needed
      if (selectedFile || selectedImage) {
        const formData = new FormData();
        if (selectedFile) formData.append('file', selectedFile);
        if (selectedImage) formData.append('file', selectedImage);

        const extractResponse = await fetch('/api/extractText', {
          method: 'POST',
          body: formData,
        });

        if (!extractResponse.ok) {
          throw new Error('Failed to extract text');
        }

        const { text: extractedText } = await extractResponse.json();
        finalText = extractedText;
      }

      if (!finalText || finalText.length < MIN_CHARS) {
        toast({
          variant: 'destructive',
          title: '📝 Too short!',
          description: `We need at least ${MIN_CHARS} characters to create a great story.`,
        });
        setIsLoading(false);
        return;
      }

      if (finalText.length > MAX_CHARS) {
        toast({
          variant: 'destructive',
          title: '📚 Too long!',
          description: `Please keep it under ${MAX_CHARS} characters.`,
        });
        setIsLoading(false);
        return;
      }

      // Generate story
      const API = "http://127.0.0.1:8000";
      const response = await fetch(`${API}/generate_visuals_single_audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: finalText,
          max_scenes: 5,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate story');
      }

      const data = await response.json();
      console.log('🔍 API Response:', data);

      // Store story title from API response or use first sentence
      const storyTitle = data.title || data.scenes[0]?.scene_summary || 'Untitled Story';
      setStoryTitle(storyTitle);

      // Map timeline data to scenes
      const timelineMap = new Map<number, { start_sec: number; duration_sec: number }>(
        data.timeline.map((t: { scene_id: number; start_sec: number; duration_sec: number }) => 
          [t.scene_id, { start_sec: t.start_sec, duration_sec: t.duration_sec }]
        )
      );

      // Map API response to app's scene structure
      const processedScenes = data.scenes.map((scene: { 
        scene_id: number; 
        scene_summary: string; 
        prompt: string; 
        image_url: string 
      }) => {
        const timing = timelineMap.get(scene.scene_id);
        return {
          id: `scene-${scene.scene_id}`,
          sentence: scene.scene_summary,
          caption: scene.prompt,
          image_url: scene.image_url,
          duration_s: timing?.duration_sec || 5,
        };
      });

      console.log('✅ Processed Scenes:', processedScenes);
      console.log('📊 Number of scenes:', processedScenes.length);

      setScenes(processedScenes);
      setLastInputText(finalText);
      
      console.log('💾 Scenes saved to store, navigating to /story...');
      
      toast({
        title: '✨ Story created!',
        description: 'Get ready for an amazing journey!',
      });

      setTimeout(() => navigate('/story'), 500);
    } catch (error) {
      console.error('Generation error:', error);
      toast({
        variant: 'destructive',
        title: '😔 Oops!',
        description: 'Something went wrong. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseSample = () => {
    setText(SAMPLE_TEXT);
    setSelectedFile(null);
    setSelectedImage(null);
    setImagePreview(null);
    toast({
      title: '🌙 Sample loaded!',
      description: 'Ready to explore space?',
    });
  };

  const handleDemoMode = () => {
    const mockScenes = [
      {
        id: "s1",
        sentence: "Once upon a time, in a magical forest, there lived a curious little fox named Ruby.",
        caption: "A bright red fox with sparkling eyes in an enchanted forest",
        image_url: "https://images.unsplash.com/photo-1474511320723-9a56873867b5?w=800&h=600&fit=crop",
        duration_s: 4.2
      },
      {
        id: "s2",
        sentence: "Ruby loved to explore and discover new things every single day.",
        caption: "Fox exploring through colorful flowers and mushrooms",
        image_url: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&h=600&fit=crop",
        duration_s: 3.8
      },
      {
        id: "s3",
        sentence: "One morning, she found a mysterious glowing stone hidden beneath an old oak tree.",
        caption: "A glowing blue stone under ancient tree roots",
        image_url: "https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=800&h=600&fit=crop",
        duration_s: 4.5
      },
      {
        id: "s4",
        sentence: "The stone whispered ancient secrets of the forest to anyone brave enough to listen.",
        caption: "Magical swirls of light emanating from the stone",
        image_url: "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=800&h=600&fit=crop",
        duration_s: 4.3
      },
      {
        id: "s5",
        sentence: "Ruby learned that kindness and curiosity were the greatest magic of all.",
        caption: "Fox surrounded by forest friends and magical sparkles",
        image_url: "https://images.unsplash.com/photo-1516426122078-c23e76319801?w=800&h=600&fit=crop",
        duration_s: 4.0
      }
    ];

    setScenes(mockScenes);
    toast({
      title: '✨ Demo loaded!',
      description: 'Preview the story player',
    });
    navigate("/story");
  };

  const canGenerate = (text.length >= MIN_CHARS && text.length <= MAX_CHARS) || selectedFile || selectedImage;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-4xl"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, type: 'spring' }}
            className="mb-4 flex flex-col items-center gap-6"
          >
            <img src={visuraiLogo} alt="Visurai Logo" className="h-24" />
            <p className="text-2xl md:text-3xl font-bold text-white/90 drop-shadow">
              Make Learning Immersive
            </p>
          </motion.div>
        </div>

        {/* Main Card */}
        <motion.div
          className="warm-card p-8 md:p-12"
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleFileDrop}
          style={{ borderColor: isDragging ? 'hsl(var(--primary))' : undefined }}
        >
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
              Turn words into pictures
            </h2>
            <p className="text-lg text-muted-foreground">
              Drop in your text, file, or an image of text
            </p>
          </div>

          {/* Text Input */}
          <div className="mb-6">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste or type your text here…"
              className="min-h-[200px] text-lg rounded-xl resize-none"
              aria-label="Story text input"
            />
            <div className="flex justify-between items-center mt-2">
              <span className={`text-sm font-medium ${
                charCount < MIN_CHARS ? 'text-muted-foreground' : 
                charCount > MAX_CHARS ? 'text-destructive' : 
                'text-primary'
              }`}>
                {charCount} / {MAX_CHARS} characters
              </span>
              {charCount > 0 && !isValidLength && (
                <span className="text-sm text-destructive font-medium">
                  {charCount < MIN_CHARS 
                    ? `Need ${MIN_CHARS - charCount} more characters` 
                    : `${charCount - MAX_CHARS} too many characters`}
                </span>
              )}
            </div>
          </div>

          {/* File Upload Options */}
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            {/* Text File */}
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".txt,.pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setSelectedFile(file);
                    setSelectedImage(null);
                    setImagePreview(null);
                    toast({ title: '📄 File selected!', description: file.name });
                  }
                }}
                aria-label="Upload text file"
              />
              <div className={`warm-card p-6 text-center hover:shadow-strong transition-shadow ${
                selectedFile ? 'ring-2 ring-primary' : ''
              }`}>
                <FileText className="w-12 h-12 mx-auto mb-2 text-primary" />
                <p className="font-semibold text-foreground">Upload File</p>
                <p className="text-sm text-muted-foreground">.txt or .pdf</p>
                {selectedFile && (
                  <p className="text-xs text-primary font-medium mt-2 truncate">
                    {selectedFile.name}
                  </p>
                )}
              </div>
            </label>

            {/* Image Upload */}
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setSelectedImage(file);
                    setSelectedFile(null);
                    const reader = new FileReader();
                    reader.onloadend = () => setImagePreview(reader.result as string);
                    reader.readAsDataURL(file);
                    toast({ title: '🖼️ Image selected!', description: file.name });
                  }
                }}
                aria-label="Upload image"
              />
              <div className={`warm-card p-6 text-center hover:shadow-strong transition-shadow ${
                selectedImage ? 'ring-2 ring-primary' : ''
              }`}>
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="w-full h-24 object-cover rounded-lg mb-2" />
                ) : (
                  <ImageIcon className="w-12 h-12 mx-auto mb-2 text-secondary" />
                )}
                <p className="font-semibold text-foreground">Upload Image</p>
                <p className="text-sm text-muted-foreground">.png or .jpg</p>
              </div>
            </label>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-4">
            <div className="flex gap-3">
              <Button
                onClick={handleGenerate}
                disabled={!canGenerate || isLoading}
                className="btn-hero flex-1"
                aria-label="Generate story"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Creating magic...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Generate Story
                  </>
                )}
              </Button>
              <Button
                onClick={handleDemoMode}
                variant="outline"
                className="border-2 border-primary/30 hover:border-primary hover:bg-primary/10 px-6"
              >
                <Play className="w-5 h-5 mr-2" />
                Preview Player
              </Button>
            </div>
            
            <Button
              variant="link"
              onClick={handleUseSample}
              className="text-primary hover:text-primary/80 self-center"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Use sample text
            </Button>
          </div>
        </motion.div>

        {/* Dyslexia Toggle */}
        <div className="mt-6 flex justify-center">
          <DyslexiaToggle />
        </div>
      </motion.div>
    </div>
  );
}
