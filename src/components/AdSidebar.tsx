import React, { useEffect } from 'react';

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

export const AdSidebar: React.FC = () => {
  useEffect(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      console.error('Erro ao carregar Google Ads:', e);
    }
  }, []);

  return (
    <aside className="w-[160px] hidden xl:flex flex-col border-l border-white/5 bg-black/20 p-4 gap-4 overflow-y-auto">
      <div className="text-[10px] uppercase font-bold text-white/20 text-center tracking-wider mb-2">
        Anúncios
      </div>
      
      {/* Google Ads Unit */}
      <ins className="adsbygoogle"
           style={{ display: 'block' }}
           data-ad-client="ca-pub-2860097082185976"
           data-ad-slot="2558607577"
           data-ad-format="auto"
           data-full-width-responsive="true">
      </ins>

      {/* Placeholder for visual consistency while ad loads */}
      <div className="w-full h-screen max-h-[600px] flex items-center justify-center border border-white/5 rounded-lg bg-white/[0.02]">
         <span className="text-[10px] text-white/10 rotate-90 whitespace-nowrap">Propaganda</span>
      </div>
    </aside>
  );
};
