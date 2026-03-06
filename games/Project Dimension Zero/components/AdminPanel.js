import React, { useState } from 'react';
import html from './html.js';
import { generateYearlyPuzzles, generateWeeklyPuzzle } from '../utils/PuzzleGenerator.js';
import { Terminal, Download, RefreshCw, X } from 'lucide-react';

const AdminPanel = ({ onPuzzlesGenerated, onClose }) => {
  const [generatedJson, setGeneratedJson] = useState(null);
  const [numWeeks, setNumWeeks] = useState(52);

  const handleGenerate = () => {
    const puzzles = generateYearlyPuzzles(numWeeks);
    setGeneratedJson(JSON.stringify(puzzles, null, 2));
    onPuzzlesGenerated(puzzles);
  };

  const handleDownload = () => {
    if (!generatedJson) return;
    const blob = new Blob([generatedJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'puzzles.json';
    link.click();
  };

  return html`
    <div style=${{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.95)',
      zIndex: 1000,
      padding: '40px',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      color: '#fff',
      fontFamily: "'Share Tech Mono', monospace"
    }}>
      <div style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style=${{ color: '#00ffff', margin: 0 }}>NEON ADMIN: PUZZLE GENERATOR</h2>
        <button onClick=${onClose} style=${{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
          <${X} size=${32} />
        </button>
      </div>

      <div style=${{ display: 'flex', gap: '20px', alignItems: 'center' }}>
        <span>WEEKS TO GENERATE:</span>
        <input 
          type="number" 
          value=${numWeeks} 
          onChange=${(e) => setNumWeeks(parseInt(e.target.value))}
          style=${{
            background: 'transparent',
            border: '1px solid #00ffff',
            color: '#00ffff',
            padding: '5px 10px',
            width: '80px'
          }}
        />
        <button 
          onClick=${handleGenerate}
          style=${{
            background: '#00ffff',
            color: '#000',
            border: 'none',
            padding: '10px 20px',
            cursor: 'pointer',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}
        >
          <${RefreshCw} size=${16} /> GENERATE PUZZLES
        </button>
        ${generatedJson && html`
          <button 
            onClick=${handleDownload}
            style=${{
              background: '#ff00ff',
              color: '#fff',
              border: 'none',
              padding: '10px 20px',
              cursor: 'pointer',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <${Download} size=${16} /> DOWNLOAD puzzles.json
          </button>
        `}
      </div>

      <div style=${{ flex: 1, overflow: 'auto', background: '#0a0a0a', padding: '20px', border: '1px solid #333' }}>
        <pre style=${{ margin: 0, fontSize: '0.9rem', color: '#39ff14' }}>
          ${generatedJson || '// CLICK GENERATE TO BUILD PUZZLES'}
        </pre>
      </div>

      <div style=${{ opacity: 0.6, fontSize: '0.8rem' }}>
        * AFTER GENERATING AND DOWNLOADING, REPLACE THE /data/puzzles.json FILE WITH THE DOWNLOADED CONTENT.
      </div>
    </div>
  `;
};

export default AdminPanel;