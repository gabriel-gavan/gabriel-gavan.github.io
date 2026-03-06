import React from 'react';
import html from './html.js';
import { X, ShoppingBag, Palette, Layout, Check, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { SHOP_ITEMS } from '../data/constants.js';

const ShopModal = ({ shards, ownedItems, activeTheme, activeFrame, onPurchase, onEquip, onClose }) => {
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
          border: '1px solid #fefe33',
          padding: '30px',
          borderRadius: '5px',
          position: 'relative',
          boxShadow: '0 0 30px rgba(254, 254, 51, 0.2)'
        }}
      >
        <button onClick=${onClose} style=${{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
          <${X} size=${24} />
        </button>

        <div style=${{ textAlign: 'center', marginBottom: '40px' }}>
          <div style=${{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', marginBottom: '10px' }}>
            <${ShoppingBag} color="#fefe33" size=${40} />
            <h2 style=${{ color: '#fefe33', margin: 0, fontFamily: "'Orbitron', sans-serif", fontSize: '1.8rem' }}>AGENT NEON SHOP</h2>
          </div>
          <div style=${{ display: 'inline-flex', alignItems: 'center', gap: '10px', background: 'rgba(254, 254, 51, 0.1)', padding: '5px 15px', borderRadius: '20px', border: '1px solid #fefe33' }}>
            <span style=${{ color: '#fefe33' }}>CREDITS: ${shards} 💎</span>
          </div>
        </div>

        <div style=${{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px', maxHeight: '50vh', overflowY: 'auto', padding: '10px' }}>
          ${SHOP_ITEMS.map(item => {
            const isOwned = ownedItems.includes(item.id);
            const isActive = activeTheme === item.id || activeFrame === item.id;
            const canAfford = shards >= item.cost;

            return html`
              <div 
                key=${item.id}
                style=${{
                  padding: '20px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: `1px solid ${isActive ? '#fefe33' : isOwned ? '#00ffff' : '#333'}`,
                  borderRadius: '5px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  position: 'relative'
                }}
              >
                <div style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style=${{ color: item.type === 'THEME' ? '#00ffff' : '#ff00ff' }}>
                    ${item.type === 'THEME' ? html`<${Palette} size=${24} />` : html`<${Layout} size=${24} />`}
                  </span>
                  ${isActive && html`<${Check} color="#fefe33" size=${20} />`}
                </div>
                
                <h3 style=${{ margin: 0, fontSize: '0.9rem', color: isOwned ? '#fff' : '#aaa' }}>${item.name}</h3>
                <p style=${{ fontSize: '0.7rem', opacity: 0.6, margin: 0, flex: 1 }}>${item.description}</p>

                ${isOwned ? html`
                  <button 
                    onClick=${() => onEquip(item.id, item.type)}
                    disabled=${isActive}
                    style=${{
                      marginTop: '10px',
                      background: isActive ? 'transparent' : '#00ffff',
                      color: isActive ? '#00ffff' : '#000',
                      border: '1px solid #00ffff',
                      padding: '8px',
                      cursor: isActive ? 'default' : 'pointer',
                      fontFamily: 'inherit',
                      fontSize: '0.7rem',
                      fontWeight: 'bold'
                    }}
                  >
                    ${isActive ? 'ACTIVE' : 'EQUIP'}
                  </button>
                ` : html`
                  <button 
                    onClick=${() => onPurchase(item.id, item.cost)}
                    disabled=${!canAfford}
                    style=${{
                      marginTop: '10px',
                      background: canAfford ? '#fefe33' : 'transparent',
                      color: canAfford ? '#000' : '#fefe33',
                      border: '1px solid #fefe33',
                      padding: '8px',
                      cursor: canAfford ? 'pointer' : 'not-allowed',
                      fontFamily: 'inherit',
                      fontSize: '0.7rem',
                      fontWeight: 'bold',
                      opacity: canAfford ? 1 : 0.5
                    }}
                  >
                    BUY (${item.cost} 💎)
                  </button>
                `}
              </div>
            `;
          })}
        </div>

        <div style=${{ marginTop: '30px', textAlign: 'center', opacity: 0.6, fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
          <${Sparkles} size=${16} color="#fefe33" />
          <span>RARE THEMES AND FRAMES FOR ELITE AGENTS ONLY.</span>
        </div>
      </${motion.div}>
    </div>
  `;
};

export default ShopModal;