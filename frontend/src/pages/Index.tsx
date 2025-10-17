import heroBackground from '@/assets/hero-background.jpg';

const Index = () => {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${heroBackground})` }}
      >
        {/* Dark overlay for better text readability */}
        <div className="absolute inset-0 bg-black/40" />
      </div>
      
      {/* Content */}
      <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
        <h1 className="mb-6 text-5xl md:text-6xl lg:text-7xl font-bold text-white drop-shadow-lg">
          Welcome to Your Blank App
        </h1>
        <p className="text-xl md:text-2xl text-white/90 drop-shadow-md">
          Start building your amazing project here!
        </p>
      </div>
    </div>
  );
};

export default Index;
