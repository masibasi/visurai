import { useStoryStore } from '@/store/useStoryStore';
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';

export function DyslexiaToggle() {
  const { dyslexiaMode, toggleDyslexiaMode } = useStoryStore();

  return (
    <Button
      onClick={toggleDyslexiaMode}
      variant={dyslexiaMode ? 'default' : 'outline'}
      size="sm"
      className="rounded-full"
      aria-label="Toggle dyslexia-friendly mode"
      aria-pressed={dyslexiaMode}
    >
      <Eye className="w-4 h-4 mr-2" />
      Dyslexia Mode
    </Button>
  );
}
