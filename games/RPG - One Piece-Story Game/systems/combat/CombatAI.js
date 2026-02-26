/**
 * CombatAI - AI integration for combat decisions and narration
 *
 * Uses ChatManager to:
 * 1. Decide enemy actions based on game state
 * 2. Generate narration for enemy attacks
 * 3. Generate narration for player action outcomes
 *
 * Includes retry logic with exponential backoff.
 */

import { AI_CONFIG } from '../../constants/GameConstants.js';
import { getEnemyAttackNarration, getPlayerActionNarration } from './narration/FallbackNarration.js';
import { manifest } from '../../manifest.js';

export class CombatAI {
    /**
     * @param {ChatManager} chatManager - The ChatManager instance for AI calls
     */
    constructor(chatManager) {
        this.chatManager = chatManager;
    }

    // ========================================
    // Enemy Decision
    // ========================================

    /**
     * Get AI decision for enemy action
     * @returns {{ action_id: string, target: string, reasoning?: string }}
     */
    async getEnemyDecision(enemyData, combatState, party) {
        const prompt = this.buildEnemyDecisionPrompt(enemyData, combatState, party);

        const response = await this.callWithRetry(prompt, 150);

        // Parse JSON response
        try {
            // Handle markdown code blocks if present
            let jsonStr = response.trim();
            if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
            }

            const decision = JSON.parse(jsonStr);

            // Validate decision has action_id
            if (!decision.action_id) {
                throw new Error('Missing action_id in AI response');
            }

            // Validate action_id exists in enemy's attacks
            const validAttack = enemyData.attacks.find(a => a.id === decision.action_id);
            if (!validAttack) {
                console.warn(`Invalid action_id "${decision.action_id}" from AI, using fallback`);
                return this.getFallbackDecision(enemyData, combatState, party);
            }

            // Ensure target is set
            if (!decision.target) {
                decision.target = this.getDefaultTarget(enemyData, decision.action_id, party);
            }

            return decision;
        } catch (parseError) {
            console.warn('Failed to parse AI decision, using fallback:', parseError);
            return this.getFallbackDecision(enemyData, combatState, party);
        }
    }

    buildEnemyDecisionPrompt(enemyData, combatState, party) {
        // Build available attacks list (safely access cooldowns)
        const cooldowns = combatState.enemy?.cooldowns || {};
        const availableAttacks = enemyData.attacks
            .filter(a => !a.cooldown || cooldowns[a.id] === 0)
            .map(a => {
                let desc = `- ${a.id}: ${a.name}`;
                if (a.damage) desc += ` (${a.damage} damage)`;
                if (a.effect) desc += ` (${a.effect.type})`;
                desc += ` [targets: ${a.targeting}]`;
                return desc;
            })
            .join('\n');

        // Build party status
        const partyStatus = party
            .map(p => `- ${p.name}: ${p.currentHealth}/${p.maxHealth} HP (${p.status})`)
            .join('\n');

        // Build combat log
        const recentLog = combatState.combatLog
            .slice(-3)
            .map(e => `Round ${e.round}: ${e.actor} used ${e.action}${e.target ? ` on ${e.target}` : ''}`)
            .join('\n') || 'No previous actions';

        return `You are the tactical AI for ${enemyData.name}.
Personality: ${enemyData.personality}

CURRENT STATE:
Enemy HP: ${combatState.enemy.currentHealth}/${combatState.enemy.maxHealth} (${combatState.enemy.status})
Round: ${combatState.round}

PARTY STATUS:
${partyStatus}

AVAILABLE ACTIONS:
${availableAttacks}

RECENT COMBAT LOG:
${recentLog}

TACTICS GUIDANCE:
${enemyData.tactics ? JSON.stringify(enemyData.tactics) : 'Fight smart, target the weak'}

Choose ONE action. Respond with ONLY a JSON object (no explanation):
{"action_id": "attack_id", "target": "character_id_or_targeting_type"}`;
    }

    getDefaultTarget(enemyData, actionId, party) {
        const attack = enemyData.attacks.find(a => a.id === actionId);
        if (!attack) return 'random';

        // Use attack's targeting preference
        return attack.targeting || 'random';
    }

    getFallbackDecision(enemyData, combatState, party) {
        // Get available attacks (not on cooldown)
        const cooldowns = combatState.enemy?.cooldowns || {};
        const available = enemyData.attacks.filter(
            a => !a.cooldown || cooldowns[a.id] === 0
        );

        // Guard against empty attacks list - use first attack ignoring cooldown
        if (!available.length) {
            console.warn('No available attacks for fallback decision (all on cooldown)');
            const firstAttack = enemyData.attacks[0];
            if (!firstAttack) {
                console.error('Enemy has no attacks defined!');
                return { action_id: null, target: null };
            }
            return { action_id: firstAttack.id, target: firstAttack.targeting || 'random' };
        }

        // Prefer opening move if round 1
        if (combatState.round === 1 && enemyData.tactics?.openingMove) {
            const opener = available.find(a => a.id === enemyData.tactics.openingMove);
            if (opener) {
                return { action_id: opener.id, target: opener.targeting || 'random' };
            }
        }

        // Otherwise pick first damaging attack
        const damaging = available.find(a => a.damage) || available[0];
        return {
            action_id: damaging.id,
            target: damaging.targeting || 'random'
        };
    }

    // ========================================
    // Narration Generation
    // ========================================

    /**
     * Generate narration for enemy action
     * @param {Object} enemyData - Enemy data from enemies.json
     * @param {Object} decision - AI decision with action_id and target
     * @param {Array} party - Party members array
     * @param {string} resolvedTargetName - Pre-resolved target name (from CombatManager)
     * @param {Object} context - Combat context (damage, effects, momentum)
     */
    async getEnemyActionNarration(enemyData, decision, party, resolvedTargetName, context = {}) {
        const attack = enemyData.attacks.find(a => a.id === decision.action_id);
        if (!attack) return `${enemyData.shortName} attacks!`;

        // Use pre-resolved name if provided, otherwise try to resolve from party
        let targetName = resolvedTargetName;
        if (!targetName) {
            const targetMember = party.find(p => p.id === decision.target);
            targetName = targetMember?.name || decision.target;
        }

        const prompt = this.buildNarrationPrompt({
            type: 'enemy_action',
            enemy: enemyData,
            attack,
            targetName,
            context
        });

        try {
            return await this.callWithRetry(prompt, 200);
        } catch {
            return this.getFallbackEnemyNarration(enemyData, attack, targetName);
        }
    }

    /**
     * Generate narration for player action outcome
     * @param {Object} character - The acting character
     * @param {Object} ability - The ability used
     * @param {Object} rollResult - Dice roll result
     * @param {Object} enemyData - Enemy data (for damage abilities)
     * @param {Object} context - Combat context (damage, effects, momentum, personality)
     */
    async getPlayerOutcomeNarration(character, ability, rollResult, enemyData, context = {}) {
        const prompt = this.buildNarrationPrompt({
            type: 'player_outcome',
            character,
            ability,
            rollResult,
            enemy: enemyData,
            context
        });

        try {
            return await this.callWithRetry(prompt, 200);
        } catch {
            return this.getFallbackPlayerNarration(character, ability, rollResult);
        }
    }

    buildNarrationPrompt(promptContext) {
        // Build narrator instructions from manifest
        const tone = manifest.ai?.narratorTone || {};
        const toneStyle = (tone.style || ["Punchy and fast-paced", "Darkly funny", "Over-the-top dramatic"]).map(s => `- ${s}`).join('\n');
        const onomatopoeia = (tone.onomatopoeia || ["CRACK!", "THWACK!", "CRUNCH!", "SNAP!", "SIZZLE!", "SPLAT!"]).join(' ');
        const rules = (tone.rules || [
            "Keep responses to 2-3 sentences MAX",
            "Never break character or mention being an AI",
            "Make everything sound more epic than it probably is"
        ]).map(r => `- ${r}`).join('\n');

        const baseInstructions = `You are the narrator for "${manifest.title}".

TONE:
${toneStyle}
- Uses varied onomatopoeia (${onomatopoeia})

RULES:
${rules}`;

        // Extract combat context (damage, effects, momentum)
        const ctx = promptContext.context || {};

        // Get party terminology from manifest for content-agnostic theming
        const partyTerms = manifest.ai?.partyTerms || {};
        const partySingular = partyTerms.singular || 'party member';
        const partyPlural = partyTerms.plural || 'party members';
        const partyAdjective = partyTerms.adjective || '';
        const partyDescription = partyTerms.description || `a member of the ${partyAdjective} party`.trim();

        // Build shared context sections
        const effectsSection = (ctx.partyBuffs || ctx.enemyDebuffs) ? `
ACTIVE EFFECTS:
- Party buffs: ${ctx.partyBuffs || 'none'}
- Enemy debuffs: ${ctx.enemyDebuffs || 'none'}
${ctx.partyBuffs !== 'none' || ctx.enemyDebuffs !== 'none' ? 'Consider mentioning these effects if relevant to the action!' : ''}` : '';

        const momentumSection = ctx.momentum ? `
COMBAT MOMENTUM:
- Round: ${ctx.round || 1}
- Party: ${ctx.partyStanding}/${ctx.partyTotal} standing (${ctx.partyAvgHpPercent}% avg HP)
- Enemy: ${ctx.enemyHpPercent}% HP
- Situation: ${ctx.momentum}
Match the tone to the momentum! (desperate = tense, dominating = triumphant)` : '';

        if (promptContext.type === 'enemy_action') {
            const hints = (promptContext.attack.narrationHints || []).join(', ') || 'be dramatic';
            const enemyPronouns = promptContext.enemy.pronouns || { subject: 'it', object: 'it', possessive: 'its' };
            const creatureType = promptContext.enemy.creatureType || 'creature';

            // Build damage context section
            let damageSection = '';
            if (ctx.damageDealt !== undefined && ctx.damageDealt > 0) {
                damageSection = `
COMBAT RESULT:
- Damage dealt: ${ctx.damageDealt} points
- ${promptContext.targetName} health: ${ctx.targetHealthBefore}/${ctx.targetMaxHealth} → ${ctx.targetHealthAfter}/${ctx.targetMaxHealth}
- Target status: ${ctx.targetStatus}${ctx.isLethal ? '\n⚠️ THIS ATTACK DOWNS THE TARGET! Make it dramatic!' : ''}`;
            }

            return `${baseInstructions}

THE ATTACKER - ${promptContext.enemy.shortName.toUpperCase()} (${creatureType}):
${promptContext.enemy.description}
Pronouns for ${promptContext.enemy.shortName}: ${enemyPronouns.subject}/${enemyPronouns.object}/${enemyPronouns.possessive}

THE TARGET - ${promptContext.targetName.toUpperCase()} (${partySingular}):
${partyDescription.charAt(0).toUpperCase() + partyDescription.slice(1)} being attacked.

ACTION:
${promptContext.enemy.shortName} uses ${promptContext.attack.name} against ${promptContext.targetName}!
Attack: ${promptContext.attack.description}
Narration hints: ${hints}
${damageSection}
${effectsSection}
${momentumSection}

Write 2-3 punchy sentences. Focus on ${promptContext.enemy.shortName} (${enemyPronouns.subject}/${enemyPronouns.possessive}) attacking ${promptContext.targetName}.`;
        }

        if (promptContext.type === 'player_outcome') {
            const ability = promptContext.ability;
            const isSelfTargeted = ability.targetType === 'self';
            const isPartyTargeted = ability.targetType === 'party';
            const isHeal = ability.effect?.type === 'heal';
            const isBuff = ability.effect?.type === 'shield' || ability.effect?.type === 'concealment';

            // Determine target description
            let targetText;
            if (isSelfTargeted) {
                targetText = `TARGET: ${promptContext.character.name} (self)`;
            } else if (isPartyTargeted) {
                targetText = `TARGET: The whole ${partyAdjective ? partyAdjective + ' ' : ''}party`;
            } else {
                targetText = `TARGET: ${promptContext.enemy.shortName} (enemy)`;
            }

            // Determine effect description
            let effectText;
            if (ability.damage) {
                effectText = `Damage: ${ability.damage} ${ability.damageType || ''}`;
            } else if (isHeal) {
                effectText = `Healing: ${ability.effect.amount} HP${isPartyTargeted ? ` to each ${partySingular}` : ''}`;
            } else if (ability.effect?.type === 'shield') {
                effectText = `Shield: ${isPartyTargeted ? `All ${partyPlural} take` : 'Takes'} ${ability.effect.reduction || 1} less damage`;
            } else {
                effectText = `Effect: ${ability.effect?.description || ability.description}`;
            }

            // Build damage context section for attacks
            let damageSection = '';
            if (ctx.damageDealt !== undefined && ctx.damageDealt > 0 && ability.damage) {
                damageSection = `
COMBAT RESULT:
- Damage dealt: ${ctx.damageDealt} points${ctx.hadMark ? ' (includes +1 mark bonus!)' : ''}
- ${promptContext.enemy.shortName} health: ${ctx.enemyHealthBefore}/${ctx.enemyMaxHealth} → ${ctx.enemyHealthAfter}/${ctx.enemyMaxHealth}
- Enemy status: ${ctx.enemyStatus}${ctx.isKillingBlow ? '\n⚠️ THIS IS THE KILLING BLOW! Make it LEGENDARY!' : ''}`;
            }

            // Build character personality section with pronouns
            let personalitySection = '';
            const charPronouns = promptContext.character.pronouns || { subject: 'they', object: 'them', possessive: 'their' };
            const charGender = promptContext.character.gender || 'unknown';
            if (ctx.characterTrait && ctx.characterDescription) {
                // Look up personality style from manifest for content-agnostic theming
                const personalityStyles = manifest.ai?.personalityStyles || {};
                const traitStyle = personalityStyles[ctx.characterTrait] || `dramatic ${partySingular}`;
                personalitySection = `
CHARACTER (${charGender} ${partySingular}):
- Name: ${promptContext.character.name}
- Pronouns: ${charPronouns.subject}/${charPronouns.object}/${charPronouns.possessive} (use these!)
- Trait: ${ctx.characterTrait} - ${ctx.characterDescription}
- Style: ${traitStyle}
Let this personality color how ${charPronouns.subject} performs the action!`;
            }

            // Build narration instructions based on ability type
            // Read templates from manifest for content-agnostic theming
            const templates = manifest.ai?.narrationInstructions || {};
            const substitutePlaceholders = (template) => {
                return template
                    .replace(/\{characterName\}/g, promptContext.character.name)
                    .replace(/\{partyPlural\}/g, partyPlural)
                    .replace(/\{partySingular\}/g, partySingular)
                    .replace(/\{partyAdjective\}/g, partyAdjective);
            };

            let narrationInstructions;
            if (isHeal && isPartyTargeted) {
                const template = templates.healParty || `channeling healing energy that washes over ALL the ${partyPlural}!\nFocus on: the casting, energy spreading to each party member, wounds mending across the group.`;
                narrationInstructions = `Describe ${promptContext.character.name} ${substitutePlaceholders(template)}`;
            } else if (isBuff && isPartyTargeted) {
                const template = templates.buffParty || `CASTING protective energy over the ENTIRE party!\nIMPORTANT: This is PREPARATION - describe the effect being cast and protection forming around all ${partyPlural}.\nDo NOT describe an enemy attack being blocked - no attack has happened yet!\nFocus on: energy, barriers, protection wrapping around the group.`;
                narrationInstructions = `Describe ${promptContext.character.name} ${substitutePlaceholders(template)}`;
            } else if (isSelfTargeted && isHeal) {
                const template = templates.healSelf || 'healing themselves with a burst of energy!';
                narrationInstructions = `Describe ${promptContext.character.name} ${substitutePlaceholders(template)}`;
            } else {
                narrationInstructions = `Write 2-3 punchy sentences describing the ${promptContext.rollResult.tier} outcome!`;
            }

            // Add tier-specific flavor
            if (promptContext.rollResult.tier === 'critical') {
                narrationInstructions += '\nMake it EPIC!';
            } else if (promptContext.rollResult.tier === 'failure') {
                narrationInstructions += '\nMake it funny but embarrassing - the spell fizzles or backfires!';
            }

            return `${baseInstructions}
${personalitySection}

PLAYER ACTION:
${promptContext.character.name} uses ${promptContext.ability.name}!
Ability: ${promptContext.ability.description}
${effectText}

ROLL RESULT: ${promptContext.rollResult.tier.toUpperCase()}
(Rolled ${promptContext.rollResult.roll} + ${promptContext.rollResult.bonus} = ${promptContext.rollResult.total})

${targetText}
${damageSection}
${effectsSection}
${momentumSection}

${narrationInstructions}`;
        }

        return baseInstructions;
    }

    /**
     * Generate narration for enemy special ability activation (Barkskin, Wild Shape, etc.)
     */
    async getEnemySpecialNarration(enemyData, ability) {
        const hints = (ability.narrationHints || []).join(', ') || 'be dramatic';
        const effectDesc = ability.effect?.description || ability.description;
        const enemyPronouns = enemyData.pronouns || { subject: 'it', object: 'it', possessive: 'its' };
        const creatureType = enemyData.creatureType || 'creature';

        // Build narrator tone from manifest
        const tone = manifest.ai?.narratorTone || {};
        const toneStyle = (tone.style || ["Punchy and fast-paced", "Darkly funny", "Over-the-top dramatic"]).slice(0, 3).map(s => `- ${s}`).join('\n');
        const onomatopoeia = (tone.onomatopoeia || ["CRACK!", "THWACK!", "CRUNCH!", "SNAP!", "SIZZLE!", "SPLAT!"]).join(' ');

        const prompt = `You are the narrator for "${manifest.title}".

TONE:
${toneStyle}
- Uses varied onomatopoeia (${onomatopoeia})

RULES:
- Keep responses to 2-3 sentences MAX

${enemyData.shortName.toUpperCase()} (${creatureType}):
${enemyData.description}
Pronouns for ${enemyData.shortName}: ${enemyPronouns.subject}/${enemyPronouns.object}/${enemyPronouns.possessive}

SPECIAL ABILITY:
${enemyData.shortName} activates ${ability.name}!
Description: ${ability.description}
Effect: ${effectDesc}
Narration hints: ${hints}

Write 2-3 dramatic sentences. Focus on ${enemyData.shortName} (${enemyPronouns.subject}/${enemyPronouns.possessive}) transforming or powering up.`;

        try {
            return await this.callWithRetry(prompt, 150);
        } catch {
            return `${enemyData.shortName} activates ${ability.name}! ${effectDesc}`;
        }
    }

    /**
     * Generate narration for companion attack (Lord Longtung)
     * @param {Object} companion - Companion data
     * @param {Object} attack - Attack being used
     * @param {string} targetName - Resolved target name
     * @param {Object} context - Combat context (damage, effects, momentum)
     */
    async getCompanionNarration(companion, attack, targetName, context = {}) {
        const hints = (attack.narrationHints || []).join(', ') || 'be dramatic';

        // Build damage context if available
        let damageSection = '';
        if (context.damageDealt !== undefined && context.damageDealt > 0) {
            damageSection = `
COMBAT RESULT:
- Damage dealt: ${context.damageDealt} points
- ${targetName} health: ${context.targetHealthBefore}/${context.targetMaxHealth} → ${context.targetHealthAfter}/${context.targetMaxHealth}${context.isLethal ? '\n⚠️ THIS ATTACK DOWNS THE TARGET!' : ''}`;
        }

        const companionPronouns = companion.pronouns || { subject: 'it', object: 'it', possessive: 'its' };
        const creatureType = companion.creatureType || 'creature';

        // Get party terminology from manifest for content-agnostic theming
        const partyTerms = manifest.ai?.partyTerms || {};
        const partySingular = partyTerms.singular || 'party member';
        const partyDescription = partyTerms.description || `a member of the ${partyTerms.adjective || ''} party`.trim();

        // Build narrator tone from manifest
        const tone = manifest.ai?.narratorTone || {};
        const toneStyle = (tone.style || ["Punchy and fast-paced", "Darkly funny"]).slice(0, 2).map(s => `- ${s}`).join('\n');
        const onomatopoeia = (tone.onomatopoeia || ["SPLAT!", "THWAP!", "CROAK!", "SNAP!"]).slice(0, 4).join(' ');

        const prompt = `You are the narrator for "${manifest.title}".

TONE:
${toneStyle}
- Uses onomatopoeia (${onomatopoeia})

RULES:
- Keep responses to 1-2 sentences MAX

THE ATTACKER - ${companion.name.toUpperCase()} (${creatureType}):
${companion.description}
Pronouns for ${companion.name}: ${companionPronouns.subject}/${companionPronouns.object}/${companionPronouns.possessive}

THE TARGET - ${targetName.toUpperCase()} (${partySingular}):
${partyDescription.charAt(0).toUpperCase() + partyDescription.slice(1)} being attacked.

ACTION:
${companion.name} uses ${attack.name} against ${targetName}!
Attack: ${attack.description}
Narration hints: ${hints}
${damageSection}

Write 1-2 punchy sentences. Focus on ${companion.name} (${companionPronouns.subject}/${companionPronouns.possessive}) attacking ${targetName}.`;

        try {
            return await this.callWithRetry(prompt, 100);
        } catch {
            return `${companion.name} attacks with ${attack.name}!`;
        }
    }

    // ========================================
    // Fallback Narrations (when AI fails)
    // ========================================

    getFallbackEnemyNarration(enemyData, attack, targetName) {
        return getEnemyAttackNarration({
            enemyName: enemyData.shortName,
            attackName: attack.name,
            targetName,
            damage: attack.damage,
            effect: attack.effect || attack.bonusEffect
        });
    }

    getFallbackPlayerNarration(character, ability, rollResult) {
        return getPlayerActionNarration({
            characterName: character.name,
            abilityName: ability.name,
            tier: rollResult.tier,
            damage: ability.damage,
            effect: ability.effect
        });
    }

    // ========================================
    // AI Call with Retry Logic
    // ========================================

    /**
     * Call AI with retry logic
     * @param {string} prompt - The prompt to send
     * @param {number} maxTokens - Max tokens for response
     * @returns {Promise<string>} - AI response
     */
    async callWithRetry(prompt, maxTokens = AI_CONFIG.DEFAULT_MAX_TOKENS) {
        let lastError = new Error('Unknown error');

        for (let attempt = 1; attempt <= AI_CONFIG.MAX_RETRIES; attempt++) {
            const { promise: timeoutPromise, cancel: cancelTimeout } = this.timeout(AI_CONFIG.TIMEOUT_MS);

            try {
                // Create fresh chat for each attempt
                this.chatManager.cleanChatHistory();
                this.chatManager.addMessage('user', prompt);

                // Call with timeout
                const response = await Promise.race([
                    this.chatManager.getCharacterResponse('chat', maxTokens),
                    timeoutPromise
                ]);

                cancelTimeout();
                return response;

            } catch (error) {
                cancelTimeout();
                lastError = error;
                console.warn(`AI call attempt ${attempt}/${AI_CONFIG.MAX_RETRIES} failed:`, error.message);

                // Don't delay after last attempt
                if (attempt < AI_CONFIG.MAX_RETRIES) {
                    await this.delay(AI_CONFIG.RETRY_DELAY_MS * attempt); // Exponential backoff
                }
            }
        }

        throw new Error(`AI call failed after ${AI_CONFIG.MAX_RETRIES} attempts: ${lastError?.message}`);
    }

    /**
     * Create a cancellable timeout promise
     * @returns {{ promise: Promise, cancel: Function }}
     */
    timeout(ms) {
        let timeoutId;
        const promise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error('Request timed out')), ms);
        });
        return { promise, cancel: () => clearTimeout(timeoutId) };
    }

    /**
     * Delay helper
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
