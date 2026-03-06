import React from 'react';
import { motion } from 'framer-motion';
import { X, Trophy, Lock } from 'lucide-react';
import html from './html.js';
import { BADGES } from '../data/constants.js';

const AchievementsModal = ({ ownedBadges, onClose }) => {
  return html`
    <div style=${{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.9)',
      zIndex: 2000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backdropFilter: 'blur(10px)',
      padding: '20px'
    }}>
      <${motion.div}
        initial=${{ scale: 0.9, opacity: 0 }}
        animate=${{ scale: 1, opacity: 1 }}
        style=${{
          background: 'rgba(10, 10, 20, 0.95)',
          border: '1px solid var(--neon-cyan)',
          borderRadius: '10px',
          width: '100%',
          maxWidth: '700px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 0 30px rgba(0, 255, 255, 0.2)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <!-- Header -->
        <div style=${{
          padding: '25px',
          borderBottom: '1px solid rgba(0, 255, 255, 0.2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(0, 255, 255, 0.05)'
        }}>
          <div>
            <h2 style=${{ margin: 0, fontFamily: "'Orbitron', sans-serif", fontSize: '1.5rem', color: 'var(--neon-cyan)' }}>
              GRID ACHIEVEMENTS
            </h2>
            <p style=${{ margin: '5px 0 0', fontSize: '0.8rem', opacity: 0.7, letterSpacing: '1px' }}>
              ${ownedBadges.length} / ${BADGES.length} MILESTONES RECOGNIZED
            </p>
          </div>
          <button onClick=${onClose} style=${{ background: 'none', border: 'none', color: 'var(--neon-cyan)', cursor: 'pointer' }}>
            <${X} size=${24} />
          </button>
        </div>

        <!-- Scrollable Content -->
        <div style=${{ padding: '25px', overflowY: 'auto', flex: 1 }}>
          <div style=${{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
            gap: '15px' 
          }}>
            ${BADGES.map(badge => {
              const isOwned = ownedBadges.includes(badge.id);
              return html`
                <div 
                  key=${badge.id}
                  style=${{
                    background: isOwned ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                    border: isOwned ? `1px solid ${badge.color}` : '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '15px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '15px',
                    opacity: isOwned ? 1 : 0.5,
                    position: 'relative',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <div style=${{
                    width: '50px',
                    height: '50px',
                    borderRadius: '50%',
                    background: isOwned ? badge.color : 'rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem',
                    boxShadow: isOwned ? `0 0 15px ${badge.color}` : 'none'
                  }}>
                    ${isOwned ? (badge.isImage ? html`<img src=${badge.icon} style=${{ width: '30px', height: '30px' }} />` : badge.icon) : html`<${Lock} size=${24} />`}
                  </div>
                  <div style=${{ flex: 1 }}>
                    <h4 style=${{ margin: 0, color: isOwned ? '#fff' : '#888', fontSize: '0.9rem', fontFamily: "'Orbitron', sans-serif" }}>
                      ${badge.name}
                    </h4>
                    <p style=${{ margin: '5px 0 0', fontSize: '0.75rem', opacity: isOwned ? 0.7 : 0.4 }}>
                      ${badge.description}
                    </p>
                  </div>
                  ${isOwned && html`
                    <div style=${{ position: 'absolute', top: '8px', right: '8px' }}>
                      <${Trophy} size=${12} color=${badge.color} />
                    </div>
                  `}
                </div>
              `;
            })}
          </div>
        </div>

        <!-- Footer -->
        <div style=${{ 
          padding: '15px 25px', 
          fontSize: '0.7rem', 
          opacity: 0.5, 
          textAlign: 'center',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        }}>
          ACHIEVEMENTS ARE PERMANENTLY RECORDED IN THE NEON ENCRYPTED LEDGER
        </div>
      </${motion.div}>
    </div>
  `;
};

export default AchievementsModal;
