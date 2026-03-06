import React, { useEffect, useState } from 'react';
import html from './html.js';

const Toast = ({ id, title, message, type, onRemove }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(id);
    }, 5000);
    return () => clearTimeout(timer);
  }, [id, onRemove]);

  const typeStyles = {
    ACHIEVEMENT: {
      borderColor: 'var(--neon-magenta)',
      boxShadow: '0 0 10px var(--neon-magenta)',
      icon: '🏆'
    },
    CONTRACT: {
      borderColor: 'var(--neon-cyan)',
      boxShadow: '0 0 10px var(--neon-cyan)',
      icon: '📝'
    },
    INFO: {
      borderColor: '#fff',
      boxShadow: '0 0 5px #fff',
      icon: 'ℹ️'
    }
  };

  const style = typeStyles[type] || typeStyles.INFO;

  return html`
    <div 
      style=${{
        background: 'rgba(0, 0, 0, 0.9)',
        border: `2px solid ${style.borderColor}`,
        borderRadius: '4px',
        padding: '12px 20px',
        marginBottom: '10px',
        width: '300px',
        boxShadow: style.boxShadow,
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
        animation: 'toastSlideIn 0.3s ease-out',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <div style=${{ fontSize: '1.5rem' }}>${style.icon}</div>
      <div style=${{ flex: 1 }}>
        <div style=${{ 
          fontWeight: 'bold', 
          color: style.borderColor, 
          fontSize: '0.9rem',
          textTransform: 'uppercase',
          letterSpacing: '1px'
        }}>${title}</div>
        <div style=${{ 
          color: '#fff', 
          fontSize: '0.8rem', 
          marginTop: '4px',
          fontFamily: "'Share Tech Mono', monospace"
        }}>${message}</div>
      </div>
      <div 
        style=${{
          position: 'absolute',
          bottom: 0,
          left: 0,
          height: '2px',
          background: style.borderColor,
          width: '100%',
          animation: 'toastProgress 5s linear forwards'
        }}
      />
      <style>
        @keyframes toastSlideIn {
          from { transform: translateX(120%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes toastProgress {
          from { width: 100%; }
          to { width: 0%; }
        }
      </style>
    </div>
  `;
};

const ToastSystem = ({ toasts, removeToast }) => {
  return html`
    <div 
      style=${{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 9999,
        pointerEvents: 'none'
      }}
    >
      ${toasts.map(toast => html`
        <${Toast} key=${toast.id} ...${toast} onRemove=${removeToast} />
      `)}
    </div>
  `;
};

export default ToastSystem;
