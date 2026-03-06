import React, { useState, useEffect } from 'react';
import html from './html.js';
import Header from './Header.js';
import TerminalHub from './TerminalHub.js';
import PuzzleView from './PuzzleView.js';
import GridBackground from './GridBackground.js';
import AdminPanel from './AdminPanel.js';
import Leaderboard from './Leaderboard.js';
import GlobalLeaderboard from './GlobalLeaderboard.js';
import ProfileModal from './ProfileModal.js';
import HackingMinigame from './HackingMinigame.js';
import SkillTree from './SkillTree.js';
import ShopModal from './ShopModal.js';
import DailyContracts from './DailyContracts.js';
import AchievementsModal from './AchievementsModal.js';
import ToastSystem from './ToastSystem.js';
import MainScreen from './MainScreen.js';
import audioService from '../utils/AudioService.js';
import { AVATARS, SHOP_ITEMS } from '../data/constants.js';

const App = () => {
  const [currentView, setCurrentView] = useState('hub'); // 'hub' or 'puzzle'
  const [selectedTerminal, setSelectedTerminal] = useState(null);
  const [puzzles, setPuzzles] = useState([]);
  const [completedPuzzles, setCompletedPuzzles] = useState([]);
  const [solveTimes, setSolveTimes] = useState({});
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showGlobalLeaderboard, setShowGlobalLeaderboard] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSkillTree, setShowSkillTree] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showDailyContracts, setShowDailyContracts] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showMain, setShowMain] = useState(true);
  const [hackingPuzzle, setHackingPuzzle] = useState(null);
  const [shards, setShards] = useState(0);
  const [userSkills, setUserSkills] = useState({});
  const [dailyContracts, setDailyContracts] = useState([]);
  const [toasts, setToasts] = useState([]);
  
  const addToast = (title, message, type = 'INFO') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, title, message, type }]);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const addBadgeWithToast = (badges, badgeId, label) => {
    if (!badges.includes(badgeId)) {
      badges.push(badgeId);
      addToast('New Achievement!', label || badgeId.replace('_', ' '), 'ACHIEVEMENT');
      return true;
    }
    return false;
  };
  
  const [profile, setProfile] = useState({
    name: 'GUEST_AGENT',
    avatar: AVATARS[0],
    badges: [],
    hintlessChain: 0,
    hackingStreak: 0,
    completedContractCount: 0,
    totalShardsEarned: 0,
    ownedItems: [],
    activeTheme: null,
    activeFrame: null
  });

  useEffect(() => {
    // Audio init on first interaction
    const initAudio = () => {
      audioService.init();
      window.removeEventListener('mousedown', initAudio);
      window.removeEventListener('keydown', initAudio);
    };
    window.addEventListener('mousedown', initAudio);
    window.addEventListener('keydown', initAudio);

    // Load puzzles from JSON
    fetch('./data/puzzles.json')
      .then(res => res.json())
      .then(data => setPuzzles(data))
      .catch(err => console.error("Failed to load puzzles:", err));

    // Load progress and solve times from localStorage
    const savedProgress = localStorage.getItem('neon_mystery_progress');
    if (savedProgress) setCompletedPuzzles(JSON.parse(savedProgress));

    const savedTimes = localStorage.getItem('neon_mystery_times');
    if (savedTimes) setSolveTimes(JSON.parse(savedTimes));

    const savedProfile = localStorage.getItem('neon_mystery_profile');
    if (savedProfile) {
      const parsedProfile = JSON.parse(savedProfile);
      setProfile(prev => ({
        ...prev,
        ...parsedProfile,
        ownedItems: parsedProfile.ownedItems || [],
        activeTheme: parsedProfile.activeTheme || null,
        activeFrame: parsedProfile.activeFrame || null
      }));
    }

    const savedShards = localStorage.getItem('neon_mystery_shards');
    if (savedShards) setShards(parseInt(savedShards));

    const savedSkills = localStorage.getItem('neon_mystery_skills');
    if (savedSkills) setUserSkills(JSON.parse(savedSkills));

    // Load/Generate Daily Contracts
    const today = new Date().toISOString().split('T')[0];
    const savedContracts = localStorage.getItem('neon_mystery_daily_contracts');
    const parsedContracts = savedContracts ? JSON.parse(savedContracts) : null;

    if (parsedContracts && parsedContracts.date === today) {
      setDailyContracts(parsedContracts.list);
    } else {
      const newList = [
        { type: 'SOLVE_ANY', progress: 0, requirement: 1, reward: 50, claimed: false },
        { type: 'HACK_SUCCESS', progress: 0, requirement: 1, reward: 75, claimed: false },
        { type: 'SPEED_RUN', progress: 0, requirement: 1, reward: 100, claimed: false },
        { type: 'NO_HINT', progress: 0, requirement: 1, reward: 120, claimed: false }
      ];
      setDailyContracts(newList);
      localStorage.setItem('neon_mystery_daily_contracts', JSON.stringify({ date: today, list: newList }));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('neon_mystery_profile', JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    localStorage.setItem('neon_mystery_shards', shards.toString());
  }, [shards]);

  useEffect(() => {
    localStorage.setItem('neon_mystery_skills', JSON.stringify(userSkills));
  }, [userSkills]);

  useEffect(() => {
    if (dailyContracts.length > 0) {
      const today = new Date().toISOString().split('T')[0];
      localStorage.setItem('neon_mystery_daily_contracts', JSON.stringify({ date: today, list: dailyContracts }));
    }
  }, [dailyContracts]);

  const activeThemeData = SHOP_ITEMS.find(i => i.id === profile.activeTheme);
  const activeFrameData = SHOP_ITEMS.find(i => i.id === profile.activeFrame);

  // Apply dynamic theme colors to CSS variables
  useEffect(() => {
    const root = document.documentElement;
    if (activeThemeData && activeThemeData.colors) {
      root.style.setProperty('--neon-cyan', activeThemeData.colors.cyan);
      root.style.setProperty('--neon-magenta', activeThemeData.colors.magenta);
    } else {
      root.style.setProperty('--neon-cyan', '#00ffff');
      root.style.setProperty('--neon-magenta', '#ff00ff');
    }
  }, [activeThemeData]);

  const updateDailyProgress = (type, amount = 1, metadata = {}) => {
    setDailyContracts(prev => prev.map(c => {
      if (c.type === type && !c.claimed) {
        if (type === 'SPEED_RUN' && metadata.time > 45) return c;
        if (type === 'NO_HINT' && metadata.usedHints) return c;
        const newProgress = Math.min(c.requirement, c.progress + amount);
        if (newProgress > c.progress) {
          if (newProgress >= c.requirement) {
            addToast('Contract Fulfilled', `${c.type.replace('_', ' ')}: Objective Achieved`, 'CONTRACT');
          } else {
            addToast('Contract Progress', `${c.type.replace('_', ' ')} updated: ${newProgress}/${c.requirement}`, 'CONTRACT');
          }
        }
        return { ...c, progress: newProgress };
      }
      return c;
    }));
  };

  const handleTerminalSelect = (terminal) => {
    if (terminal.locked) return;
    audioService.playClick();
    setSelectedTerminal(terminal);
    setCurrentView('puzzle');
  };

  const handleBackToHub = () => {
    audioService.playClick();
    setCurrentView('hub');
    setSelectedTerminal(null);
  };

  const handlePuzzleComplete = (id, timeTaken, usedHints) => {
    const updatedCompleted = !completedPuzzles.includes(id) 
      ? [...completedPuzzles, id] 
      : completedPuzzles;
    
    setCompletedPuzzles(updatedCompleted);
    localStorage.setItem('neon_mystery_progress', JSON.stringify(updatedCompleted));

    const updatedTimes = { ...solveTimes, [id]: timeTaken };
    setSolveTimes(updatedTimes);
    localStorage.setItem('neon_mystery_times', JSON.stringify(updatedTimes));

    // Audio Feedback
    audioService.playPuzzleComplete();

    // Daily Contract Progress
    updateDailyProgress('SOLVE_ANY');
    updateDailyProgress('SPEED_RUN', 1, { time: timeTaken });
    updateDailyProgress('NO_HINT', 1, { usedHints });

    // Shard Logic
    const baseShards = 20;
    const bonusFactor = 1 + (userSkills.DATA_MINER || 0) * 0.25;
    const earned = Math.floor(baseShards * bonusFactor);
    setShards(prev => prev + earned);
    addToast('Shards Detected', `+${earned} Neon Shards extracted`, 'INFO');

    // Update shard collector daily progress
    updateDailyProgress('SHARD_COLLECTOR', earned);

    // Badge Logic
    const newBadges = [...profile.badges];
    let newHintlessChain = usedHints ? 0 : profile.hintlessChain + 1;
    let newTotalShards = profile.totalShardsEarned + earned;
    let maxWeek = updatedCompleted.reduce((max, puzzleId) => {
      const p = puzzles.find(pz => pz.id === puzzleId);
      return p ? Math.max(max, p.unlockWeek) : max;
    }, 0);

    if (updatedCompleted.length >= 1) addBadgeWithToast(newBadges, 'GRID_INITIATE', 'Grid Initiate');
    if (updatedCompleted.length >= 5) addBadgeWithToast(newBadges, 'CODE_BREAKER', 'Code Breaker');
    if (updatedCompleted.length >= 10) addBadgeWithToast(newBadges, 'CYBER_MASTER', 'Cyber Master');
    if (timeTaken < 15) addBadgeWithToast(newBadges, 'SPEED_DEMON', 'Speed Demon');
    if (newHintlessChain >= 3) addBadgeWithToast(newBadges, 'PURIST', 'Purist');
    if (newTotalShards >= 500) addBadgeWithToast(newBadges, 'SHARD_HOARDER', 'Shard Hoarder');
    if (maxWeek >= 100) addBadgeWithToast(newBadges, 'CENTURY_AGENT', 'Century Agent');

    setProfile(prev => ({ 
      ...prev, 
      badges: newBadges,
      hintlessChain: newHintlessChain,
      totalShardsEarned: newTotalShards
    }));

    setTimeout(() => {
      handleBackToHub();
      setShowLeaderboard(true);
    }, 2000);
  };

  const handleHackComplete = (timeLeft) => {
    if (!hackingPuzzle) return;
    
    // Audio Feedback
    audioService.playHackSuccess();

    // Unlock the puzzle in local state
    const updatedPuzzles = puzzles.map(p => 
      p.id === hackingPuzzle.id ? { ...p, locked: false } : p
    );
    setPuzzles(updatedPuzzles);
    setHackingPuzzle(null);

    // Daily Contract Progress
    updateDailyProgress('HACK_SUCCESS');

    // Earn shards from hack
    const hackBaseShards = 30;
    const bonusFactor = 1 + (userSkills.DATA_MINER || 0) * 0.25;
    const earned = Math.floor(hackBaseShards * bonusFactor);
    setShards(prev => prev + earned);
    addToast('Bypass Bonus', `+${earned} Neon Shards decrypted`, 'INFO');

    // Update shard collector daily progress
    updateDailyProgress('SHARD_COLLECTOR', earned);
    
    // Badge logic for hacks
    const newBadges = [...profile.badges];
    let newHackingStreak = profile.hackingStreak + 1;
    let newTotalShards = profile.totalShardsEarned + earned;

    if (newHackingStreak >= 3) addBadgeWithToast(newBadges, 'HACK_STREAK', 'Ghost in the Shell');
    if (timeLeft > 5) addBadgeWithToast(newBadges, 'PERFECT_BYPASS', 'Perfect Bypass');
    if (newTotalShards >= 500) addBadgeWithToast(newBadges, 'SHARD_HOARDER', 'Shard Hoarder');

    setProfile(prev => ({
      ...prev,
      badges: newBadges,
      hackingStreak: newHackingStreak,
      totalShardsEarned: newTotalShards
    }));

    // Automatically select the newly unlocked puzzle
    const unlocked = updatedPuzzles.find(p => p.id === hackingPuzzle.id);
    handleTerminalSelect(unlocked);
  };

  const handleHackFail = () => {
    setHackingPuzzle(null);
    setProfile(prev => ({ ...prev, hackingStreak: 0 }));
  };

  const handleUpgradeSkill = (skillId, cost) => {
    if (shards < cost) {
      audioService.playError();
      return;
    }
    audioService.playClick();
    setShards(prev => prev - cost);
    setUserSkills(prev => ({
      ...prev,
      [skillId]: (prev[skillId] || 0) + 1
    }));
  };

  const handlePurchase = (itemId, cost) => {
    if (shards < cost) {
      audioService.playError();
      return;
    }
    audioService.playClick();
    setShards(prev => prev - cost);
    setProfile(prev => ({
      ...prev,
      ownedItems: [...prev.ownedItems, itemId]
    }));
  };

  const handleEquip = (itemId, type) => {
    audioService.playClick();
    setProfile(prev => ({
      ...prev,
      [type === 'THEME' ? 'activeTheme' : 'activeFrame']: itemId
    }));
  };

  const handleClaimContractReward = (index) => {
    const contract = dailyContracts[index];
    if (contract && contract.progress >= contract.requirement && !contract.claimed) {
      audioService.playContractClaim();
      setShards(prev => prev + contract.reward);
      addToast('Contract Claimed', `+${contract.reward} Shards deposited`, 'CONTRACT');
      setDailyContracts(prev => prev.map((c, i) => i === index ? { ...c, claimed: true } : c));
      
      const newBadges = [...profile.badges];
      const newContractCount = profile.completedContractCount + 1;
      if (newContractCount >= 5) addBadgeWithToast(newBadges, 'EARLY_BIRD', 'Early Bird');

      setProfile(prev => ({
        ...prev,
        badges: newBadges,
        completedContractCount: newContractCount
      }));
    }
  };

  const completedDailyCount = dailyContracts.filter(c => c.progress >= c.requirement && !c.claimed).length;

  return html`
    <div style=${{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      ${showMain && html`<${MainScreen} onStart=${() => setShowMain(false)} />`}
      <${GridBackground} variant=${currentView === 'hub' ? 'city' : 'terminal'} />
      <${Header} 
        profile=${profile} 
        shards=${shards}
        onProfileClick=${() => { audioService.playClick(); setShowProfile(true); }} 
        onLeaderboardClick=${() => { audioService.playClick(); setShowGlobalLeaderboard(true); }}
        onSkillTreeClick=${() => { audioService.playClick(); setShowSkillTree(true); }}
        onShopClick=${() => { audioService.playClick(); setShowShop(true); }}
        onAchievementsClick=${() => { audioService.playClick(); setShowAchievements(true); }}
      />
      <main style=${{ flex: 1, padding: '20px', position: 'relative' }}>
        ${currentView === 'hub' ? html`
          <${TerminalHub} 
            puzzles=${puzzles} 
            completedPuzzles=${completedPuzzles} 
            onSelect=${handleTerminalSelect} 
            onHack=${(p) => { audioService.playClick(); setHackingPuzzle(p); }}
            onOpenContracts=${() => { audioService.playClick(); setShowDailyContracts(true); }}
            completedDailyCount=${completedDailyCount}
          />
        ` : html`
          <${PuzzleView} 
            puzzle=${selectedTerminal} 
            onBack=${handleBackToHub} 
            onComplete=${(time, usedHints) => handlePuzzleComplete(selectedTerminal.id, time, usedHints)}
          />
        `}
      </main>
      <footer style=${{ padding: '20px', textAlign: 'center', opacity: 0.5, fontSize: '0.8rem', display: 'flex', justifyContent: 'center', gap: '20px' }}>
        <span>&copy; 2024 NEON MYSTERY FILES - VERSION 1.8.0</span>
        <button 
          onClick=${() => { audioService.playClick(); setIsAdminOpen(true); }}
          style=${{
            background: 'none',
            border: 'none',
            color: '#ff00ff',
            cursor: 'pointer',
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: '0.8rem',
            textDecoration: 'underline'
          }}
        >
          OPEN ADMIN TERMINAL
        </button>
      </footer>

      ${isAdminOpen && html`
        <${AdminPanel} 
          onPuzzlesGenerated=${(newPuzzles) => setPuzzles(newPuzzles)}
          onClose=${() => setIsAdminOpen(false)}
        />
      `}

      ${showLeaderboard && selectedTerminal && html`
        <${Leaderboard} 
          puzzle=${selectedTerminal}
          userBestTime=${solveTimes[selectedTerminal.id]}
          onClose=${() => setShowLeaderboard(false)}
        />
      `}

      ${showGlobalLeaderboard && html`
        <${GlobalLeaderboard} 
          userSolveTimes=${solveTimes}
          completedPuzzles=${completedPuzzles}
          puzzles=${puzzles}
          onClose=${() => setShowGlobalLeaderboard(false)}
        />
      `}

      ${showProfile && html`
        <${ProfileModal} 
          profile=${profile}
          completedCount=${completedPuzzles.length}
          onClose=${() => setShowProfile(false)}
          onUpdateProfile=${(updated) => setProfile(updated)}
        />
      `}

      ${showSkillTree && html`
        <${SkillTree} 
          userSkills=${userSkills}
          shards=${shards}
          onUpgrade=${handleUpgradeSkill}
          onClose=${() => setShowSkillTree(false)}
        />
      `}

      ${showShop && html`
        <${ShopModal} 
          shards=${shards}
          ownedItems=${profile.ownedItems}
          activeTheme=${profile.activeTheme}
          activeFrame=${profile.activeFrame}
          onPurchase=${handlePurchase}
          onEquip=${handleEquip}
          onClose=${() => setShowShop(false)}
        />
      `}

      ${showDailyContracts && html`
        <${DailyContracts} 
          contracts=${dailyContracts}
          onClaimReward=${handleClaimContractReward}
          onClose=${() => setShowDailyContracts(false)}
        />
      `}

      ${showAchievements && html`
        <${AchievementsModal} 
          ownedBadges=${profile.badges}
          onClose=${() => setShowAchievements(false)}
        />
      `}

      ${hackingPuzzle && html`
        <${HackingMinigame} 
          difficulty=${hackingPuzzle.unlockWeek > 3 ? 2 : 1}
          userSkills=${userSkills}
          onComplete=${handleHackComplete}
          onFail=${handleHackFail}
          onClose=${() => setHackingPuzzle(null)}
        />
      `}

      <${ToastSystem} toasts=${toasts} removeToast=${removeToast} />
    </div>
  `;
};

export default App;
