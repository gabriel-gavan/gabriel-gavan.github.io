import React, { useState } from 'react';
import { ArrowLeft, Lightbulb, CheckCircle, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import html from './html.js';
import audioService from '../utils/AudioService.js';

const PuzzleView = ({ puzzle, onBack, onComplete }) => {
  const [inputValue, setInputValue] = useState('');
  const [status, setStatus] = useState('active'); // 'active', 'correct', 'wrong'
  const [showHints, setShowHints] = useState(false);
  const [hintIndex, setHintIndex] = useState(0);
  const [startTime] = useState(Date.now());
  const [solveTime, setSolveTime] = useState(null);
  const [usedHints, setUsedHints] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim().toUpperCase() === puzzle.answer.toUpperCase()) {
      const timeTaken = Math.floor((Date.now() - startTime) / 1000);
      setSolveTime(timeTaken);
      setStatus('correct');
      onComplete(timeTaken, usedHints);
    } else {
      audioService.playError();
      setStatus('wrong');
      setTimeout(() => setStatus('active'), 2000);
    }
  };

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    audioService.playClick();
  };

  const handleNextHint = () => {
    audioService.playClick();
    setUsedHints(true);
    if (hintIndex < puzzle.hints.length - 1) {
      setHintIndex(hintIndex + 1);
    }
  };

  const toggleHints = () => {
    audioService.playClick();
    if (!showHints) setUsedHints(true);
    setShowHints(!showHints);
  };

  return html`
    <div style=${{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <div style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <button 
          onClick=${onBack}
          style=${{
            background: 'none',
            border: 'none',
            color: '#00ffff',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer',
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: '1rem'
          }}
        >
          <${ArrowLeft} size=${20} /> RETURN TO HUB
        </button>
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
          BACK TO HUB [/index.html]
        </a>
      </div>

      <div className="neon-border-cyan" style=${{
        background: 'rgba(0, 0, 0, 0.8)',
        padding: '40px',
        borderRadius: '5px',
        position: 'relative'
      }}>
        <div style=${{ 
          position: 'absolute', 
          top: '20px', 
          right: '20px', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '10px' 
        }}>
          <button 
            onClick=${toggleHints}
            style=${{
              background: 'none',
              border: 'none',
              color: '#ff00ff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <${Lightbulb} size=${24} /> 
            <span style=${{ fontSize: '0.8rem' }}>${showHints ? 'HIDE HINTS' : 'REQUEST HINT'}</span>
          </button>
        </div>

        <h2 style=${{ 
          marginTop: 0, 
          fontFamily: "'Orbitron', sans-serif", 
          color: '#00ffff',
          fontSize: '1.5rem',
          letterSpacing: '2px'
        }}>
          ${puzzle.title}
        </h2>
        <p style=${{ marginBottom: '40px', opacity: 0.8 }}>${puzzle.description}</p>

        <div style=${{ 
          background: 'rgba(0, 255, 255, 0.05)', 
          padding: '30px', 
          textAlign: 'center',
          border: '1px dashed rgba(0, 255, 255, 0.3)',
          marginBottom: '40px'
        }}>
          <h3 style=${{ 
            fontFamily: "'Share Tech Mono', monospace", 
            fontSize: '2rem', 
            margin: 0,
            color: '#fff',
            letterSpacing: '5px'
          }}>
            ${Array.isArray(puzzle.question) ? puzzle.question.join(' ') : puzzle.question}
          </h3>
        </div>

        <form onSubmit=${handleSubmit} style=${{ display: 'flex', gap: '20px' }}>
          <input 
            type="text" 
            value=${inputValue}
            onChange=${handleInputChange}
            placeholder="ENTER DECODED DATA..."
            style=${{
              flex: 1,
              background: 'rgba(0, 0, 0, 0.5)',
              border: '1px solid var(--neon-cyan)',
              padding: '15px 20px',
              color: '#fff',
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: '1.2rem',
              outline: 'none',
              boxShadow: '0 0 5px var(--neon-cyan)'
            }}
          />
          <button 
            type="submit"
            style=${{
              background: 'var(--neon-cyan)',
              color: '#000',
              border: 'none',
              padding: '0 30px',
              fontFamily: "'Orbitron', sans-serif",
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            SUBMIT
          </button>
        </form>

        <div style=${{ height: '60px', marginTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <${AnimatePresence}>
            ${status === 'correct' && html`
              <${motion.div} 
                initial=${{ opacity: 0, scale: 0.8 }}
                animate=${{ opacity: 1, scale: 1 }}
                style=${{ color: '#39ff14', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', fontSize: '1.2rem' }}
              >
                <div style=${{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <${CheckCircle} /> ACCESS GRANTED. TERMINAL CLEAR.
                </div>
                <div style=${{ fontSize: '0.9rem', opacity: 0.8 }}>TIME TAKEN: ${solveTime}s</div>
              </${motion.div}>
            `}
            ${status === 'wrong' && html`
              <${motion.div} 
                initial=${{ opacity: 0, scale: 0.8 }}
                animate=${{ opacity: 1, scale: 1 }}
                style=${{ color: '#ff00ff', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2rem' }}
              >
                <${XCircle} /> INVALID CODE. RETRYING...
              </${motion.div}>
            `}
          </${AnimatePresence}>
        </div>

        <${AnimatePresence}>
          ${showHints && html`
            <${motion.div} 
              initial=${{ opacity: 0, height: 0 }}
              animate=${{ opacity: 1, height: 'auto' }}
              exit=${{ opacity: 0, height: 0 }}
              style=${{ 
                marginTop: '20px', 
                borderTop: '1px solid rgba(255, 0, 255, 0.3)', 
                paddingTop: '20px',
                color: '#ff00ff'
              }}
            >
              <div style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style=${{ fontSize: '0.8rem', opacity: 0.8 }}>HINT ${hintIndex + 1}/${puzzle.hints.length}</span>
                ${hintIndex < puzzle.hints.length - 1 && html`
                  <button onClick=${handleNextHint} style=${{ background: 'none', border: 'none', color: '#ff00ff', cursor: 'pointer', fontSize: '0.7rem' }}>
                    NEXT HINT >
                  </button>
                `}
              </div>
              <p style=${{ margin: 0, fontSize: '0.9rem' }}>${puzzle.hints[hintIndex]}</p>
            </${motion.div}>
          `}
        </${AnimatePresence}>
      </div>
    </div>
  `;
};

export default PuzzleView;