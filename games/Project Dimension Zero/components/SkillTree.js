import React from 'react';
import html from './html.js';
import { X, Cpu, Zap, Lock, Unlock, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { SKILLS } from '../data/constants.js';

const SkillTree = ({ userSkills, shards, onUpgrade, onClose }) => {
  return html`
    <div style=${{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.95)',
      zIndex: 2500,
      padding: '40px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontFamily: "'Share Tech Mono', monospace"
    }}>
      <${motion.div} 
        initial=${{ scale: 0.9, opacity: 0 }}
        animate=${{ scale: 1, opacity: 1 }}
        style=${{
          maxWidth: '800px',
          width: '100%',
          background: '#0a0a0a',
          border: '1px solid #39ff14',
          padding: '30px',
          borderRadius: '5px',
          position: 'relative',
          boxShadow: '0 0 30px rgba(57, 255, 20, 0.2)'
        }}
      >
        <button onClick=${onClose} style=${{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
          <${X} size=${24} />
        </button>

        <div style=${{ textAlign: 'center', marginBottom: '40px' }}>
          <div style=${{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', marginBottom: '10px' }}>
            <${Cpu} color="#39ff14" size=${40} />
            <h2 style=${{ color: '#39ff14', margin: 0, fontFamily: "'Orbitron', sans-serif", fontSize: '1.8rem' }}>SKILL TREE</h2>
          </div>
          <div style=${{ display: 'inline-flex', alignItems: 'center', gap: '10px', background: 'rgba(57, 255, 20, 0.1)', padding: '5px 15px', borderRadius: '20px', border: '1px solid #39ff14' }}>
            <span style=${{ color: '#39ff14' }}>NEON SHARDS: ${shards}</span>
          </div>
        </div>

        <div style=${{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }}>
          ${SKILLS.map(skill => {
            const currentLevel = userSkills[skill.id] || 0;
            const isMaxed = currentLevel >= skill.maxLevel;
            const cost = skill.costPerLevel * (currentLevel + 1);
            const canAfford = shards >= cost;

            return html`
              <div 
                key=${skill.id}
                style=${{
                  padding: '20px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: `1px solid ${isMaxed ? '#fefe33' : '#39ff14'}`,
                  borderRadius: '5px',
                  opacity: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                <div style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style=${{ fontSize: '1.5rem' }}>${skill.icon}</span>
                  <div style=${{ display: 'flex', gap: '3px' }}>
                    ${Array.from({ length: skill.maxLevel }).map((_, i) => html`
                      <div key=${i} style=${{
                        width: '10px',
                        height: '10px',
                        borderRadius: '2px',
                        background: i < currentLevel ? '#39ff14' : 'rgba(57, 255, 20, 0.2)',
                        border: '1px solid #39ff14'
                      }} />
                    `)}
                  </div>
                </div>
                
                <h3 style=${{ margin: 0, fontSize: '1rem', color: '#39ff14' }}>${skill.name}</h3>
                <p style=${{ fontSize: '0.7rem', opacity: 0.7, margin: 0, flex: 1 }}>${skill.description}</p>

                ${!isMaxed ? html`
                  <button 
                    onClick=${() => onUpgrade(skill.id, cost)}
                    disabled=${!canAfford}
                    style=${{
                      marginTop: '10px',
                      background: canAfford ? '#39ff14' : 'transparent',
                      color: canAfford ? '#000' : '#39ff14',
                      border: '1px solid #39ff14',
                      padding: '8px',
                      cursor: canAfford ? 'pointer' : 'not-allowed',
                      fontFamily: 'inherit',
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      opacity: canAfford ? 1 : 0.5
                    }}
                  >
                    UPGRADE (${cost} SHARDS)
                  </button>
                ` : html`
                  <div style=${{ marginTop: '10px', color: '#fefe33', fontSize: '0.8rem', textAlign: 'center', fontWeight: 'bold' }}>
                    MAX LEVEL REACHED
                  </div>
                `}
              </div>
            `;
          })}
        </div>

        <div style=${{ marginTop: '40px', padding: '15px', background: 'rgba(57, 255, 20, 0.05)', borderRadius: '3px', fontSize: '0.8rem', opacity: 0.8 }}>
          <div style=${{ display: 'flex', alignItems: 'center', gap: '10px', color: '#39ff14' }}>
            <${TrendingUp} size=${16} />
            <span>SOLVE PUZZLES AND HACK NODES TO EARN NEON SHARDS.</span>
          </div>
        </div>
      </${motion.div}>
    </div>
  `;
};

export default SkillTree;