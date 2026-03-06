import React from 'react';
import { Lock, Unlock, CheckCircle2, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import html from './html.js';

const TerminalHub = ({ puzzles, completedPuzzles, onSelect, onHack, onOpenContracts, completedDailyCount }) => {
  return html`
    <div style=${{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
      <!-- Daily Contracts Banner -->
      <${motion.div}
        whileHover=${{ scale: 1.01 }}
        onClick=${onOpenContracts}
        style=${{
          background: 'linear-gradient(90deg, rgba(255, 0, 255, 0.1) 0%, rgba(0, 255, 255, 0.1) 100%)',
          border: '1px solid var(--neon-magenta)',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '30px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          boxShadow: '0 0 15px rgba(255, 0, 255, 0.1)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div style=${{ display: 'flex', alignItems: 'center', gap: '20px', position: 'relative', zIndex: 1 }}>
          <div style=${{ 
            background: 'rgba(255, 0, 255, 0.2)', 
            padding: '10px', 
            borderRadius: '5px',
            color: '#ff00ff' 
          }}>
            <${Zap} size=${32} />
          </div>
          <div>
            <h3 style=${{ margin: 0, fontFamily: "'Orbitron', sans-serif", fontSize: '1.2rem', color: '#fff' }}>
              DAILY CONTRACTS BOARD
            </h3>
            <p style=${{ margin: '5px 0 0', fontSize: '0.85rem', opacity: 0.8, color: '#00ffff' }}>
              ${completedDailyCount > 0 ? `YOU HAVE ${completedDailyCount} REWARDS WAITING!` : 'COMPLETE DAILY OBJECTIVES FOR BONUS SHARDS.'}
            </p>
          </div>
        </div>
        
        <div style=${{ 
          padding: '8px 15px', 
          background: completedDailyCount > 0 ? '#39ff14' : 'rgba(255, 255, 255, 0.1)', 
          color: completedDailyCount > 0 ? '#000' : '#fff',
          borderRadius: '4px',
          fontSize: '0.75rem',
          fontFamily: "'Share Tech Mono', monospace",
          fontWeight: 'bold',
          letterSpacing: '1px'
        }}>
          ${completedDailyCount > 0 ? 'CLAIM NOW' : 'VIEW BOARD'}
        </div>

        <!-- Decorative elements -->
        <div style=${{ 
          position: 'absolute', 
          right: '-20px', 
          top: '-20px', 
          width: '100px', 
          height: '100px', 
          background: 'rgba(255, 0, 255, 0.05)', 
          borderRadius: '50%',
          filter: 'blur(30px)'
        }} />
      </${motion.div}>

      <div style=${{ marginBottom: '40px', borderBottom: '1px solid rgba(0, 255, 255, 0.2)', paddingBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h2 className="neon-glow-magenta" style=${{ 
            margin: 0, 
            fontSize: '2rem', 
            fontFamily: "'Orbitron', sans-serif" 
          }}>
            ACTIVE TERMINALS
          </h2>
          <p style=${{ color: '#00ffff', opacity: 0.7, margin: '5px 0 0' }}>SELECT A TERMINAL TO BEGIN INVESTIGATION.</p>
        </div>
        <a 
          href="/index.html"
          style=${{
            background: 'rgba(0, 255, 255, 0.1)',
            border: '1px solid rgba(0, 255, 255, 0.5)',
            color: '#00ffff',
            padding: '6px 15px',
            borderRadius: '4px',
            fontSize: '0.8rem',
            textDecoration: 'none',
            fontFamily: "'Share Tech Mono', monospace",
            letterSpacing: '1px',
            transition: 'all 0.3s'
          }}
          onMouseOver=${(e) => { e.target.style.background = 'rgba(0, 255, 255, 0.2)'; e.target.style.boxShadow = '0 0 10px rgba(0, 255, 255, 0.3)'; }}
          onMouseOut=${(e) => { e.target.style.background = 'rgba(0, 255, 255, 0.1)'; e.target.style.boxShadow = 'none'; }}
        >
          BACK TO HUB
        </a>
      </div>

      <div style=${{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
        gap: '30px' 
      }}>
        ${puzzles.map((puzzle, index) => {
          const isCompleted = completedPuzzles.includes(puzzle.id);
          const isLocked = puzzle.locked;

          return html`
            <${motion.div}
              key=${puzzle.id}
              whileHover=${!isLocked || isLocked ? { scale: 1.05 } : {}}
              onClick=${() => !isLocked ? onSelect(puzzle) : null}
              className=${!isLocked ? 'neon-border-cyan' : ''}
              style=${{
                background: 'rgba(0, 255, 255, 0.05)',
                padding: '30px',
                borderRadius: '5px',
                cursor: isLocked ? 'default' : 'pointer',
                opacity: isLocked ? 0.7 : 1,
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'all 0.3s ease',
                border: isLocked ? '1px solid rgba(255, 0, 255, 0.3)' : '1px solid var(--neon-cyan)',
                minHeight: '220px',
                boxShadow: isLocked ? 'inset 0 0 10px rgba(255, 0, 255, 0.1)' : 'none'
              }}
            >
              <div style=${{ position: 'absolute', top: '10px', right: '10px' }}>
                ${isCompleted ? html`<${CheckCircle2} color="#39ff14" size=${24} />` : 
                  isLocked ? html`<${Lock} color="#ff00ff" size=${24} />` : 
                  html`<${Unlock} color="#00ffff" size=${24} />`}
              </div>

              <div>
                <span style=${{ fontSize: '0.8rem', color: isLocked ? '#ff00ff' : '#ff00ff', letterSpacing: '2px' }}>
                  WEEK ${puzzle.unlockWeek} ${isLocked ? html`<span style=${{ fontSize: '0.6rem', color: '#ff00ff', marginLeft: '10px' }}>[ENCRYPTED]</span>` : ''}
                </span>
                <h3 style=${{ 
                  margin: '10px 0', 
                  fontSize: '1.2rem', 
                  color: isLocked ? '#fff' : '#fff',
                  fontFamily: "'Orbitron', sans-serif"
                }}>
                  ${isLocked ? 'NODE: ENCRYPTED' : puzzle.title}
                </h3>
                <p style=${{ fontSize: '0.9rem', opacity: 0.6, margin: 0 }}>
                  ${isLocked ? "ACCESS DENIED. HIGH-LEVEL ENCRYPTION DETECTED." : puzzle.description}
                </p>
              </div>

              <div style=${{ marginTop: '20px', borderTop: '1px solid rgba(0, 255, 255, 0.2)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style=${{ fontSize: '0.7rem', color: isLocked ? '#ff00ff' : '#00ffff' }}>
                  ${isCompleted ? 'INVESTIGATION COMPLETE' : isLocked ? 'SECURE NODE' : 'CLICK TO CONNECT'}
                </span>
                ${isLocked && html`
                  <button 
                    onClick=${(e) => { e.stopPropagation(); onHack(puzzle); }}
                    style=${{
                      background: '#ff00ff',
                      color: '#fff',
                      border: 'none',
                      padding: '5px 12px',
                      borderRadius: '3px',
                      fontSize: '0.7rem',
                      fontFamily: "'Share Tech Mono', monospace",
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      boxShadow: '0 0 5px #ff00ff'
                    }}
                  >
                    <${Zap} size=${12} /> HACK NODE
                  </button>
                `}
              </div>
            </${motion.div}>
          `;
        })}
      </div>
    </div>
  `;
};

export default TerminalHub;