import { motion } from 'framer-motion';
import { Book, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

type BookCardProps = {
  id: string;
  title: string;
  coverImage: string;
  createdAt: number;
  onOpen: () => void;
  onDelete: () => void;
};

export const BookCard = ({ title, coverImage, createdAt, onOpen, onDelete }: BookCardProps) => {
  const formattedDate = new Date(createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="group relative"
    >
      <div 
        onClick={onOpen}
        className="library-card cursor-pointer overflow-hidden aspect-[3/4] relative"
      >
        <img 
          src={coverImage} 
          alt={title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <div className="absolute bottom-0 left-0 right-0 p-4 text-white transform translate-y-full group-hover:translate-y-0 transition-transform duration-300">
          <h3 className="font-semibold text-lg line-clamp-2">{title}</h3>
          <p className="text-sm text-white/80 mt-1">{formattedDate}</p>
        </div>
      </div>
      <Button
        variant="destructive"
        size="icon"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </motion.div>
  );
};
