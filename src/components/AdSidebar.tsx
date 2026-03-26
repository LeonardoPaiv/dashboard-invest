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
    <aside className="w-[160px] hidden xl:flex flex-col border-l border-white/5 bg-black/20 overflow-y-auto">
      <div className="text-[10px] uppercase font-bold text-white/20 text-center tracking-wider py-4 border-b border-white/5 bg-white/[0.02]">
        Publicidade
      </div>
      
      {/* Vertical Ad Unit */}
      <div className="flex justify-center p-0">
        <ins className="adsbygoogle"
             style={{ display: 'inline-block', width: '160px', height: '1000px' }}
             data-ad-client="ca-pub-2860097082185976"
             data-ad-slot="7849603497">
        </ins>
      </div>
    </aside>
  );
};
