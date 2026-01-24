import FluidBackground from './components/FluidBackground';

function App() {
  return (
    <div className="relative w-full h-screen overflow-hidden font-sans select-none">
      
      <FluidBackground />

      <div className="relative z-10 flex flex-col items-center justify-center w-full h-full p-4 gap-20">
        
        <div className="group cursor-default transition-transform duration-500 hover:scale-105">
           <h1 className="text-8xl font-black tracking-tighter text-white/90 drop-shadow-[0_5px_15px_rgba(0,0,0,0.2)]">
            Welcome
          </h1>
        </div>

        <div className="flex flex-row gap-16 pointer-events-auto items-center">
          
          <GlowingTextLink 
            href="https://github.com/pxwg" 
            label="Github" 
            glowColor="group-hover:shadow-pink-500/50"
            textColor="group-hover:text-pink-200"
          />
          
          <GlowingTextLink 
            href="https://homeward-sky.top" 
            label="Blog" 
            glowColor="group-hover:shadow-purple-500/50"
            textColor="group-hover:text-purple-200"
          />

          <GlowingTextLink 
            href="https://zhihu.com/people/bu-hui-fei-de-qi-e-71" 
            label="Zhihu" 
            glowColor="group-hover:shadow-cyan-500/50"
            textColor="group-hover:text-cyan-200"
          />
        </div>

        <div className="absolute bottom-10 text-white/50 font-bold text-[10px] tracking-[0.5em] uppercase drop-shadow-sm mix-blend-overlay">
          © {new Date().getFullYear()} pxwg
        </div>
      </div>
    </div>
  );
}

const GlowingTextLink = ({ href, label, glowColor, textColor }) => {
  return (
    <a 
      href={href} 
      target="_blank" 
      rel="noopener noreferrer"
      className="group relative px-4 py-2 cursor-pointer transition-all duration-300"
    >
      <span className={`
        relative z-10 
        text-2xl font-bold tracking-wide 
        text-white/80 
        drop-shadow-[0_1px_3px_rgba(0,0,0,0.2)]
        transition-all duration-300
        group-hover:text-white
        ${textColor}
        ${glowColor}
        group-hover:drop-shadow-[0_0_15px_rgba(255,255,255,0.6)]
      `}>
        {label}
      </span>

      <span className="absoluteTk inset-0 rounded-lg bg-white/0 group-hover:bg-white/5 blur-xl transition-colors duration-500 -z-10" />
    </a>
  );
};

export default App;
