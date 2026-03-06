import React, { useMemo, useState } from 'react';
import html from './html.js';
import { Trophy, Clock, User, X, Zap, Target, Star, BarChart3, Signal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const GlobalLeaderboard = ({ userSolveTimes, completedPuzzles = [], puzzles, onClose }) => {
  const [activeTab, setActiveTab] = useState('FASTEST'); // 'FASTEST', 'POPULAR', 'MAX_WEEK'

  const fastestSolves = useMemo(() => {
    const mockData = [
      { name: "ZeroCool", puzzle: "Week 1", time: 12 },
      { name: "AcidBurn", puzzle: "Week 3", time: 14 },
      { name: "CerealKiller", puzzle: "Week 2", time: 18 },
      { name: "LordNikon", puzzle: "Week 1", time: 22 },
      { name: "ThePlague", puzzle: "Week 4", time: 25 }
    ];

    const solveEntries = Object.entries(userSolveTimes || {});
    if (solveEntries.length > 0) {
      const bestEntry = solveEntries.sort((a, b) => a[1] - b[1])[0];
      const puzzleTitle = puzzles.find(p => p.id === bestEntry[0])?.title || bestEntry[0];
      mockData.push({ name: "YOU (YOU)", puzzle: puzzleTitle, time: bestEntry[1], isUser: true });
    }

    return mockData.sort((a, b) => a.time - b.time).slice(0, 10);
  }, [userSolveTimes, puzzles]);

  const popularityData = useMemo(() => {
    const mockData = [
      { week: 1, name: "Neural Break", clears: 1245 },
      { week: 2, name: "Core Sync", clears: 1022 },
      { week: 3, name: "Darknet", clears: 843 },
      { week: 4, name: "Database", clears: 754 },
      { week: 5, name: "Binary Stream", clears: 642 }
    ];

    // Add user's contribution by incrementing clears for puzzles they've solved
    const userCompletedWeeks = completedPuzzles.map(id => {
      const puzzle = puzzles.find(p => p.id === id);
      return puzzle ? puzzle.unlockWeek : null;
    }).filter(Boolean);

    return mockData.map(item => ({
      ...item,
      clears: userCompletedWeeks.includes(item.week) ? item.clears + 1 : item.clears,
      isUserIncluded: userCompletedWeeks.includes(item.week)
    })).sort((a, b) => b.clears - a.clears);
  }, [completedPuzzles, puzzles]);

  const maxWeekLeaderboard = useMemo(() => {
    const mockData = [
      { name: "Phantom_01", maxWeek: 15 },
      { name: "Void_Walker", maxWeek: 12 },
      { name: "Signal_Ghost", maxWeek: 11 },
      { name: "Cyber_Wraith", maxWeek: 9 },
      { name: "Data_Shadow", maxWeek: 7 }
    ];

    const userMaxWeek = (completedPuzzles || []).reduce((max, id) => {
      const puzzle = puzzles.find(p => p.id === id);
      return puzzle ? Math.max(max, puzzle.unlockWeek) : max;
    }, 0);

    if (userMaxWeek > 0) {
      mockData.push({ name: "YOU (AGENT)", maxWeek: userMaxWeek, isUser: true });
    }

    return mockData.sort((a, b) => b.maxWeek - a.maxWeek).slice(0, 10);
  }, [completedPuzzles, puzzles]);

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
        initial=${{ scale: 0.9, opacity: 0 }}
        animate=${{ scale: 1, opacity: 1 }}
        style=${{
          maxWidth: '700px',
          width: '100%',
          background: '#0a0a0a',
          border: '1px solid var(--neon-cyan)',
          padding: '30px',
          borderRadius: '5px',
          position: 'relative',
          boxShadow: '0 0 30px rgba(0, 255, 255, 0.2)'
        }}
      >
        <button onClick=${onClose} style=${{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
          <${X} size=${24} />
        </button>

        <div style=${{ textAlign: 'center', marginBottom: '30px' }}>
          <div style=${{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', marginBottom: '10px' }}>
            <${Trophy} color="#fefe33" size=${40} />
            <h2 style=${{ color: 'var(--neon-cyan)', margin: 0, fontFamily: "'Orbitron', sans-serif", fontSize: '1.8rem' }}>HALL OF AGENTS</h2>
          </div>
          <p style=${{ opacity: 0.6 }}>GLOBAL RECOGNITION FOR ELITE GRID OPERATORS</p>
        </div>

        <!-- Tab Navigation -->
        <div style=${{ 
          display: 'flex', 
          gap: '10px', 
          marginBottom: '20px', 
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          paddingBottom: '10px'
        }}>
          ${[
            { id: 'FASTEST', label: 'SPEED', icon: Zap },
            { id: 'POPULAR', label: 'NODE USAGE', icon: BarChart3 },
            { id: 'MAX_WEEK', label: 'MAX WEEK', icon: Signal }
          ].map(tab => html`
            <button 
              key=${tab.id}
              onClick=${() => setActiveTab(tab.id)}
              style=${{
                background: activeTab === tab.id ? 'var(--neon-cyan)' : 'transparent',
                color: activeTab === tab.id ? '#000' : '#fff',
                border: '1px solid var(--neon-cyan)',
                padding: '8px 15px',
                borderRadius: '4px',
                fontSize: '0.8rem',
                cursor: 'pointer',
                fontFamily: "'Orbitron', sans-serif",
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease'
              }}
            >
              <${tab.icon} size=${14} /> ${tab.label}
            </button>
          `)}
        </div>

        <!-- Leaderboard Content -->
        <div style=${{ minHeight: '350px' }}>
          <${AnimatePresence} mode="wait">
            ${activeTab === 'FASTEST' && html`
              <${motion.div} 
                key="fastest"
                initial=${{ opacity: 0, y: 10 }}
                animate=${{ opacity: 1, y: 0 }}
                exit=${{ opacity: 0, y: -10 }}
              >
                <h3 style=${{ color: '#fefe33', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <${Zap} size=${18} /> TOP DECRYPTIONS SPEED
                </h3>
                <div style=${{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '15px' }}>
                  <div style=${{ display: 'flex', fontSize: '0.7rem', opacity: 0.5, padding: '0 10px' }}>
                    <span style=${{ width: '40px' }}>RANK</span>
                    <span style=${{ flex: 1 }}>AGENT</span>
                    <span style=${{ flex: 1 }}>PUZZLE</span>
                    <span style=${{ width: '60px', textAlign: 'right' }}>TIME</span>
                  </div>
                  ${fastestSolves.map((entry, i) => html`
                    <div 
                      key=${i}
                      style=${{ 
                        display: 'flex', 
                        padding: '10px', 
                        background: entry.isUser ? 'rgba(0, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                        border: entry.isUser ? '1px solid var(--neon-cyan)' : 'none',
                        borderRadius: '3px',
                        alignItems: 'center',
                        color: entry.isUser ? 'var(--neon-cyan)' : '#fff'
                      }}
                    >
                      <span style=${{ width: '40px', opacity: 0.5 }}>#${i+1}</span>
                      <span style=${{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <${User} size=${14} /> ${entry.name}
                      </span>
                      <span style=${{ flex: 1, opacity: 0.7, fontSize: '0.8rem' }}>${entry.puzzle}</span>
                      <span style=${{ width: '60px', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '5px' }}>
                        <${Clock} size=${12} /> ${entry.time}s
                      </span>
                    </div>
                  `)}
                </div>
              </${motion.div}>
            `}

            ${activeTab === 'POPULAR' && html`
              <${motion.div} 
                key="popular"
                initial=${{ opacity: 0, y: 10 }}
                animate=${{ opacity: 1, y: 0 }}
                exit=${{ opacity: 0, y: -10 }}
              >
                <h3 style=${{ color: '#fefe33', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <${BarChart3} size=${18} /> MOST HANDLED WEEK PUZZLES
                </h3>
                <div style=${{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '15px' }}>
                  <div style=${{ display: 'flex', fontSize: '0.7rem', opacity: 0.5, padding: '0 10px' }}>
                    <span style=${{ width: '40px' }}>RANK</span>
                    <span style=${{ flex: 1 }}>TERMINAL WEEK</span>
                    <span style=${{ flex: 1 }}>NODE NAME</span>
                    <span style=${{ width: '80px', textAlign: 'right' }}>CLEARS</span>
                  </div>
                  ${popularityData.map((entry, i) => html`
                    <div 
                      key=${i}
                      style=${{ 
                        display: 'flex', 
                        padding: '10px', 
                        background: entry.isUserIncluded ? 'rgba(0, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                        border: entry.isUserIncluded ? '1px solid rgba(0, 255, 255, 0.3)' : 'none',
                        borderRadius: '3px',
                        alignItems: 'center',
                        color: '#fff'
                      }}
                    >
                      <span style=${{ width: '40px', opacity: 0.5 }}>#${i+1}</span>
                      <span style=${{ flex: 1 }}>WEEK ${entry.week}</span>
                      <span style=${{ flex: 1, opacity: 0.7, fontSize: '0.8rem' }}>${entry.name}</span>
                      <span style=${{ width: '80px', textAlign: 'right', color: 'var(--neon-cyan)' }}>
                        ${entry.clears.toLocaleString()}
                      </span>
                    </div>
                  `)}
                </div>
              </${motion.div}>
            `}

            ${activeTab === 'MAX_WEEK' && html`
              <${motion.div} 
                key="max_week"
                initial=${{ opacity: 0, y: 10 }}
                animate=${{ opacity: 1, y: 0 }}
                exit=${{ opacity: 0, y: -10 }}
              >
                <h3 style=${{ color: '#fefe33', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <${Signal} size=${18} /> TOP AGENT CLEARANCE (MAX WEEK)
                </h3>
                <div style=${{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '15px' }}>
                  <div style=${{ display: 'flex', fontSize: '0.7rem', opacity: 0.5, padding: '0 10px' }}>
                    <span style=${{ width: '40px' }}>RANK</span>
                    <span style=${{ flex: 1 }}>AGENT</span>
                    <span style=${{ width: '100px', textAlign: 'right' }}>MAX WEEK REACHED</span>
                  </div>
                  ${maxWeekLeaderboard.map((entry, i) => html`
                    <div 
                      key=${i}
                      style=${{ 
                        display: 'flex', 
                        padding: '10px', 
                        background: entry.isUser ? 'rgba(0, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                        border: entry.isUser ? '1px solid var(--neon-cyan)' : 'none',
                        borderRadius: '3px',
                        alignItems: 'center',
                        color: entry.isUser ? 'var(--neon-cyan)' : '#fff'
                      }}
                    >
                      <span style=${{ width: '40px', opacity: 0.5 }}>#${i+1}</span>
                      <span style=${{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <${User} size=${14} /> ${entry.name}
                      </span>
                      <span style=${{ width: '100px', textAlign: 'right', fontWeight: 'bold' }}>
                        W${entry.maxWeek}
                      </span>
                    </div>
                  `)}
                </div>
              </${motion.div}>
            `}
          </${AnimatePresence}>
        </div>

        <div style=${{ textAlign: 'center', opacity: 0.4, fontSize: '0.7rem', marginTop: '20px' }}>
          * LEADERBOARD SYNCHRONIZED ACROSS THE NEON GRID EVERY 60s
        </div>
      </${motion.div}>
    </div>
  `;
};

export default GlobalLeaderboard;
