import { useState, useCallback } from 'react';
import { FileText, Image as ImageIcon, Sparkles, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useStoryStore, Scene, Book } from '@/store/useStoryStore';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

type AddBookDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const AddBookDialog = ({ open, onOpenChange }: AddBookDialogProps) => {
  const [text, setText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const { toast } = useToast();
  const { setScenes, addBook, setStoryTitle } = useStoryStore();
  const navigate = useNavigate();

  const MIN_CHARS = 200;
  const MAX_CHARS = 3000;

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      setSelectedImage(file);
    } else if (file.type === 'text/plain' || file.type === 'application/pdf') {
      setSelectedFile(file);
    }
  }, []);

  const handleGenerate = async () => {
    if (!text.trim() && !selectedFile && !selectedImage) return;

    setIsLoading(true);
    try {
      let contentToUse = text;

      if (selectedFile || selectedImage) {
        const formData = new FormData();
        formData.append('file', (selectedFile || selectedImage)!);

        const extractRes = await fetch('/api/extractText', {
          method: 'POST',
          body: formData,
        });

        if (extractRes.ok) {
          const { text: extractedText } = await extractRes.json();
          contentToUse = extractedText;
        }
      }

      if (contentToUse.length < MIN_CHARS) {
        toast({
          title: 'Content too short',
          description: `Please provide at least ${MIN_CHARS} characters.`,
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      const API = "https://unshielding-jennefer-teemingly.ngrok-free.dev";
      const response = await fetch(`${API}/generate_visuals_single_audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: contentToUse,
          max_scenes: 5,
        }),
      });

      if (!response.ok) throw new Error('Generation failed');

      const data = await response.json();
      
      // Map timeline data to scenes
      const timelineMap = new Map<number, { start_sec: number; duration_sec: number }>(
        data.timeline.map((t: { scene_id: number; start_sec: number; duration_sec: number }) => 
          [t.scene_id, { start_sec: t.start_sec, duration_sec: t.duration_sec }]
        )
      );

      // Normalize audio URL to absolute
      const audioUrl: string | undefined = data.audio_url
        ? (data.audio_url.startsWith('http') ? data.audio_url : `${API}${data.audio_url}`)
        : undefined;
      
      const scenes: Scene[] = data.scenes.map((scene: { 
        scene_id: number; 
        scene_summary: string; 
        prompt: string; 
        image_url: string;
        source_sentences: string[];
      }) => {
        const timing = timelineMap.get(scene.scene_id);
        const imageUrl = scene.image_url?.startsWith('http') ? scene.image_url : `${API}${scene.image_url}`;
        return {
          id: `scene-${scene.scene_id}`,
          sentence: scene.source_sentences.join(' '),
          caption: scene.prompt,
          image_url: imageUrl,
          duration_s: timing?.duration_sec || 5,
          start_sec: timing?.start_sec || 0,
          audio_url: audioUrl,
          source_sentences: scene.source_sentences,
        };
      });

      const book: Book = {
        id: `book-${Date.now()}`,
        title: data.title || contentToUse.substring(0, 50) + (contentToUse.length > 50 ? '...' : ''),
        coverImage: scenes[0]?.image_url || 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&h=600&fit=crop',
        createdAt: Date.now(),
        inputText: contentToUse,
        scenes,
        audio_url: audioUrl,
        duration_seconds: data.duration_seconds,
      };

      addBook(book);
      setScenes(scenes);
      setStoryTitle(book.title);
      
      toast({
        title: '✨ Visualization created!',
        description: 'Your content is ready to view.',
      });
      
      onOpenChange(false);
      navigate('/story');
    } catch (error) {
      toast({
        title: 'Generation failed',
        description: 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const canGenerate = (text.length >= MIN_CHARS && text.length <= MAX_CHARS) || selectedFile || selectedImage;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!fixed !inset-0 !w-screen !h-screen !max-w-none !translate-x-0 !translate-y-0 !left-0 !top-0 !rounded-none p-0 border-0 bg-transparent overflow-hidden [&>button]:hidden">
        <AnimatePresence>
          {open && (
            <>
              {/* Expanding orange background */}
              <motion.div
                initial={{ scale: 0, borderRadius: '50%' }}
                animate={{ scale: 2, borderRadius: '0%' }}
                exit={{ scale: 0, borderRadius: '50%' }}
                transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                className="absolute inset-0 bg-gradient-to-br from-primary via-orange-500 to-primary origin-center"
              />
              
              {/* Radial gradient overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ delay: 0.2, duration: 0.3 }}
                className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent_50%)]"
              />

              {/* Content */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ delay: 0.3, duration: 0.4 }}
                className="relative h-full flex flex-col"
              >
                <DialogHeader className="px-4 md:px-8 pt-4 md:pt-6 pb-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <DialogTitle className="text-2xl md:text-3xl font-bold text-white drop-shadow-lg">
                      Create Visualization
                    </DialogTitle>
                    <button
                      onClick={() => onOpenChange(false)}
                      className="text-white/80 hover:text-white transition-colors"
                    >
                      <X className="w-6 h-6 md:w-8 md:h-8" />
                    </button>
                  </div>
                  <p className="text-white/90 text-sm md:text-base">
                    Turn complex content into clear visual explanations
                  </p>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-4 md:pb-8">
                  <div className="max-w-4xl mx-auto">
                    <div className="bg-white/95 backdrop-blur-sm rounded-2xl md:rounded-3xl shadow-2xl p-4 md:p-6 space-y-4 md:space-y-6">
                {/* Text Input Area */}
                <div className="space-y-2">
                  <label className="text-xs md:text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center text-white font-bold text-xs">1</div>
                    Write or paste your content
                  </label>
                  <Textarea
                    placeholder="The Earth is 29 times smaller than the Sun..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className="min-h-[120px] md:min-h-[160px] resize-none text-sm md:text-base border-2 focus:border-primary/50"
                    maxLength={MAX_CHARS}
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{text.length >= MIN_CHARS ? '✓ Ready' : `Need ${MIN_CHARS - text.length} more`}</span>
                    <span>{text.length}/{MAX_CHARS}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
                  <span className="text-xs md:text-sm font-medium text-gray-500">OR</span>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
                </div>

                {/* Combined File Upload Dropzone */}
                <div className="space-y-2">
                  <label className="text-xs md:text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center text-white font-bold text-xs">2</div>
                    Upload a file or image
                  </label>
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => handleFileDrop(e)}
                    className={`border-2 border-dashed rounded-xl p-4 md:p-6 text-center transition-all cursor-pointer group ${
                      isDragging 
                        ? 'border-primary bg-primary/10 scale-[1.02]' 
                        : 'border-gray-300 hover:border-primary/50 hover:bg-gray-50'
                    }`}
                    onClick={() => document.getElementById('file-upload')?.click()}
                  >
                    <input
                      id="file-upload"
                      type="file"
                      accept=".txt,.pdf,image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.type.startsWith('image/')) {
                            setSelectedImage(file);
                            setSelectedFile(null);
                          } else {
                            setSelectedFile(file);
                            setSelectedImage(null);
                          }
                        }
                      }}
                      className="hidden"
                    />
                    <div className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-2 rounded-full bg-gradient-to-br from-primary/20 to-orange-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                      {selectedImage ? <ImageIcon className="w-5 h-5 md:w-6 md:h-6 text-primary" /> : <FileText className="w-5 h-5 md:w-6 md:h-6 text-primary" />}
                    </div>
                    <p className="text-sm md:text-base font-semibold mb-1 text-gray-700">
                      {selectedFile ? selectedFile.name : selectedImage ? selectedImage.name : 'Drop file or click'}
                    </p>
                    <p className="text-xs md:text-sm text-gray-500">
                      TXT, PDF, or Images
                    </p>
                  </div>
                </div>

                      <Button
                        onClick={handleGenerate}
                        disabled={!canGenerate || isLoading}
                        className="w-full gap-2 h-11 md:h-12 text-base md:text-lg font-semibold shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 disabled:shadow-none"
                        size="lg"
                      >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 md:w-5 md:h-5" />
                      Generate Visualization
                    </>
                  )}
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};
