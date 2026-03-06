import React, { useState } from 'react';
import html from './html.js';
import { User, X, Shield, Award, Edit2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { AVATARS, BADGES, SHOP_ITEMS } from '../data/constants.js';

const ProfileModal = ({ profile, completedCount, onClose, onUpdateProfile }) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(profile.name);

  const activeFrameData = SHOP_ITEMS.find(i => i.id === profile.activeFrame);

  const handleNameSave = () => {
    onUpdateProfile({ ...profile, name: newName });
    setIsEditingName(false);
  };

  const handleAvatarSelect = (url) => {
    onUpdateProfile({ ...profile, avatar: url });
  };

  return html`
    <div style=${{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.95)',
      zIndex: 1000,
      padding: '20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Share Tech Mono', monospace"
    }}>
      <${motion.div} 
        initial=${{ scale: 0.9, opacity: 0 }}
        animate=${{ scale: 1, opacity: 1 }}
        style=${{
          maxWidth: '600px',
          width: '100%',
          background: '#0a0a0a',
          border: '1px solid #ff00ff',
          padding: '40px',
          borderRadius: '5px',
          position: 'relative',
          boxShadow: '0 0 30px rgba(255, 0, 255, 0.2)'
        }}
      >
        <button onClick=${onClose} style=${{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
          <${X} size=${24} />
        </button>

        <div style=${{ display: 'flex', gap: '30px', marginBottom: '40px', alignItems: 'flex-start' }}>
          <div style=${{ position: 'relative' }}>
            <img 
              src=${profile.avatar} 
              style=${{ 
                width: '100px', 
                height: '100px', 
                borderRadius: '50%', 
                border: profile.activeFrame ? 'none' : '2px solid #ff00ff', 
                padding: '5px',
                ...(activeFrameData ? activeFrameData.style : {})
              }} 
            />
            <div style=${{ marginTop: '15px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '5px' }}>
              ${AVATARS.map(url => html`
                <img 
                  key=${url}
                  src=${url} 
                  onClick=${() => handleAvatarSelect(url)}
                  style=${{ 
                    width: '30px', 
                    height: '30px', 
                    cursor: 'pointer', 
                    border: profile.avatar === url ? '1px solid #ff00ff' : '1px solid transparent',
                    borderRadius: '3px'
                  }} 
                />
              `)}
            </div>
          </div>

          <div style=${{ flex: 1 }}>
            <div style=${{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              ${isEditingName ? html`
                <div style=${{ display: 'flex', gap: '10px' }}>
                  <input 
                    value=${newName} 
                    onChange=${(e) => setNewName(e.target.value)}
                    style=${{ background: '#000', border: '1px solid #ff00ff', color: '#fff', padding: '5px', fontFamily: 'inherit' }}
                  />
                  <button onClick=${handleNameSave} style=${{ background: '#ff00ff', color: '#fff', border: 'none', padding: '5px 10px', cursor: 'pointer' }}>SAVE</button>
                </div>
              ` : html`
                <h2 style=${{ margin: 0, color: '#ff00ff', fontSize: '2rem' }}>${profile.name}</h2>
                <${Edit2} size=${16} color="#ff00ff" onClick=${() => setIsEditingName(true)} style=${{ cursor: 'pointer' }} />
              `}
            </div>
            <div style=${{ display: 'flex', gap: '20px', opacity: 0.7 }}>
              <span>RANK: AGENT</span>
              <span>SOLVED: ${completedCount}</span>
            </div>
          </div>
        </div>

        <div>
          <h3 style=${{ borderBottom: '1px solid rgba(255, 0, 255, 0.3)', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <${Award} size=${20} /> NEON BADGES
          </h3>
          <div style=${{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '15px', marginTop: '20px' }}>
            ${BADGES.map(badge => {
              const isUnlocked = profile.badges.includes(badge.id);
              return html`
                <div 
                  key=${badge.id}
                  style=${{
                    padding: '15px 10px',
                    background: isUnlocked ? 'rgba(255, 0, 255, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                    border: isUnlocked ? `1px solid ${badge.color}` : '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '5px',
                    textAlign: 'center',
                    opacity: isUnlocked ? 1 : 0.3,
                    transition: 'all 0.3s ease',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title=${badge.description}
                >
                  <div style=${{ fontSize: '2rem', marginBottom: '5px', height: '40px', display: 'flex', alignItems: 'center' }}>
                    ${badge.isImage ? html`<img src=${badge.icon} style=${{ height: '100%', objectFit: 'contain' }} />` : badge.icon}
                  </div>
                  <div style=${{ fontSize: '0.7rem', color: isUnlocked ? badge.color : '#fff', fontWeight: 'bold' }}>${badge.name}</div>
                  ${!isUnlocked && html`
                    <div style=${{ position: 'absolute', top: '5px', right: '5px' }}>
                      <${Shield} size=${12} />
                    </div>
                  `}
                </div>
              `;
            })}
          </div>
        </div>
      </${motion.div}>
    </div>
  `;
};

export default ProfileModal;