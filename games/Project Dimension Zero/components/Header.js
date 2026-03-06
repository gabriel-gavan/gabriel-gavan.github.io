import React from 'react';
import { Terminal, Award, UserCircle, BarChart2, Cpu, ShoppingBag, Trophy, Home } from 'lucide-react';
import html from './html.js';

const Header = ({ onProfileClick, onLeaderboardClick, onSkillTreeClick, onShopClick, onAchievementsClick, profile, shards }) => {
  return html`
    <header style=${{
      padding: '20px',
      borderBottom: '2px solid rgba(0, 255, 255, 0.3)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      background: 'rgba(0,0,0,0.8)',
      backdropFilter: 'blur(10px)',
      position: 'sticky',
      top: 0,
      zIndex: 50
    }}>
      <div style=${{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <a 
          href="/index.html" 
          style=${{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px', 
            textDecoration: 'none',
            color: 'inherit'
          }}
          title="Return to Hub"
        >
          <${Terminal} className="neon-glow-cyan" size=${32} color="#00ffff" />
          <h1 className="neon-glow-cyan" style=${{ 
            margin: 0, 
            fontSize: '1.5rem', 
            fontFamily: "'Orbitron', sans-serif",
            letterSpacing: '2px',
            color: '#00ffff'
          }}>
            NEON MYSTERY FILES
          </h1>
        </a>
        <a 
          href="/index.html"
          style=${{
            background: 'rgba(0, 255, 255, 0.1)',
            border: '1px solid rgba(0, 255, 255, 0.5)',
            color: '#00ffff',
            padding: '4px 12px',
            borderRadius: '4px',
            fontSize: '0.7rem',
            textDecoration: 'none',
            fontFamily: "'Share Tech Mono', monospace",
            letterSpacing: '1px',
            transition: 'all 0.3s'
          }}
          onMouseOver=${(e) => { e.target.style.background = 'rgba(0, 255, 255, 0.2)'; e.target.style.boxShadow = '0 0 10px rgba(0, 255, 255, 0.3)'; }}
          onMouseOut=${(e) => { e.target.style.background = 'rgba(0, 255, 255, 0.1)'; e.target.style.boxShadow = 'none'; }}
        >
          BACK TO HUB [/index.html]
        </a>
      </div>
      <div style=${{ display: 'flex', gap: '30px', alignItems: 'center' }}>
        <div style=${{ display: 'flex', gap: '15px', fontSize: '0.9rem' }}>
          <button 
            onClick=${onShopClick}
            style=${{
              background: 'none',
              border: 'none',
              color: '#fefe33',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: '0.9rem',
              opacity: 0.8,
              transition: 'opacity 0.2s'
            }}
          >
            <${ShoppingBag} size=${18} /> SHOP
          </button>
          <button 
            onClick=${onSkillTreeClick}
            style=${{
              background: 'none',
              border: 'none',
              color: '#39ff14',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: '0.9rem',
              opacity: 0.8,
              transition: 'opacity 0.2s'
            }}
          >
            <${Cpu} size=${18} /> SKILLS [${shards} 💎]
          </button>
          <button 
            onClick=${onAchievementsClick}
            style=${{
              background: 'none',
              border: 'none',
              color: '#ff00ff',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: '0.9rem',
              opacity: 0.8,
              transition: 'opacity 0.2s'
            }}
          >
            <${Trophy} size=${18} /> BADGES
          </button>
          <button 
            onClick=${onLeaderboardClick}
            style=${{
              background: 'none',
              border: 'none',
              color: '#00ffff',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: '0.9rem',
              opacity: 0.8,
              transition: 'opacity 0.2s'
            }}
          >
            <${BarChart2} size=${18} /> LEADERBOARD
          </button>
        </div>
        <button 
          onClick=${onProfileClick}
          style=${{
            background: 'rgba(255, 0, 255, 0.1)',
            border: '1px solid #ff00ff',
            color: '#ff00ff',
            padding: '5px 15px',
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer',
            fontFamily: "'Share Tech Mono', monospace"
          }}
        >
          <img src=${profile.avatar} style=${{ width: '24px', height: '24px', borderRadius: '50%' }} />
          ${profile.name.toUpperCase()}
        </button>
      </div>
    </header>
  `;
};

export default Header;