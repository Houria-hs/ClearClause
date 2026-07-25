import React from 'react';
import grainImage from "../assets/grains.png"

const PremiumButton = ({ text, onClick, className = "", disabled = false }) => {
  return ( 
    <div className={`animate-in fade-in slide-in-from-bottom-4 duration-500 transition-transform hover:-translate-y-1 ${className}`}>
          <button
            onClick={onClick}
            disabled={disabled}
            className="
              relative w-full py-4 rounded-[12px] 
              leading-[20px]
              text-[16px]
              font-['Sora'] font-normal text-white text-[17px]
              transition-all duration-200 active:scale-[0.97]
              overflow-hidden
              /* Base Linear Gradient from Figma styllee.png */
              bg-gradient-to-b from-[#0073FF] to-[#0DA2FF] disabled:cursor-not-allowed disabled:opacity-50
            "
            style={{
              /* Layered Shadows from Figma stylle.png & style2.png */
              boxShadow: `
                0px 10.27px 13.4px 0px rgba(87, 177, 255, 0.22), 
                inset 0px 1px 4px 2px #D2EAFF,
                inset 0px 1px 18px 2px #D2EAFF
              `
            }}
          >
            {/* 3. The Grain Layer */}
            <div 
              className="absolute inset-0 pointer-events-none opacity-[0.22]"
              style={{
                backgroundImage: `url(${grainImage})`, 
                backgroundSize: '200px',               
                mixBlendMode: 'overlay',               
                webkitMixBlendMode: 'overlay' ,
              }}
            />
    
            {/* 4. Top Edge "Glass" Highlight (Inner Glow) */}
            <div className="absolute inset-x-0 top-0 h-[1.5px] bg-white/30 rounded-t-[18px]" />
    
            {/* 5. Inner Bottom Shadow for depth */}
            <div className="absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-black/5 to-transparent rounded-b-[18px]" />
    
            <span className="relative z-10 tracking-wide drop-shadow-sm">
                {text}
            </span>
          </button>
    </div>
  );
};

export default PremiumButton;
