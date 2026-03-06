import React, { useMemo } from 'react';
import html from './html.js';

const GridBackground = ({ variant = 'city' }) => {
  const cityBgUrl = 'assets/neon-city-background.png.webp?e2IU';
  const terminalBgUrl = 'assets/cyber-terminal-bg.png.webp?Q6rP';

  const gridLines = useMemo(() => {
    const lines = [];
    for (let i = 0; i < 50; i++) {
      lines.push(
        html`<div key=${`h-${i}`} style=${{
          position: 'absolute',
          top: `${i * 2}%`,
          left: 0,
          right: 0,
          height: '1px',
          background: 'rgba(0, 255, 255, 0.15)',
          zIndex: -1
        }} />`
      );
      lines.push(
        html`<div key=${`v-${i}`} style=${{
          position: 'absolute',
          left: `${i * 2}%`,
          top: 0,
          bottom: 0,
          width: '1px',
          background: 'rgba(0, 255, 255, 0.15)',
          zIndex: -1
        }} />`
      );
    }
    return lines;
  }, []);

  return html`
    <div style=${{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      overflow: 'hidden',
      zIndex: -2,
      pointerEvents: 'none',
      background: `url(${variant === 'city' ? cityBgUrl : terminalBgUrl}) no-repeat center center`,
      backgroundSize: 'cover',
      filter: 'brightness(0.4) contrast(1.2)'
    }}>
      <div style=${{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'radial-gradient(circle, rgba(0,0,0,0) 0%, rgba(0,0,0,0.8) 100%)',
        zIndex: -1
      }} />
      ${gridLines}
    </div>
  `;
};

export default GridBackground;