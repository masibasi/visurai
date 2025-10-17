import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Scene = {
  id: string;
  sentence: string;
  caption?: string;
  image_url: string;
  duration_s?: number;
  start_sec?: number;
  audio_url?: string;
  source_sentences?: string[];
};

export type Book = {
  id: string;
  title: string;
  coverImage: string;
  createdAt: number;
  inputText: string;
  scenes: Scene[];
  audio_url?: string;
  duration_seconds?: number;
};

type StoryState = {
  scenes: Scene[];
  currentIndex: number;
  isPlaying: boolean;
  speed: number;
  dyslexiaMode: boolean;
  lastInputText: string;
  storyTitle: string;
  books: Book[];
  
  setScenes: (scenes: Scene[]) => void;
  setCurrentIndex: (index: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setSpeed: (speed: number) => void;
  toggleDyslexiaMode: () => void;
  setLastInputText: (text: string) => void;
  setStoryTitle: (title: string) => void;
  addBook: (book: Book) => void;
  deleteBook: (bookId: string) => void;
  loadBook: (bookId: string) => void;
  nextScene: () => void;
  prevScene: () => void;
  reset: () => void;
};

export const useStoryStore = create<StoryState>()(
  persist(
    (set, get) => ({
      scenes: [],
      currentIndex: 0,
      isPlaying: false,
      speed: 1,
      dyslexiaMode: false,
      lastInputText: '',
      storyTitle: '',
      books: [],

      setScenes: (scenes) => set({ scenes, currentIndex: 0 }),
      setCurrentIndex: (index) => set({ currentIndex: index }),
      setIsPlaying: (playing) => set({ isPlaying: playing }),
      setSpeed: (speed) => set({ speed }),
      setStoryTitle: (title) => set({ storyTitle: title }),
      toggleDyslexiaMode: () => {
        const newMode = !get().dyslexiaMode;
        set({ dyslexiaMode: newMode });
        if (newMode) {
          document.body.classList.add('dyslexia-mode');
        } else {
          document.body.classList.remove('dyslexia-mode');
        }
      },
      setLastInputText: (text) => set({ lastInputText: text }),
      addBook: (book) => set((state) => ({ books: [book, ...state.books] })),
      deleteBook: (bookId) => set((state) => ({ 
        books: state.books.filter(b => b.id !== bookId) 
      })),
      loadBook: (bookId) => {
        const book = get().books.find(b => b.id === bookId);
        if (book) {
          set({ 
            scenes: book.scenes, 
            currentIndex: 0,
            lastInputText: book.inputText,
            storyTitle: book.title
          });
        }
      },
      nextScene: () => {
        const { currentIndex, scenes } = get();
        if (currentIndex < scenes.length - 1) {
          set({ currentIndex: currentIndex + 1 });
        } else {
          set({ isPlaying: false });
        }
      },
      prevScene: () => {
        const { currentIndex } = get();
        if (currentIndex > 0) {
          set({ currentIndex: currentIndex - 1 });
        }
      },
      reset: () => set({ scenes: [], currentIndex: 0, isPlaying: false, storyTitle: '' }),
    }),
    {
      name: 'visurai-storage',
      partialize: (state) => ({ 
        lastInputText: state.lastInputText,
        dyslexiaMode: state.dyslexiaMode,
        books: state.books,
        storyTitle: state.storyTitle
      }),
    }
  )
);
