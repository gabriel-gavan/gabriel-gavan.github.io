import React from 'react';
import html from './html.js';
import audioService from '../utils/AudioService.js';

const MainScreen = ({ onStart }) => {
  const handleStart = () => {
    audioService.playClick();
    onStart();
  };

  return html`
    <div 
      style=${{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundImage: 'assets/main-title-screen.webp.webp)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10000,
        color: '#fff',
        fontFamily: "'Share Tech Mono', monospace",
        textAlign: 'center'
      }}
    >
      <div 
        style=${{
          background: 'rgba(0, 0, 0, 0.7)',
          padding: '40px 60px',
          borderRadius: '10px',
          border: '2px solid var(--neon-cyan, #00ffff)',
          boxShadow: '0 0 30px rgba(0, 255, 255, 0.3)',
          backdropFilter: 'blur(10px)',
          animation: 'fadeIn 1.5s ease-out'
        }}
      >
        <div 
          style=${{
            fontSize: '4rem',
            fontWeight: 'bold',
            letterSpacing: '5px',
            marginBottom: '10px',
            background: 'linear-gradient(to right, #00ffff, #ff00ff)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: '0 0 10px rgba(0, 255, 255, 0.5)'
          }}
        >
          NEON MYSTERY FILES
        </div>
        <div 
          style=${{
            fontSize: '1.2rem',
            color: 'var(--neon-magenta, #ff00ff)',
            marginBottom: '40px',
            letterSpacing: '2px'
          }}
        >
          CRACK THE CODE. OVERRIDE THE SYSTEM.
        </div>

        <button 
          onClick=${handleStart}
          style=${{
            background: 'none',
            border: '2px solid #00ffff',
            color: '#00ffff',
            padding: '15px 40px',
            fontSize: '1.5rem',
            cursor: 'pointer',
            transition: 'all 0.3s',
            letterSpacing: '3px',
            textTransform: 'uppercase',
            position: 'relative',
            overflow: 'hidden'
          }}
          onMouseOver=${(e) => {
            e.target.style.background = '#00ffff';
            e.target.style.color = '#000';
            e.target.style.boxShadow = '0 0 20px #00ffff';
          }}
          onMouseOut=${(e) => {
            e.target.style.background = 'none';
            e.target.style.color = '#00ffff';
            e.target.style.boxShadow = 'none';
          }}
        >
          INITIALIZE CONNECTION
        </button>
        
        <div style=${{ marginTop: '30px', fontSize: '0.8rem', opacity: 0.6, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>VERSION 1.8.0 - SECURE ENCRYPTION ACTIVE</div>
          <a 
            href="/index.html" 
            style=${{ 
              color: 'var(--neon-cyan, #00ffff)', 
              textDecoration: 'none', 
              fontSize: '0.7rem',
              opacity: 0.8
            }}
          >
            REFRESH HUB [/index.html]
          </a>
        </div>
      </div>

      <style>
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      </style>
    </div>
  `;
};

export default MainScreen;
