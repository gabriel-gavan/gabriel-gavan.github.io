import React, { useState, useEffect, useMemo } from 'react';
import html from './html.js';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, ShieldAlert, Zap, X } from 'lucide-react';
import audioService from '../utils/AudioService.js';

const HackingMinigame = ({ difficulty = 1, onComplete, onFail, onClose, userSkills = {} }) => {
  const [targetSequence, setTargetSequence] = useState([]);
  const [currentInput, setCurrentInput] = useState([]);
  const [status, setStatus] = useState('active'); // 'active', 'success', 'fail'

  const bonusTime = (userSkills.SIGNAL_BOOSTER || 0) * 2;
  const timeDilationFactor = 1 - ((userSkills.TIME_DILATION || 0) * 0.2);
  const [timeLeft, setTimeLeft] = useState((10 - difficulty) + bonusTime);

  const characters = '0123456789ABCDEF!@#$%^&*';

  useEffect(() => {
    // Generate target sequence based on difficulty
    const length = 4 + difficulty;
    const seq = Array.from({ length }, () => characters[Math.floor(Math.random() * characters.length)]);
    setTargetSequence(seq);
  }, [difficulty]);

  useEffect(() => {
    if (status !== 'active') return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0.1) {
          clearInterval(timer);
          setStatus('fail');
          audioService.playError();
          setTimeout(onFail, 1500);
          return 0;
        }
        return prev - (0.1 * timeDilationFactor);
      });
    }, 100);

    return () => clearInterval(timer);
  }, [status, onFail, timeDilationFactor]);

  const handleCharClick = (char) => {
    if (status !== 'active') return;

    const nextInput = [...currentInput, char];
    setCurrentInput(nextInput);

    // Check if correct so far
    const isCorrectSoFar = nextInput.every((c, i) => c === targetSequence[i]);

    if (!isCorrectSoFar) {
      audioService.playError();
      setStatus('fail');
      setTimeout(onFail, 1500);
    } else {
      audioService.playClick();
      if (nextInput.length === targetSequence.length) {
        setStatus('success');
        setTimeout(() => onComplete(timeLeft), 1000);
      }
    }
  };

  const gridChars = useMemo(() => {
    // Shuffle target characters with random ones to create a grid
    const all = [...targetSequence];
    while (all.length < 16) {
      all.push(characters[Math.floor(Math.random() * characters.length)]);
    }
    return all.sort(() => Math.random() - 0.5);
  }, [targetSequence]);

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
      fontFamily: "'Share Tech Mono', monospace"
    }}>
      <${motion.div}
        initial=${{ scale: 0.8, opacity: 0 }}
        animate=${{ scale: 1, opacity: 1 }}
        style=${{
          width: '400px',
          background: '#050505',
          border: `2px solid ${status === 'fail' ? '#ff0000' : status === 'success' ? '#39ff14' : '#00ffff'}`,
          padding: '30px',
          borderRadius: '5px',
          boxShadow: `0 0 20px ${status === 'fail' ? 'rgba(255,0,0,0.3)' : '#00ffff33'}`,
          position: 'relative'
        }}
      >
        <button onClick=${onClose} style=${{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
          <${X} size=${20} />
        </button>

        <div style=${{ textAlign: 'center', marginBottom: '20px' }}>
          <div style=${{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#00ffff' }}>
            <${Terminal} size=${24} />
            <h3 style=${{ margin: 0, letterSpacing: '2px' }}>DECRYPTING NODE...</h3>
          </div>
          <div style=${{ fontSize: '0.8rem', opacity: 0.6, marginTop: '5px' }}>SECURITY LEVEL: ${difficulty}</div>
        </div>

        <div style=${{ background: 'rgba(255, 255, 255, 0.05)', padding: '15px', borderRadius: '3px', marginBottom: '20px', textAlign: 'center' }}>
          <div style=${{ fontSize: '0.7rem', opacity: 0.5, marginBottom: '10px' }}>TARGET SEQUENCE:</div>
          <div style=${{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            ${targetSequence.map((char, i) => html`
              <span key=${i} style=${{
                fontSize: '1.2rem',
                color: currentInput[i] ? '#39ff14' : '#fff',
                opacity: currentInput[i] ? 1 : 0.3,
                borderBottom: `2px solid ${currentInput[i] ? '#39ff14' : '#fff'}`
              }}>${char}</span>
            `)}
          </div>
        </div>

        <div style=${{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
          ${gridChars.map((char, i) => html`
            <button 
              key=${i}
              onClick=${() => handleCharClick(char)}
              style=${{
                background: 'rgba(0, 255, 255, 0.1)',
                border: '1px solid #00ffff',
                color: '#00ffff',
                padding: '10px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: '1.1rem',
                transition: 'all 0.1s'
              }}
              className="hacking-btn"
            >${char}</button>
          `)}
        </div>

        <div style=${{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style=${{ display: 'flex', alignItems: 'center', gap: '5px', color: timeLeft < 3 ? '#ff0000' : '#fefe33' }}>
            <${Zap} size=${16} />
            <span style=${{ fontSize: '0.9rem' }}>LINK STABILITY: ${timeLeft.toFixed(1)}s</span>
          </div>
          <div style=${{ color: status === 'fail' ? '#ff0000' : status === 'success' ? '#39ff14' : '#00ffff', fontSize: '0.8rem' }}>
            ${status === 'fail' ? 'LINK SEVERED' : status === 'success' ? 'ACCESS GRANTED' : 'BYPASSING...'}
          </div>
        </div>
      </${motion.div}>
    </div>
  `;
};

export default HackingMinigame;