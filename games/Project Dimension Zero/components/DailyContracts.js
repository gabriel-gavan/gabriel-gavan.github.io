import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Target, Zap, Clock, ShieldCheck, Trophy, Info } from 'lucide-react';
import html from './html.js';

const CONTRACT_TYPES = [
  { id: 'SOLVE_ANY', label: 'NEURAL BREAK', desc: 'Solve any active terminal node.', reward: 50, icon: Target },
  { id: 'HACK_SUCCESS', label: 'SYSTEM OVERRIDE', desc: 'Successfully hack any encrypted node.', reward: 75, icon: Zap },
  { id: 'SPEED_RUN', label: 'FAST BYPASS', desc: 'Solve a terminal in under 45 seconds.', reward: 100, icon: Clock },
  { id: 'NO_HINT', label: 'PURIST DECRYPTION', desc: 'Complete a terminal without using any hints.', reward: 120, icon: ShieldCheck },
  { id: 'SHARD_COLLECTOR', label: 'DATA HARVEST', desc: 'Collect 100 total shards today.', reward: 60, icon: Trophy }
];

const DailyContracts = ({ contracts, onClaimReward, onClose }) => {
  return html`
    <${motion.div}
      initial=${{ opacity: 0 }}
      animate=${{ opacity: 1 }}
      exit=${{ opacity: 0 }}
      style=${{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.9)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(10px)',
        padding: '20px'
      }}
    >
      <${motion.div}
        initial=${{ scale: 0.9, y: 20 }}
        animate=${{ scale: 1, y: 0 }}
        style=${{
          background: 'rgba(10, 10, 20, 0.95)',
          border: '1px solid var(--neon-magenta)',
          borderRadius: '10px',
          width: '100%',
          maxWidth: '600px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 0 30px rgba(255, 0, 255, 0.2)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <!-- Header -->
        <div style=${{
          padding: '25px',
          borderBottom: '1px solid rgba(255, 0, 255, 0.2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(255, 0, 255, 0.05)'
        }}>
          <div>
            <h2 style=${{ margin: 0, fontFamily: "'Orbitron', sans-serif", fontSize: '1.5rem', color: '#ff00ff' }}>
              DAILY CONTRACTS
            </h2>
            <p style=${{ margin: '5px 0 0', fontSize: '0.8rem', opacity: 0.7, letterSpacing: '1px' }}>
              LIMITED-TIME HACKING OBJECTIVES
            </p>
          </div>
          <button onClick=${onClose} style=${{ background: 'none', border: 'none', color: '#ff00ff', cursor: 'pointer' }}>
            <${X} size=${24} />
          </button>
        </div>

        <!-- Scrollable Content -->
        <div style=${{ padding: '25px', overflowY: 'auto', flex: 1 }}>
          <div style=${{ display: 'grid', gap: '20px' }}>
            ${contracts.map((contract, index) => {
              const typeInfo = CONTRACT_TYPES.find(t => t.id === contract.type);
              const isClaimed = contract.claimed;
              const isCompleted = contract.progress >= contract.requirement;
              const progressPercent = Math.min(100, (contract.progress / contract.requirement) * 100);

              return html`
                <div 
                  key=${index}
                  style=${{
                    background: isClaimed ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 0, 255, 0.05)',
                    border: isClaimed ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(255, 0, 255, 0.2)',
                    borderRadius: '8px',
                    padding: '20px',
                    position: 'relative',
                    transition: 'all 0.3s ease',
                    opacity: isClaimed ? 0.6 : 1
                  }}
                >
                  <div style=${{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                    <div style=${{
                      padding: '12px',
                      background: 'rgba(255, 0, 255, 0.1)',
                      borderRadius: '8px',
                      color: isCompleted ? '#39ff14' : '#ff00ff'
                    }}>
                      <${typeInfo.icon} size=${28} />
                    </div>
                    <div style=${{ flex: 1 }}>
                      <div style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <h4 style=${{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>${typeInfo.label}</h4>
                        <span style=${{ 
                          fontSize: '0.9rem', 
                          color: '#39ff14', 
                          fontWeight: 'bold', 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '4px' 
                        }}>
                          +${typeInfo.reward} <span style=${{ fontSize: '0.7rem' }}>SHARDS</span>
                        </span>
                      </div>
                      <p style=${{ margin: '5px 0 15px', fontSize: '0.85rem', opacity: 0.7 }}>${typeInfo.desc}</p>
                      
                      <!-- Progress Bar -->
                      <div style=${{ height: '6px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '3px', overflow: 'hidden', marginBottom: '8px' }}>
                        <div style=${{ 
                          width: `${progressPercent}%`, 
                          height: '100%', 
                          background: isCompleted ? '#39ff14' : 'var(--neon-magenta)',
                          boxShadow: isCompleted ? '0 0 10px #39ff14' : 'none',
                          transition: 'width 0.5s ease-out'
                        }} />
                      </div>
                      <div style=${{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
                        <span style=${{ opacity: 0.5 }}>STATUS: ${isCompleted ? 'STABLE' : 'PENDING'}</span>
                        <span style=${{ color: isCompleted ? '#39ff14' : '#ff00ff' }}>${contract.progress} / ${contract.requirement}</span>
                      </div>
                    </div>
                  </div>

                  ${isCompleted && !isClaimed && html`
                    <${motion.button}
                      whileHover=${{ scale: 1.05 }}
                      whileTap=${{ scale: 0.95 }}
                      onClick=${() => onClaimReward(index)}
                      style=${{
                        marginTop: '15px',
                        width: '100%',
                        padding: '10px',
                        background: '#39ff14',
                        color: '#000',
                        border: 'none',
                        borderRadius: '4px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        fontFamily: "'Share Tech Mono', monospace"
                      }}
                    >
                      CLAIM REWARD
                    </${motion.button}>
                  `}

                  ${isClaimed && html`
                    <div style=${{ 
                      marginTop: '15px', 
                      textAlign: 'center', 
                      color: '#39ff14', 
                      fontSize: '0.8rem',
                      fontFamily: "'Share Tech Mono', monospace"
                    }}>
                      CONTRACT FULFILLED [√]
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
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px'
        }}>
          <${Info} size=${12} />
          NEW CONTRACTS WILL BE ASSIGNED IN 24 HOURS
        </div>
      </${motion.div}>
    </${motion.div}>
  `;
};

export default DailyContracts;
