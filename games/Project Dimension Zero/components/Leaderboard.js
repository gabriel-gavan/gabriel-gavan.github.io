import React, { useMemo } from 'react';
import html from './html.js';
import { Trophy, Clock, User, X } from 'lucide-react';
import { motion } from 'framer-motion';

const Leaderboard = ({ puzzle, userBestTime, onClose }) => {
  const mockPlayers = useMemo(() => {
    const names = ["ZeroCool", "AcidBurn", "CerealKiller", "LordNikon", "ThePlague", "PhantomPhreak"];
    return names.map((name, i) => ({
      name,
      time: 15 + Math.floor(Math.random() * 45) + (i * 10),
      rank: i + 1
    }));
  }, [puzzle.id]);

  const allPlayers = useMemo(() => {
    const players = [...mockPlayers];
    if (userBestTime) {
      players.push({ name: "YOU (YOU)", time: userBestTime, isUser: true });
    }
    return players.sort((a, b) => a.time - b.time).map((p, i) => ({ ...p, rank: i + 1 }));
  }, [mockPlayers, userBestTime]);

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
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontFamily: "'Share Tech Mono', monospace"
    }}>
      <${motion.div} 
        initial=${{ opacity: 0, y: 20 }}
        animate=${{ opacity: 1, y: 0 }}
        style=${{
          maxWidth: '500px',
          width: '100%',
          background: '#0a0a0a',
          border: '1px solid #00ffff',
          padding: '30px',
          borderRadius: '5px',
          position: 'relative',
          boxShadow: '0 0 20px rgba(0, 255, 255, 0.2)'
        }}
      >
        <button onClick=${onClose} style=${{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
          <${X} size=${24} />
        </button>

        <div style=${{ textAlign: 'center', marginBottom: '30px' }}>
          <${Trophy} color="#fefe33" size=${48} style=${{ marginBottom: '10px' }} />
          <h2 style=${{ color: '#00ffff', margin: 0, fontFamily: "'Orbitron', sans-serif" }}>GLOBAL LEADERBOARD</h2>
          <p style=${{ opacity: 0.6, fontSize: '0.9rem' }}>TOP TIMES FOR: ${puzzle.title}</p>
        </div>

        <div style=${{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style=${{ display: 'flex', padding: '10px', borderBottom: '1px solid #333', opacity: 0.6, fontSize: '0.8rem' }}>
            <span style=${{ width: '40px' }}>RANK</span>
            <span style=${{ flex: 1 }}>AGENT ID</span>
            <span style=${{ width: '80px', textAlign: 'right' }}>SOLVE TIME</span>
          </div>

          ${allPlayers.slice(0, 8).map(player => html`
            <div 
              key=${player.name}
              style=${{ 
                display: 'flex', 
                padding: '12px 10px', 
                background: player.isUser ? 'rgba(0, 255, 255, 0.1)' : 'transparent',
                border: player.isUser ? '1px solid #00ffff' : 'none',
                borderRadius: '3px',
                color: player.isUser ? '#00ffff' : '#fff'
              }}
            >
              <span style=${{ width: '40px', opacity: 0.6 }}>#${player.rank}</span>
              <span style=${{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <${User} size=${14} /> ${player.name}
              </span>
              <span style=${{ width: '80px', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '5px' }}>
                <${Clock} size=${14} /> ${player.time}s
              </span>
            </div>
          `)}
        </div>

        <div style=${{ marginTop: '30px', textAlign: 'center', fontSize: '0.8rem', opacity: 0.5 }}>
          * TIMES ARE UPDATED IN REAL-TIME FROM THE NEON GRID.
        </div>
      </${motion.div}>
    </div>
  `;
};

export default Leaderboard;