import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, BookOpen, Sparkles, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStoryStore } from '@/store/useStoryStore';
import { BookCard } from '@/components/BookCard';
import { AddBookDialog } from '@/components/AddBookDialog';
import { DyslexiaToggle } from '@/components/DyslexiaToggle';
import { useNavigate } from 'react-router-dom';
import visuraiLogo from '@/assets/visurai-logo-text.png';
import heroBg from '@/assets/hero-background.jpg';

const Library = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { books, deleteBook, loadBook } = useStoryStore();
  const navigate = useNavigate();

  const handleOpenBook = (bookId: string) => {
    loadBook(bookId);
    navigate('/story');
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background image */}
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${heroBg})` }} />
        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-black/55" />
        
        <div className="relative max-w-7xl mx-auto px-4 md:px-8 py-12 md:py-20">
          <div className="flex items-center justify-between mb-12">
            <motion.img 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              src={visuraiLogo} 
              alt="Visur.ai Logo" 
              className="h-10 md:h-14 w-auto"
            />
            <DyslexiaToggle />
          </div>

          <div className="max-w-3xl mx-auto text-center">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="space-y-6"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full text-sm font-medium text-primary">
                <Sparkles className="w-4 h-4" />
                AI-Powered Visual Learning
              </div>
              
              <h1 className="text-5xl md:text-6xl font-bold leading-tight text-white drop-shadow-lg">
                Transform Content Into
                <span className="block bg-gradient-to-r from-primary via-orange-500 to-primary bg-clip-text text-transparent">
                  Visual Understanding
                </span>
              </h1>
              
              <p className="text-lg text-white/90 max-w-2xl mx-auto drop-shadow-md">
                Turn complex concepts into clear visuals. Upload text, paste facts, or start from scratch—watch as AI creates diagrams and visualizations that make learning effortless.
              </p>
              
              <div className="flex flex-wrap gap-4 justify-center">
                <Button 
                  onClick={() => setDialogOpen(true)}
                  size="lg"
                  className="gap-2 text-lg px-8 py-6 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30"
                >
                  <Plus className="w-5 h-5" />
                  Create Visualization
                </Button>
                <Button 
                  onClick={() => navigate('/story')}
                  variant="outline"
                  size="lg"
                  className="gap-2 text-lg px-8 py-6 bg-black/30 backdrop-blur-sm border-white/80 text-white hover:bg-black/50"
                >
                  <Zap className="w-5 h-5" />
                  Try Demo
                </Button>
              </div>

              <div className="flex items-center gap-8 justify-center pt-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                  <span>Instant Generation</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                  <span>Beautiful Visuals</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Library Section */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-8"
        >
          {books.length > 0 && (
            <div>
              <h2 className="text-3xl font-bold mb-2">Your Library</h2>
              <p className="text-muted-foreground mb-6">
                {books.length} {books.length === 1 ? 'visualization' : 'visualizations'} created
              </p>
            </div>
          )}

          {books.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {books.map((book, index) => (
                <motion.div
                  key={book.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * index }}
                >
                  <BookCard
                    {...book}
                    onOpen={() => handleOpenBook(book.id)}
                    onDelete={() => deleteBook(book.id)}
                  />
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 space-y-4">
              <div className="relative inline-block">
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl" />
                <BookOpen className="relative w-20 h-20 mx-auto text-muted-foreground/50" />
              </div>
              <div>
                <h3 className="text-2xl font-semibold mb-2">Your library is empty</h3>
                <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                  Start visualizing complex concepts with AI-generated diagrams. It only takes a few seconds.
                </p>
                <Button 
                  onClick={() => setDialogOpen(true)}
                  size="lg"
                  className="gap-2 shadow-lg shadow-primary/25"
                >
                  <Plus className="w-5 h-5" />
                  Create Your First Visualization
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      <AddBookDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
};

export default Library;
