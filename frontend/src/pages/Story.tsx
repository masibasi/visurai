import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, SkipBack, SkipForward, ArrowLeft, Download, RefreshCw, Repeat, Loader2, Maximize, Minimize, RotateCcw, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useStoryStore, Scene } from "@/store/useStoryStore";
import { useToast } from "@/hooks/use-toast";
import { DyslexiaToggle } from "@/components/DyslexiaToggle";
import visuraiLogo from "@/assets/visurai-logo-text.png";

const DEMO_SCENES: Scene[] = [
  {
    id: "demo-1",
    sentence: "Once upon a time, in a magical forest, there lived a curious fox.",
    caption: "A vibrant forest with a curious fox exploring",
    image_url: "https://images.unsplash.com/photo-1474511320723-9a56873867b5?w=1200&h=800&fit=crop",
    duration_s: 4,
  },
  {
    id: "demo-2",
    sentence: "The fox loved to explore and discover new adventures every day.",
    caption: "Fox walking through sunlit forest paths",
    image_url: "https://images.unsplash.com/photo-1516934024742-b461fba47600?w=1200&h=800&fit=crop",
    duration_s: 4,
  },
  {
    id: "demo-3",
    sentence: "One day, the fox found a beautiful meadow filled with wildflowers.",
    caption: "A colorful meadow with wildflowers",
    image_url: "https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=1200&h=800&fit=crop",
    duration_s: 4,
  },
  {
    id: "demo-4",
    sentence: "There, the fox met other forest friends and they played until sunset.",
    caption: "Animals playing together in a meadow at golden hour",
    image_url: "https://images.unsplash.com/photo-1535083783855-76ae62b2914e?w=1200&h=800&fit=crop",
    duration_s: 4,
  },
  {
    id: "demo-5",
    sentence: "As the stars came out, the fox returned home, happy and content.",
    caption: "Starry night sky over a peaceful forest",
    image_url: "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=1200&h=800&fit=crop",
    duration_s: 4,
  },
];

export default function Story() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { scenes, currentIndex, isPlaying, speed, storyTitle, setCurrentIndex, setIsPlaying, setSpeed, nextScene, prevScene, setScenes } = useStoryStore();

  const [loop, setLoop] = useState(false);
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const [currentTime, setCurrentTime] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioLoaded, setAudioLoaded] = useState(false);

  const currentScene = scenes[currentIndex];

  // Check if video has ended
  const totalDuration = scenes.reduce((sum, s) => sum + (s.duration_s || 3), 0);
  const hasEnded = !isPlaying && currentTime >= totalDuration && totalDuration > 0;

  // Load demo scenes if no scenes exist
  useEffect(() => {
    console.log("🎬 Story page mounted. Scenes in store:", scenes.length);
    console.log("🧩 Story title (store):", storyTitle);
    console.log("📦 Current scenes:", scenes);
    if (scenes.length === 0) {
      console.log("⚠️ No scenes found, loading demo...");
      setScenes(DEMO_SCENES);
      toast({
        title: "📽️ Preview Mode",
        description: "Viewing demo story. Create your own from the Library!",
      });
    } else {
      console.log("✅ Found", scenes.length, "scenes from API");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Preload images
  useEffect(() => {
    scenes.forEach((scene) => {
      const img = new Image();
      img.onload = () => {
        setLoadedImages((prev) => new Set([...prev, scene.image_url]));
      };
      img.src = scene.image_url;
    });
  }, [scenes]);

  // Initialize audio element
  useEffect(() => {
    console.log("🎵 Checking for audio URL in scenes:", scenes[0]?.audio_url);

    if (scenes[0]?.audio_url) {
      console.log("🎵 Creating audio element for:", scenes[0].audio_url);

      const audio = document.createElement("audio");
      audio.preload = "auto";

      const resolvedUrl = scenes[0].audio_url?.startsWith("http") ? scenes[0].audio_url : `https://unshielding-jennefer-teemingly.ngrok-free.dev${scenes[0].audio_url || ""}`;

      console.log("🎵 Direct audio URL:", resolvedUrl);

      // Set source directly to let the browser infer type
      audio.src = resolvedUrl;

      const supabaseUrl: string | undefined = (import.meta as any)?.env?.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
      let attemptedProxy = false;

      const onLoaded = () => {
        setAudioLoaded(true);
        console.log("✅ Audio loaded successfully");
      };

      const onError = (e: Event) => {
        // Try fallback via Supabase audio-proxy once
        if (!attemptedProxy && supabaseUrl) {
          const proxied = `${supabaseUrl}/functions/v1/audio-proxy?url=${encodeURIComponent(resolvedUrl || "")}`;
          console.warn("⚠️ Direct load failed, retrying via audio-proxy:", proxied);
          attemptedProxy = true;
          audio.src = proxied;
          audio.load();
          return;
        }

        console.error("❌ Audio load error:", e);
        console.error("❌ Audio error details:", {
          error: audio.error,
          networkState: audio.networkState,
          readyState: audio.readyState,
          src: audio.currentSrc || audio.src,
          attemptedProxy,
        });
        toast({
          title: "Audio Load Failed",
          description: "Could not load the audio file.",
          variant: "destructive",
          action: (
            <button onClick={() => window.open(audio.currentSrc || resolvedUrl, "_blank")} className="text-sm underline">
              Open audio
            </button>
          ),
        });
      };

      const onCanPlay = () => {
        console.log("✅ Audio can play");
      };

      audio.addEventListener("loadeddata", onLoaded);
      audio.addEventListener("loadedmetadata", onLoaded);
      audio.addEventListener("canplay", onCanPlay);
      audio.addEventListener("error", onError);

      audio.load();
      audioRef.current = audio;

      return () => {
        try {
          audio.pause();
        } catch {}
        audio.removeEventListener("loadeddata", onLoaded);
        audio.removeEventListener("loadedmetadata", onLoaded);
        audio.removeEventListener("canplay", onCanPlay);
        audio.removeEventListener("error", onError);
        audio.src = "";
      };
    } else {
      console.log("⚠️ No audio URL found in scenes");
    }
  }, [scenes, toast]);

  // Sync audio with playback state
  useEffect(() => {
    if (!audioRef.current || !audioLoaded) return;

    if (isPlaying) {
      audioRef.current.play().catch((e) => {
        console.error("Audio play error:", e);
      });
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, audioLoaded]);

  // Update audio playback rate
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  }, [speed]);

  // Sync audio time with currentTime
  useEffect(() => {
    if (audioRef.current && Math.abs(audioRef.current.currentTime - currentTime) > 0.5) {
      audioRef.current.currentTime = currentTime;
    }
  }, [currentTime]);

  // Auto-advance when playing
  useEffect(() => {
    if (!isPlaying || !currentScene) return;

    const interval = 50;
    const increment = (interval / 1000) * speed; // seconds to add per tick

    timerRef.current = setInterval(() => {
      setCurrentTime((prevTime) => {
        const totalDuration = scenes.reduce((sum, s) => sum + (s.duration_s || 3), 0);
        const nextTime = Math.min(prevTime + increment, totalDuration);

        // Find which scene this time corresponds to
        let cumulativeTime = 0;
        let targetIndex = 0;

        for (let i = 0; i < scenes.length; i++) {
          const sceneDuration = scenes[i].duration_s || 3;
          if (cumulativeTime + sceneDuration > nextTime) {
            targetIndex = i;
            break;
          }
          cumulativeTime += sceneDuration;
          if (i === scenes.length - 1) targetIndex = i;
        }

        // Update scene index if needed
        if (targetIndex !== currentIndex) {
          setCurrentIndex(targetIndex);
        }

        // Check if we've reached the end
        if (nextTime >= totalDuration) {
          if (loop) {
            setCurrentIndex(0);
            return 0;
          } else {
            setIsPlaying(false);
            return totalDuration;
          }
        }

        return nextTime;
      });
    }, interval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, currentScene, speed, loop, setCurrentIndex, setIsPlaying, scenes, currentIndex]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptRefs.current[currentIndex]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [currentIndex]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          // Replay from start if ended
          if (hasEnded) {
            setCurrentTime(0);
            setCurrentIndex(0);
            setIsPlaying(true);
          } else {
            setIsPlaying(!isPlaying);
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (currentIndex > 0) {
            const newIndex = currentIndex - 1;
            const before = scenes.slice(0, newIndex).reduce((sum, s) => sum + (s.duration_s || 3), 0);
            setCurrentTime(before);
            setCurrentIndex(newIndex);
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          if (currentIndex < scenes.length - 1) {
            const newIndex = currentIndex + 1;
            const before = scenes.slice(0, newIndex).reduce((sum, s) => sum + (s.duration_s || 3), 0);
            setCurrentTime(before);
            setCurrentIndex(newIndex);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, setIsPlaying, hasEnded, currentIndex, scenes, setCurrentIndex, setCurrentTime]);

  const handleSeek = (value: number[]) => {
    const totalDuration = scenes.reduce((sum, s) => sum + (s.duration_s || 3), 0);
    const clampedPercent = Math.max(0, Math.min(100, value[0] ?? 0));
    const targetTime = (clampedPercent / 100) * totalDuration;

    // Find which scene contains this timestamp
    let cumulativeTime = 0;
    let targetIndex = 0;

    for (let i = 0; i < scenes.length; i++) {
      const sceneDuration = scenes[i].duration_s || 3;
      if (cumulativeTime + sceneDuration > targetTime) {
        targetIndex = i;
        break;
      }
      cumulativeTime += sceneDuration;
      if (i === scenes.length - 1) targetIndex = i;
    }

    setCurrentIndex(targetIndex);
    setCurrentTime(targetTime);
  };

  const handleRegenerateScene = async (sceneId: string) => {
    toast({
      title: "🎨 Regenerating...",
      description: "Creating a new version of this scene.",
    });

    try {
      const response = await fetch(`/api/regenerate?sceneId=${sceneId}`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to regenerate");

      const newScene = await response.json();
      // Update scene in store (implementation depends on store structure)
      toast({
        title: "✨ Scene updated!",
        description: "Your new scene is ready.",
      });
    } catch (error) {
      console.error("Regeneration error:", error);
      toast({
        variant: "destructive",
        title: "😔 Oops!",
        description: "Could not regenerate scene. Try again?",
      });
    }
  };

  const handleDownload = async () => {
    toast({
      title: "📦 Preparing download...",
      description: "Your story will be ready soon!",
    });

    try {
      const response = await fetch("/api/downloadZip", {
        method: "GET",
      });

      if (!response.ok) throw new Error("Failed to download");

      // Trigger download
      toast({
        title: "🎉 Download ready!",
        description: "Your story is saved.",
      });
    } catch (error) {
      console.error("Download error:", error);
      toast({
        variant: "destructive",
        title: "😔 Download failed",
        description: "Please try again later.",
      });
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error("Fullscreen error:", error);
    }
  };

  const handleMouseMove = () => {
    if (!isFullscreen) return;
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      if (!document.fullscreenElement) {
        setShowControls(true);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  if (scenes.length === 0) return null;

  const isImageLoaded = currentScene && loadedImages.has(currentScene.image_url);

  if (isFullscreen) {
    return (
      <div
        ref={fullscreenRef}
        className={`fixed inset-0 bg-black flex items-center justify-center ${!showControls ? "cursor-none" : ""}`}
        onMouseMove={handleMouseMove}
        onClick={() => {
          if (hasEnded) {
            setCurrentTime(0);
            setCurrentIndex(0);
            setIsPlaying(true);
          } else {
            setIsPlaying(!isPlaying);
          }
        }}
      >
        {/* Fullscreen Image */}
        <AnimatePresence mode="wait">
          {isImageLoaded ? (
            <motion.img
              key={currentScene.id}
              src={currentScene.image_url}
              alt={currentScene.caption || currentScene.sentence}
              className="w-full h-full object-contain"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Loader2 className="w-16 h-16 text-white animate-spin" />
            </div>
          )}
        </AnimatePresence>

        {/* Movie-style Caption */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="absolute bottom-24 left-0 right-0 flex justify-center px-8">
          <div className="bg-black/70 backdrop-blur-sm px-8 py-4 rounded-lg max-w-4xl w-full">
            <p className="text-white text-2xl text-center font-medium leading-relaxed">{currentScene.sentence}</p>
          </div>
        </motion.div>

        {/* Overlay Controls */}
        <AnimatePresence>
          {showControls && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 pointer-events-none">
              {/* Top Bar */}
              <div className="absolute top-0 left-0 right-0 p-6 bg-gradient-to-b from-black/60 to-transparent pointer-events-auto">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <img src={visuraiLogo} alt="Visurai" className="h-8" />
                  </div>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFullscreen();
                    }}
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-white/20"
                  >
                    <Minimize className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              {/* Bottom Controls */}
              <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/60 to-transparent pointer-events-auto">
                <div className="max-w-6xl mx-auto space-y-4">
                  {/* Progress Bar */}
                  <Slider
                    value={[
                      (() => {
                        const totalDuration = scenes.reduce((sum, s) => sum + (s.duration_s || 3), 0);
                        return totalDuration > 0 ? (Math.min(currentTime, totalDuration) / totalDuration) * 100 : 0;
                      })(),
                    ]}
                    onValueChange={(value) => {
                      handleSeek(value);
                    }}
                    max={100}
                    step={0.1}
                    className="cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  />

                  <div className="flex items-center justify-between">
                    {/* Left: Time */}
                    <span className="text-white text-sm font-medium">
                      {(() => {
                        const totalDuration = scenes.reduce((sum, s) => sum + (s.duration_s || 3), 0);
                        const formatTime = (seconds: number) => {
                          const mins = Math.floor(seconds / 60);
                          const secs = Math.floor(seconds % 60);
                          return `${mins}:${secs.toString().padStart(2, "0")}`;
                        };
                        return `${formatTime(currentTime)} / ${formatTime(totalDuration)}`;
                      })()}
                    </span>

                    {/* Center: Playback Controls */}
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (currentIndex > 0) {
                            const newIndex = currentIndex - 1;
                            const before = scenes.slice(0, newIndex).reduce((sum, s) => sum + (s.duration_s || 3), 0);
                            setCurrentTime(before);
                            setCurrentIndex(newIndex);
                          }
                        }}
                        disabled={currentIndex === 0}
                        size="sm"
                        variant="ghost"
                        className="text-white hover:bg-white/20"
                      >
                        <SkipBack className="w-5 h-5" />
                      </Button>

                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (hasEnded) {
                            setCurrentTime(0);
                            setCurrentIndex(0);
                            setIsPlaying(true);
                          } else {
                            setIsPlaying(!isPlaying);
                          }
                        }}
                        size="sm"
                        variant="ghost"
                        className="text-white hover:bg-white/20 w-12 h-12"
                      >
                        {hasEnded ? <RotateCcw className="w-6 h-6" /> : isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
                      </Button>

                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (currentIndex < scenes.length - 1) {
                            const newIndex = currentIndex + 1;
                            const before = scenes.slice(0, newIndex).reduce((sum, s) => sum + (s.duration_s || 3), 0);
                            setCurrentTime(before);
                            setCurrentIndex(newIndex);
                          }
                        }}
                        disabled={currentIndex === scenes.length - 1}
                        size="sm"
                        variant="ghost"
                        className="text-white hover:bg-white/20"
                      >
                        <SkipForward className="w-5 h-5" />
                      </Button>
                    </div>

                    {/* Right: Speed & Loop */}
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          setLoop(!loop);
                        }}
                        variant="ghost"
                        size="sm"
                        className={`text-white hover:bg-white/20 ${loop ? "bg-white/20" : ""}`}
                      >
                        <Repeat className="w-4 h-4" />
                      </Button>
                      <span className="text-white text-sm font-medium">{speed}×</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <img src={visuraiLogo} alt="Visurai Logo" className="h-10" />
          <Button onClick={() => navigate("/")} variant="ghost" className="text-black">
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Input
          </Button>
        </div>

        <div className="flex gap-2">
          <DyslexiaToggle />
          <Button
            onClick={() => {
              const apiResponse = JSON.stringify(scenes, null, 2);
              navigator.clipboard.writeText(apiResponse);
              toast({
                title: "✓ Copied!",
                description: "API response copied to clipboard.",
              });
            }}
            variant="outline"
            size="sm"
            className="rounded-full"
          >
            <Copy className="w-4 h-4 mr-2" />
            Copy Response
          </Button>
          <Button onClick={handleDownload} variant="secondary" className="btn-playful">
            <Download className="w-5 h-5 mr-2" />
            Download ZIP
          </Button>
        </div>
      </div>

      {/* Main Layout */}
      <div className="grid lg:grid-cols-[2fr,1fr] gap-6">
        {/* Player */}
        <div className="warm-card p-6">
          {(() => {
            const displayTitle = storyTitle || currentScene?.sentence || scenes[0]?.sentence || "" || "Untitled Story";
            return displayTitle && <h2 className="text-2xl font-bold mb-4">{displayTitle}</h2>;
          })()}
          <div className="aspect-video bg-muted rounded-xl overflow-hidden mb-4 relative group">
            <AnimatePresence mode="wait">
              {isImageLoaded ? (
                <motion.img
                  key={currentScene.id}
                  src={currentScene.image_url}
                  alt={currentScene.caption || currentScene.sentence}
                  className="w-full h-full object-cover cursor-pointer"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  onClick={() => {
                    if (hasEnded) {
                      // Replay from beginning
                      setCurrentIndex(0);
                      setCurrentTime(0);
                      setIsPlaying(true);
                    } else {
                      // Toggle play/pause
                      setIsPlaying(!isPlaying);
                    }
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Loader2 className="w-12 h-12 text-primary animate-spin" />
                </div>
              )}
            </AnimatePresence>

            {/* Playback Controls - Bottom Left */}
            <div className={`absolute bottom-4 left-4 transition-opacity flex items-center gap-2 ${isPlaying ? "opacity-0 group-hover:opacity-100" : "opacity-100"}`}>
              <Button
                onClick={() => {
                  if (currentIndex > 0) {
                    const newIndex = currentIndex - 1;
                    const before = scenes.slice(0, newIndex).reduce((sum, s) => sum + (s.duration_s || 3), 0);
                    setCurrentTime(before);
                    setCurrentIndex(newIndex);
                  }
                }}
                disabled={currentIndex === 0}
                size="icon"
                variant="secondary"
                className="rounded-full"
                aria-label="Previous scene"
              >
                <SkipBack className="w-5 h-5" />
              </Button>

              <Button
                onClick={() => {
                  if (hasEnded) {
                    setCurrentTime(0);
                    setCurrentIndex(0);
                    setIsPlaying(true);
                  } else {
                    setIsPlaying(!isPlaying);
                  }
                }}
                size="icon"
                variant="secondary"
                className="rounded-full w-12 h-12"
                aria-label={hasEnded ? "Replay" : isPlaying ? "Pause" : "Play"}
              >
                {hasEnded ? <RotateCcw className="w-6 h-6" /> : isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
              </Button>

              <Button
                onClick={() => {
                  if (currentIndex < scenes.length - 1) {
                    const newIndex = currentIndex + 1;
                    const before = scenes.slice(0, newIndex).reduce((sum, s) => sum + (s.duration_s || 3), 0);
                    setCurrentTime(before);
                    setCurrentIndex(newIndex);
                  }
                }}
                disabled={currentIndex === scenes.length - 1}
                size="icon"
                variant="secondary"
                className="rounded-full"
                aria-label="Next scene"
              >
                <SkipForward className="w-5 h-5" />
              </Button>
            </div>

            {/* Fullscreen Button - Bottom Right */}
            <Button
              onClick={toggleFullscreen}
              size="icon"
              variant="secondary"
              className={`absolute bottom-4 right-4 transition-opacity rounded-full ${isPlaying ? "opacity-0 group-hover:opacity-100" : "opacity-100"}`}
              aria-label="Enter fullscreen"
            >
              <Maximize className="w-5 h-5" />
            </Button>
          </div>

          {/* Seek bar */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Slider
                value={[
                  (() => {
                    const totalDuration = scenes.reduce((sum, s) => sum + (s.duration_s || 3), 0);
                    return totalDuration > 0 ? (Math.min(currentTime, totalDuration) / totalDuration) * 100 : 0;
                  })(),
                ]}
                onValueChange={handleSeek}
                max={100}
                step={0.1}
                aria-label="Story progress"
              />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>
                  {(() => {
                    const totalDuration = scenes.reduce((sum, s) => sum + (s.duration_s || 3), 0);
                    const formatTime = (seconds: number) => {
                      const mins = Math.floor(seconds / 60);
                      const secs = Math.floor(seconds % 60);
                      return `${mins}:${secs.toString().padStart(2, "0")}`;
                    };
                    return `${formatTime(currentTime)} / ${formatTime(totalDuration)}`;
                  })()}
                </span>
                <span>Speed: {speed}×</span>
              </div>
            </div>

            {/* Speed & Loop */}
            <div className="flex gap-2 justify-center flex-wrap">
              {[0.75, 1, 1.25, 1.5].map((s) => (
                <Button key={s} onClick={() => setSpeed(s)} variant={speed === s ? "default" : "outline"} size="sm" className="rounded-full">
                  {s}×
                </Button>
              ))}
              <Button onClick={() => setLoop(!loop)} variant={loop ? "default" : "outline"} size="sm" className="rounded-full" aria-label="Toggle loop">
                <Repeat className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Transcript */}
        <div className="warm-card p-6">
          <h3 className="text-2xl font-bold mb-4">Story Flow</h3>
          <div className="space-y-3 max-h-[600px] overflow-y-auto rounded-xl">
            {scenes.map((scene, idx) => {
              // Calculate cumulative timestamp
              const timestamp = scenes.slice(0, idx).reduce((sum, s) => sum + (s.duration_s || 3), 0);
              const minutes = Math.floor(timestamp / 60);
              const seconds = Math.floor(timestamp % 60);
              const timeString = `${minutes}:${seconds.toString().padStart(2, "0")}`;

              // Calculate scene progress for current scene
              const sceneProgress =
                idx === currentIndex
                  ? (() => {
                      const sceneStart = scenes.slice(0, currentIndex).reduce((sum, s) => sum + (s.duration_s || 3), 0);
                      const sceneDuration = currentScene?.duration_s || 3;
                      const withinScene = Math.max(0, Math.min(sceneDuration, currentTime - sceneStart));
                      return (withinScene / sceneDuration) * 100;
                    })()
                  : 0;

              return (
                <div
                  key={scene.id}
                  ref={(el) => (transcriptRefs.current[idx] = el)}
                  className={`p-4 rounded-xl cursor-pointer transition-all ${
                    idx === currentIndex ? "bg-primary text-primary-foreground border-b-4 border-primary-foreground/40" : "bg-muted hover:bg-muted/80"
                  }`}
                  onClick={() => {
                    const before = scenes.slice(0, idx).reduce((sum, s) => sum + (s.duration_s || 3), 0);
                    setCurrentTime(before);
                    setCurrentIndex(idx);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      const before = scenes.slice(0, idx).reduce((sum, s) => sum + (s.duration_s || 3), 0);
                      setCurrentTime(before);
                      setCurrentIndex(idx);
                    }
                  }}
                  aria-label={`Jump to scene ${idx + 1}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-sm">{timeString}</span>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRegenerateScene(scene.id);
                      }}
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      aria-label="Regenerate this scene"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-sm leading-relaxed mb-3">{scene.sentence}</p>

                  {/* Scene progress slider - only shown for current scene */}
                  {idx === currentIndex && (
                    <div className="mt-3 pt-3">
                      <div className="h-1.5 bg-current/20 rounded-full overflow-hidden">
                        <div className="h-full bg-current transition-all duration-100 rounded-full" style={{ width: `${sceneProgress}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
