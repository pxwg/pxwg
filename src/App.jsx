import FluidBackground from './components/FluidBackground';
import { Github, BookOpen, MessageCircle } from 'lucide-react';

function App() {
  return (
    <div className="relative w-full h-screen overflow-hidden font-sans selection:bg-pink-500 selection:text-white text-white">
      
      {/* 1. 背景层：流体组件 */}
      <FluidBackground />

      {/* 2. 内容层：居中布局 */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full h-full p-4 pointer-events-none">
        
        {/* 玻璃卡片：深色背景 + 高斯模糊 = 可读性 */}
        <div className="bg-black/20 backdrop-blur-xl border border-white/10 p-12 rounded-3xl shadow-2xl flex flex-col items-center gap-8 max-w-md w-full pointer-events-auto transition-transform hover:scale-[1.01] duration-500">
          
          {/* 欢迎语 */}
          <div className="text-center drop-shadow-lg">
            <h1 className="text-5xl font-black mb-3 tracking-tight text-white">
              Welcome
            </h1>
            <p className="text-lg font-medium text-white/90 tracking-wide">
              Exploring the Digital Frontier
            </p>
          </div>

          {/* 链接区域 */}
          <div className="flex flex-col gap-4 w-full">
            <SocialLink 
              href="https://github.com/pxwg" 
              icon={<Github size={20} />} 
              label="GitHub" 
            />
            <SocialLink 
              href="https://homeward-sky.top" 
              icon={<BookOpen size={20} />} 
              label="Blog Post" 
            />
            <SocialLink 
              href="https://zhihu.com/people/bu-hui-fei-de-qi-e-71" 
              icon={<MessageCircle size={20} />} 
              label="Zhihu" 
            />
          </div>

        </div>
        
        {/* 底部版权 */}
        <div className="absolute bottom-8 text-black/50 font-medium text-sm mix-blend-overlay">
          © {new Date().getFullYear()} pxwg. All rights reserved.
        </div>
      </div>
    </div>
  );
}

// 链接组件：深色半透明按钮
const SocialLink = ({ href, icon, label }) => {
  return (
    <a 
      href={href} 
      target="_blank" 
      rel="noopener noreferrer"
      className="group flex items-center justify-between px-6 py-4 bg-black/30 hover:bg-black/50 border border-white/10 rounded-xl transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer text-white"
    >
      <div className="flex items-center gap-4">
        <span className="opacity-80 group-hover:opacity-100 transition-opacity">{icon}</span>
        <span className="font-semibold tracking-wide">{label}</span>
      </div>
      <span className="opacity-0 group-hover:opacity-100 transform -translate-x-2 group-hover:translate-x-0 transition-all duration-300 text-white/80">
        →
      </span>
    </a>
  );
};

export default App;
