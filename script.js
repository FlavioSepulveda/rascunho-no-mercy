/* ==========================================================================
   RASCUNHO: SEM TRÉGUA — MOTOR DE REGRAS (ESTÉTICA SKETCHBOOK)
   - Limite do Caderno: 25 folhas na mão = eliminação instantânea.
   - Acúmulo (Stacking): +2, +4, +6 e +10 podem ser rebatidos com valor >=.
   - 7 e 0: Trocam as mãos inteiras entre você e o rival.
   - Rasgar Tudo (ALL): Descarta todas as folhas daquela marca na mão.
   - Bloquear (⊘) e Inverter (⇄): Concedem jogada extra no duelo 1v1.
   - Inverter +4 (⇄+4): No 1v1 devolve o acúmulo de +4 para quem jogou.
   - Roleta de Tinta (❖): Escolhe uma marca e puxa folhas até encontrá-la.
   - Compra Recursiva: Ao clicar no monte sem jogada válida, puxa folhas
     recursivamente até encontrar uma compatível ou atingir o limite.
   ========================================================================== */

const MARKS = ['sun', 'moon', 'star', 'spiral'];
const MARK_META = {
    sun:    { symbol: '☀', name: 'Sol',     order: 0 },
    moon:   { symbol: '☾', name: 'Lua',     order: 1 },
    star:   { symbol: '✦', name: 'Estrela', order: 2 },
    spiral: { symbol: '◎', name: 'Espiral', order: 3 },
    ink:    { symbol: '✒', name: 'Borrão',  order: 4 }
};

const state = {
    deck: [],
    discard: [],
    playerHand: [],
    cpuHand: [],
    activeMark: 'sun',
    turn: 'player',         // 'player' | 'cpu'
    pendingDraw: 0,
    lastDrawValue: 0,
    lastPageCalled: false,
    gameOver: false,
    pendingMarkCallback: null
};

const els = {
    cpuHand:          document.getElementById('cpu-hand'),
    cpuCount:         document.getElementById('cpu-count'),
    cpuMercyBar:      document.getElementById('cpu-mercy-bar'),
    playerHand:       document.getElementById('player-hand'),
    playerCount:      document.getElementById('player-count'),
    playerMercyBar:   document.getElementById('player-mercy-bar'),
    drawPile:         document.getElementById('draw-pile'),
    deckCount:        document.getElementById('deck-count'),
    discardPile:      document.getElementById('discard-pile'),
    activeSuitBadge:  document.getElementById('active-suit-badge'),
    turnBadge:        document.getElementById('turn-badge'),
    statusText:       document.getElementById('status-text'),
    stackBanner:      document.getElementById('stack-banner'),
    stackAmount:      document.getElementById('stack-amount'),
    acceptPenaltyBtn: document.getElementById('accept-penalty-btn'),
    unoBtn:           document.getElementById('uno-btn'),
    suitModal:        document.getElementById('suit-modal'),
    suitModalTitle:   document.getElementById('suit-modal-title'),
    gameoverModal:    document.getElementById('gameover-modal'),
    winnerTitle:      document.getElementById('winner-title'),
    winnerReason:     document.getElementById('winner-reason')
};

/* ==========================================================================
   1. BARALHO DE RASCUNHOS
   ========================================================================== */
function createDeck() {
    const deck = [];

    MARKS.forEach(mark => {
        for (let n = 0; n <= 9; n++) {
            deck.push({
                mark,
                value: String(n),
                label: String(n),
                sub: n === 0 || n === 7 ? 'TROCA' : '',
                draw: 0
            });
            if (n !== 0) {
                deck.push({
                    mark,
                    value: String(n),
                    label: String(n),
                    sub: n === 7 ? 'TROCA' : '',
                    draw: 0
                });
            }
        }
        deck.push({ mark, value: 'SKIP', label: '⊘',   sub: 'BLOQUEIO', draw: 0 });
        deck.push({ mark, value: 'REV',  label: '⇄',   sub: 'INVERTE',  draw: 0 });
        deck.push({ mark, value: 'ALL',  label: 'ALL', sub: 'RASGAR',   draw: 0 });
        deck.push({ mark, value: '+2',   label: '+2',  sub: 'PUXE 2',   draw: 2 });
        deck.push({ mark, value: '+2',   label: '+2',  sub: 'PUXE 2',   draw: 2 });
        deck.push({ mark, value: '+4',   label: '+4',  sub: 'PUXE 4',   draw: 4 });
    });

    // Borrões de Tinta (Especiais sem marca fixa)
    for (let i = 0; i < 3; i++) {
        deck.push({ mark: 'ink', value: 'REV+4',    label: '⇄+4', sub: 'DEVOLVE', draw: 4 });
        deck.push({ mark: 'ink', value: '+6',       label: '+6',  sub: 'BORRÃO',  draw: 6 });
        deck.push({ mark: 'ink', value: '+10',      label: '+10', sub: 'MANCHA',  draw: 10 });
        deck.push({ mark: 'ink', value: 'ROULETTE', label: '❖',   sub: 'SORTEIO', draw: 0 });
    }

    return shuffle(deck);
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function drawFromDeck() {
    if (state.deck.length === 0) {
        if (state.discard.length <= 1) return null;
        const top = state.discard.pop();
        state.deck = shuffle(state.discard);
        state.discard = [top];
    }
    return state.deck.pop();
}

function startGame() {
    state.deck = createDeck();
    state.discard = [];
    state.playerHand = [];
    state.cpuHand = [];
    state.turn = 'player';
    state.pendingDraw = 0;
    state.lastDrawValue = 0;
    state.lastPageCalled = false;
    state.gameOver = false;

    els.gameoverModal.classList.add('hidden');
    els.gameoverModal.classList.remove('flex');

    for (let i = 0; i < 7; i++) {
        state.playerHand.push(drawFromDeck());
        state.cpuHand.push(drawFromDeck());
    }

    let firstCard = drawFromDeck();
    while (firstCard.mark === 'ink' || isNaN(Number(firstCard.value))) {
        state.deck.unshift(firstCard);
        firstCard = drawFromDeck();
    }

    state.discard.push(firstCard);
    state.activeMark = firstCard.mark;
    setStatus('Sua vez! Combine a marca ou o número da folha na mesa.');
    render();
}

/* ==========================================================================
   2. VALIDAÇÃO DE JOGADA E ACÚMULO
   ========================================================================== */
function getTopCard() {
    return state.discard[state.discard.length - 1];
}

function canPlayCard(card) {
    const top = getTopCard();

    if (state.pendingDraw > 0) {
        return card.draw > 0 && card.draw >= state.lastDrawValue;
    }

    if (card.mark === 'ink') return true;
    if (card.mark === state.activeMark) return true;
    if (card.value === top.value) return true;

    return false;
}

/* ==========================================================================
   3. EXECUÇÃO DAS FOLHAS E EFEITOS
   ========================================================================== */
function playCard(who, cardIndex) {
    if (state.gameOver) return;

    const hand = who === 'player' ? state.playerHand : state.cpuHand;
    const card = hand[cardIndex];
    if (!card || !canPlayCard(card)) return;

    hand.splice(cardIndex, 1);
    state.discard.push(card);

    if (who === 'player') {
        if (state.playerHand.length === 1 && !state.lastPageCalled) {
            setStatus('Esqueceu de anunciar Última Folha! +2 folhas de penalidade.');
            giveCards('player', 2);
        }
        state.lastPageCalled = false;
    }

    if (hand.length === 0) {
        render();
        endGame(who === 'player' ? 'Você Venceu!' : 'Rival Venceu!', 'Esvaziou todas as folhas da mão.');
        return;
    }

    if (card.mark === 'ink') {
        if (who === 'player') {
            openMarkPicker('Escolha a nova marca de tinta:', (chosenMark) => {
                state.activeMark = chosenMark;
                resolveCardEffect(who, card);
            });
        } else {
            state.activeMark = chooseBestMarkForCpu();
            resolveCardEffect(who, card);
        }
        return;
    }

    state.activeMark = card.mark;
    resolveCardEffect(who, card);
}

function resolveCardEffect(who, card) {
    const opponent = who === 'player' ? 'cpu' : 'player';
    const actorName = who === 'player' ? 'Você' : 'Rival';
    let nextTurn = opponent;

    if (card.value === 'REV+4') {
        state.pendingDraw += 4;
        state.lastDrawValue = 4;
        nextTurn = who;
        setStatus(`${actorName} jogou ⇄+4! No 1v1, o acúmulo (+${state.pendingDraw}) volta para ${actorName}!`);
    } else if (card.draw > 0) {
        state.pendingDraw += card.draw;
        state.lastDrawValue = card.draw;
        setStatus(`${actorName} jogou ${card.label}! Acúmulo subiu para +${state.pendingDraw} folhas.`);
    } else if (card.value === 'ALL') {
        const hand = who === 'player' ? state.playerHand : state.cpuHand;
        const matching = hand.filter(c => c.mark === card.mark);
        const remaining = hand.filter(c => c.mark !== card.mark);

        if (who === 'player') state.playerHand = remaining;
        else state.cpuHand = remaining;

        matching.forEach(c => state.discard.push(c));
        setStatus(`${actorName} rasgou todas as folhas de ${MARK_META[card.mark].name} (${matching.length + 1} folhas)!`);

        if (remaining.length === 0) {
            render();
            endGame(who === 'player' ? 'Você Venceu!' : 'Rival Venceu!', 'Esvaziou a mão rasgando todas as folhas da marca!');
            return;
        }
    } else if (card.value === 'SKIP' || card.value === 'REV') {
        nextTurn = who;
        setStatus(`${actorName} jogou ${card.sub} e joga novamente!`);
    } else if (card.value === '7' || card.value === '0') {
        const temp = state.playerHand;
        state.playerHand = state.cpuHand;
        state.cpuHand = temp;
        setStatus(`${actorName} jogou ${card.value}! As mãos foram trocadas!`);
    } else if (card.value === 'ROULETTE') {
        if (opponent === 'player') {
            render();
            openMarkPicker('SORTEIO! Escolha uma marca para puxar até achar:', (targetMark) => {
                runMarkRoulette('player', targetMark);
            });
            return;
        } else {
            const cpuTarget = MARKS[Math.floor(Math.random() * MARKS.length)];
            runMarkRoulette('cpu', cpuTarget);
            return;
        }
    } else {
        setStatus(`${actorName} jogou ${card.label} (${MARK_META[card.mark].name}).`);
    }

    if (checkNotebookLimit()) return;

    state.turn = nextTurn;
    render();

    if (state.turn === 'cpu' && !state.gameOver) {
        setTimeout(cpuTurn, 850);
    }
}

/* ==========================================================================
   4. COMPRA RECURSIVA E SORTEIO DE MARCA
   ========================================================================== */
function drawUntilCondition(hand, conditionFn, drawnSoFar = 0) {
    if (hand.length >= 25 || drawnSoFar >= 25) return drawnSoFar;
    const card = drawFromDeck();
    if (!card) return drawnSoFar;

    hand.push(card);
    const nextCount = drawnSoFar + 1;

    if (conditionFn(card)) return nextCount;
    return drawUntilCondition(hand, conditionFn, nextCount);
}

function runMarkRoulette(victim, targetMark) {
    const hand = victim === 'player' ? state.playerHand : state.cpuHand;
    const drawnCount = drawUntilCondition(hand, (c) => c.mark === targetMark);

    state.activeMark = targetMark;
    const name = victim === 'player' ? 'Você' : 'Rival';
    setStatus(`Sorteio (${MARK_META[targetMark].symbol} ${MARK_META[targetMark].name}): ${name} puxou ${drawnCount} folha(s) e perdeu a vez!`);

    if (checkNotebookLimit()) return;

    state.turn = victim === 'player' ? 'cpu' : 'player';
    render();

    if (state.turn === 'cpu' && !state.gameOver) {
        setTimeout(cpuTurn, 850);
    }
}

function giveCards(who, amount) {
    const hand = who === 'player' ? state.playerHand : state.cpuHand;
    for (let i = 0; i < amount; i++) {
        const c = drawFromDeck();
        if (c) hand.push(c);
    }
    checkNotebookLimit();
}

function checkNotebookLimit() {
    if (state.playerHand.length >= 25) {
        render();
        endGame('Caderno Lotado! Rival Venceu', `Você atingiu ${state.playerHand.length} folhas na mão (Limite: 25).`);
        return true;
    }
    if (state.cpuHand.length >= 25) {
        render();
        endGame('Caderno Lotado! Você Venceu!', `O Rival atingiu ${state.cpuHand.length} folhas e foi eliminado!`);
        return true;
    }
    return false;
}

function handlePlayerDraw() {
    if (state.gameOver || state.turn !== 'player') return;

    if (state.pendingDraw > 0) {
        acceptPenalty('player');
        return;
    }

    if (state.playerHand.some(canPlayCard)) {
        setStatus('Você já possui uma folha compatível na mão!');
        return;
    }

    // Compra recursiva até encontrar uma folha jogável
    const drawn = drawUntilCondition(state.playerHand, (c) => canPlayCard(c));

    if (checkNotebookLimit()) return;

    setStatus(`Você puxou ${drawn} folha(s) até encontrar uma jogável.`);
    render();
}

function acceptPenalty(who) {
    const amount = state.pendingDraw;
    state.pendingDraw = 0;
    state.lastDrawValue = 0;

    giveCards(who, amount);
    if (state.gameOver) return;

    const name = who === 'player' ? 'Você' : 'Rival';
    setStatus(`${name} puxou +${amount} folhas e passou a vez.`);

    state.turn = who === 'player' ? 'cpu' : 'player';
    render();

    if (state.turn === 'cpu' && !state.gameOver) {
        setTimeout(cpuTurn, 850);
    }
}

/* ==========================================================================
   5. INTELIGÊNCIA DO RIVAL
   ========================================================================== */
function cpuTurn() {
    if (state.gameOver || state.turn !== 'cpu') return;

    const playableIndexes = state.cpuHand
        .map((c, idx) => (canPlayCard(c) ? idx : -1))
        .filter(idx => idx !== -1);

    if (playableIndexes.length > 0) {
        playableIndexes.sort((a, b) => {
            const cardA = state.cpuHand[a];
            const cardB = state.cpuHand[b];
            if (cardA.value === 'REV+4') return 1;
            if (cardB.value === 'REV+4') return -1;
            return cardB.draw - cardA.draw;
        });
        playCard('cpu', playableIndexes[0]);
        return;
    }

    if (state.pendingDraw > 0) {
        acceptPenalty('cpu');
        return;
    }

    const drawn = drawUntilCondition(state.cpuHand, (c) => canPlayCard(c));
    if (checkNotebookLimit()) return;

    if (canPlayCard(state.cpuHand[state.cpuHand.length - 1])) {
        setStatus(`Rival puxou ${drawn} folha(s) e vai jogar...`);
        render();
        setTimeout(() => playCard('cpu', state.cpuHand.length - 1), 650);
    }
}

function chooseBestMarkForCpu() {
    const counts = { sun: 0, moon: 0, star: 0, spiral: 0 };
    state.cpuHand.forEach(c => {
        if (counts[c.mark] !== undefined) counts[c.mark]++;
    });
    return MARKS.reduce((a, b) => (counts[a] >= counts[b] ? a : b));
}

/* ==========================================================================
   6. RENDERIZAÇÃO SKETCHBOOK
   ========================================================================== */
function createCardElement(card, playable = false) {
    const meta = MARK_META[card.mark];
    const div = document.createElement('div');
    div.className = `sketch-card mark-${card.mark} ${playable ? 'playable' : 'unplayable'}`;

    div.innerHTML = `
        <div class="flex items-center justify-between text-xs sm:text-sm font-bold leading-none z-10">
            <span>${card.label}</span>
            <span>${meta.symbol}</span>
        </div>

        <div class="text-center z-10 my-auto">
            <div class="font-sketch-title text-2xl sm:text-3xl font-bold leading-none">${card.label}</div>
            ${card.sub ? `<div class="text-[9px] sm:text-[10px] font-bold tracking-wider opacity-85 mt-1">${card.sub}</div>` : ''}
        </div>

        <div class="flex items-center justify-between text-xs sm:text-sm font-bold leading-none rotate-180 z-10">
            <span>${card.label}</span>
            <span>${meta.symbol}</span>
        </div>
    `;
    return div;
}

function render() {
    const pLen = state.playerHand.length;
    const cLen = state.cpuHand.length;

    els.playerCount.textContent = pLen;
    els.cpuCount.textContent = cLen;

    els.playerMercyBar.style.width = `${Math.min(100, (pLen / 25) * 100)}%`;
    els.cpuMercyBar.style.width = `${Math.min(100, (cLen / 25) * 100)}%`;

    // Mão do Rival (folhas viradas)
    els.cpuHand.innerHTML = '';
    state.cpuHand.forEach(() => {
        const back = document.createElement('div');
        back.className = 'w-7 h-10 sm:w-8 sm:h-11 rounded-md bg-white border-2 border-[#193454] shadow-[2px_2px_0_#193454] flex items-center justify-center';
        back.innerHTML = '<span class="text-xs text-[#193454]">✒</span>';
        els.cpuHand.appendChild(back);
    });

    // Monte e Folha Ativa
    els.deckCount.textContent = `${state.deck.length}`;
    els.discardPile.innerHTML = '';
    const top = getTopCard();
    if (top) {
        els.discardPile.appendChild(createCardElement(top, true));
    }

    const activeMeta = MARK_META[state.activeMark];
    els.activeSuitBadge.textContent = `${activeMeta.symbol} ${activeMeta.name}`;

    // Acúmulo
    if (state.pendingDraw > 0) {
        els.stackBanner.classList.remove('hidden');
        els.stackAmount.textContent = state.pendingDraw;
    } else {
        els.stackBanner.classList.add('hidden');
    }

    const isPlayerTurn = state.turn === 'player' && !state.gameOver;
    els.turnBadge.textContent = isPlayerTurn ? 'Sua Vez' : 'Vez do Rival';
    els.turnBadge.className = `px-3.5 py-1 text-xs sm:text-sm font-bold uppercase tracking-wider border-2 border-[#193454] rounded-full ${
        isPlayerTurn ? 'bg-[#193454] text-white' : 'bg-white text-[#193454]/60'
    }`;

    if (isPlayerTurn && state.pendingDraw > 0) {
        els.acceptPenaltyBtn.classList.remove('hidden');
        els.acceptPenaltyBtn.textContent = `Puxar +${state.pendingDraw} folhas`;
    } else {
        els.acceptPenaltyBtn.classList.add('hidden');
    }

    const hasPlayable = state.playerHand.some(canPlayCard);
    if (isPlayerTurn && state.playerHand.length === 2 && hasPlayable && !state.lastPageCalled) {
        els.unoBtn.classList.remove('hidden');
    } else {
        els.unoBtn.classList.add('hidden');
    }

    // Mão do Jogador
    els.playerHand.innerHTML = '';
    state.playerHand.forEach((card, index) => {
        const playable = isPlayerTurn && canPlayCard(card);
        const cardEl = createCardElement(card, playable);
        if (playable) {
            cardEl.addEventListener('click', () => playCard('player', index));
        }
        els.playerHand.appendChild(cardEl);
    });
}

function setStatus(text) {
    els.statusText.textContent = text;
}

function openMarkPicker(title, callback) {
    els.suitModalTitle.textContent = title;
    state.pendingMarkCallback = callback;
    els.suitModal.classList.remove('hidden');
    els.suitModal.classList.add('flex');
}

function endGame(title, reason) {
    state.gameOver = true;
    els.winnerTitle.textContent = title;
    els.winnerReason.textContent = reason;
    els.gameoverModal.classList.remove('hidden');
    els.gameoverModal.classList.add('flex');
}

/* ==========================================================================
   7. EVENTOS
   ========================================================================== */
els.drawPile.addEventListener('click', handlePlayerDraw);
els.acceptPenaltyBtn.addEventListener('click', () => acceptPenalty('player'));
els.unoBtn.addEventListener('click', () => {
    state.lastPageCalled = true;
    els.unoBtn.classList.add('hidden');
    setStatus('✒ Última Folha anunciada! Descarte sua penúltima carta.');
});

document.getElementById('sort-btn').addEventListener('click', () => {
    state.playerHand.sort((a, b) => {
        if (MARK_META[a.mark].order !== MARK_META[b.mark].order) {
            return MARK_META[a.mark].order - MARK_META[b.mark].order;
        }
        return a.label.localeCompare(b.label);
    });
    render();
});

document.querySelectorAll('.suit-choice').forEach(btn => {
    btn.addEventListener('click', () => {
        const mark = btn.dataset.suit;
        els.suitModal.classList.add('hidden');
        els.suitModal.classList.remove('flex');
        if (state.pendingMarkCallback) {
            const cb = state.pendingMarkCallback;
            state.pendingMarkCallback = null;
            cb(mark);
        }
    });
});

document.getElementById('restart-btn').addEventListener('click', startGame);
document.getElementById('play-again-btn').addEventListener('click', startGame);

startGame();