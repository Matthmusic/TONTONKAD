// BIG BRAIN — contrôleur DOM du panneau de la sidebar (3ᵉ onglet).
// Façon settings-modal.js : IIFE + DOMContentLoaded, aucune logique métier ici.
// Validation → window.BigBrain.validateLiaisons
// Traduction circuit → câbles → window.Circuit.circuitToCables
// Affectation → window.CableAssign.assignCablesToFourreaux
// Création + placement → window.bigBrainGenerate (script.js)

(function () {
  'use strict';

  // ── État en mémoire de session (conservé tant que l'app tourne) ──
  // liaisons : [{ id, nom, circuit: { mode, fam, nbPhases, codePhase, neutre,
  //               codeNeutre, pe, codePE, codeMulti, parallele },
  //               tailleImposee: { type, code } | null,
  //               reserve: { type, code, qty } | null }]
  // tailleImposee fige le fourreau de CETTE liaison (window.CableAssign) —
  // null/absent = choix automatique (comportement normal).
  // reserve marque une liaison FOURREAU DE RÉSERVE (pas un circuit) : type +
  // code de fourreau + quantité, générés vides (aucun câble). Exclusif avec
  // circuit — une liaison réserve n'utilise jamais `circuit`/`tailleImposee`.
  let liaisons = [];
  let selectedIndex = -1;
  let seq = 0;

  // ── Éléments DOM (résolus au DOMContentLoaded) ──
  let paneEl, generateBtn;
  let tauxInput, tailleMaxSelect, harmonieCheckbox, addLiaisonBtn, addReserveBtn, masterListEl, detailEl, footMsgEl;

  // ── Catalogue câbles : familles distinctes + codes d'une famille ──
  function getFamilies() {
    const catalogue = window.CABLES;
    if (!Array.isArray(catalogue)) return [];
    return [...new Set(catalogue.map((c) => c.fam))];
  }
  function getCodesForFam(fam) {
    const catalogue = window.CABLES;
    if (!Array.isArray(catalogue)) return [];
    return catalogue.filter((c) => c.fam === fam).map((c) => c.code);
  }
  function resolveOd(fam, code) {
    const catalogue = window.CABLES;
    if (!Array.isArray(catalogue)) return undefined;
    const spec = catalogue.find((c) => c.fam === fam && c.code === code);
    return spec ? spec.od : undefined;
  }

  // ── Catalogue fourreaux : même garde défensive (window.FOURREAUX peut ne
  // pas être encore chargé) réutilisée partout où un select fourreau se bâtit. ──
  function getFourreauCatalogue() {
    return Array.isArray(window.FOURREAUX) ? window.FOURREAUX : [];
  }

  // ── Codes filtrés par mode de câblage ──
  // mono ⇒ unipolaires ('1x…') seulement ; multi ⇒ tous les autres (3G, 5G, 4x…).
  // Sans ce filtre, « 3x25 » pouvait être choisi comme code de phase en mono,
  // produisant 3 câbles 3x25 étiquetés L1/L2/L3 — électriquement faux.
  // Repli : si le filtrage est vide pour une famille, on rend la liste complète
  // plutôt qu'un select vide (pas de cul-de-sac) — mais le repli est tracé
  // (console.warn) car il réintroduit alors précisément le risque ci-dessus.
  function getCodesForMode(fam, mode) {
    const all = getCodesForFam(fam);
    const uni = (code) => !!(window.PhaseAssign && window.PhaseAssign.isUnipolaire(code));
    const filtered = (mode === 'multi') ? all.filter((c) => !uni(c)) : all.filter(uni);
    if (!filtered.length) {
      // Aucun code du mode visé dans cette famille : liste complète plutôt
      // qu'un select vide (pas de cul-de-sac), mais on le signale — le filtre
      // ne protège plus contre un code électriquement faux.
      console.warn('BIG BRAIN : aucun code ' + mode + ' pour la famille ' + fam + ' — liste complète affichée');
      return all;
    }
    return filtered;
  }

  // Codes par défaut d'une famille, pour les DEUX modes (création de liaison et
  // changement de famille).
  function resetCodes(circuit) {
    const uni = getCodesForMode(circuit.fam, 'mono')[0] || '';
    circuit.codePhase = uni;
    circuit.codeNeutre = uni;
    circuit.codePE = uni;
    circuit.codeMulti = getCodesForMode(circuit.fam, 'multi')[0] || '';
  }

  // Bascule de mode : la saisie de l'autre mode est CONSERVÉE ; on ne remplit
  // que le code du mode visé s'il n'a jamais été renseigné.
  function ensureCodeForMode(circuit) {
    if (circuit.mode === 'multi') {
      if (!circuit.codeMulti) circuit.codeMulti = getCodesForMode(circuit.fam, 'multi')[0] || '';
      return;
    }
    if (!circuit.codePhase) {
      const uni = getCodesForMode(circuit.fam, 'mono')[0] || '';
      circuit.codePhase = uni;
      if (!circuit.codeNeutre) circuit.codeNeutre = uni;
      if (!circuit.codePE) circuit.codePE = uni;
    }
  }

  // ── Traduction circuit → câbles (module pur circuit.js) ──
  function cablesOfCircuit(circuit) {
    if (!window.Circuit || typeof window.Circuit.circuitToCables !== 'function') return [];
    return window.Circuit.circuitToCables(circuit, resolveOd);
  }
  function countCables(circuit) {
    return cablesOfCircuit(circuit).reduce((s, c) => s + c.qty, 0);
  }

  // Texte de comptage affiché dans la liste maître : nb de câbles (circuit)
  // ou nb de fourreaux vides (réserve) — jamais les deux à la fois.
  function countLabel(liaison) {
    if (liaison.reserve) {
      const qty = Math.max(0, Math.floor(Number(liaison.reserve.qty) || 0));
      return qty + ' fourreau(x) réservé(s)';
    }
    return countCables(liaison.circuit) + ' câble(s)';
  }
  function recapText(circuit) {
    const cables = cablesOfCircuit(circuit);
    if (cables.length === 0) {
      return circuit.mode === 'multi'
        ? 'Aucun câble — choisis un câble multiconducteur.'
        : 'Aucun câble — renseigne au moins les phases.';
    }
    const suffixe = { neutre: ' (N)', PE: ' (PE)' };
    const parts = cables.map((c) => `${c.qty}×${c.code}${suffixe[c.fonction] || ''}`);
    const total = cables.reduce((s, c) => s + c.qty, 0);
    return `${parts.join(' + ')} → ${total} câble(s)`;
  }

  // ── Pied de panneau : message de statut / erreurs ──
  function setFootMsg(msg, isError) {
    if (!footMsgEl) return;
    footMsgEl.textContent = msg || '';
    footMsgEl.classList.toggle('bb-foot-error', !!isError);
  }

  // Tri d'affichage du catalogue fourreaux : par FAMILLE d'abord (dans l'ordre
  // où le catalogue les liste — TPC en tête aujourd'hui, ~95% des cas
  // d'usage), taille croissante ensuite au sein de chaque famille. Un tri
  // global par Ø seul noierait les TPC au milieu d'IRL/ICTA de taille proche.
  function sortFourreauxForDisplay(catalogue) {
    const familyOrder = [];
    (catalogue || []).forEach((f) => {
      if (!familyOrder.includes(f.type)) familyOrder.push(f.type);
    });
    return [...(catalogue || [])].sort((a, b) =>
      (familyOrder.indexOf(a.type) - familyOrder.indexOf(b.type)) || (a.od - b.od)
    );
  }

  // Libellé d'affichage commun à tous les selects fourreau du panneau.
  function fourreauLabel(f) {
    return `${f.type} ${f.code} (${f.od} mm)`;
  }

  // Peuple un <select> avec le catalogue fourreaux (triés famille puis
  // taille), valeur `type|code`, option courante marquée `selected` —
  // partagé par buildTailleImposeeRow et buildReserveDetail (même liste,
  // seule la sélection courante diffère).
  function appendFourreauOptions(sel, catalogue, selectedType, selectedCode) {
    sortFourreauxForDisplay(catalogue).forEach((f) => {
      const opt = document.createElement('option');
      opt.value = f.type + '|' + f.code;
      opt.textContent = fourreauLabel(f);
      if (selectedType === f.type && selectedCode === f.code) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  // ── Sélecteur "Taille max fourreau" — peuplé depuis window.FOURREAUX ──
  function populateTailleMax() {
    if (!tailleMaxSelect) return;
    const catalogue = window.FOURREAUX;
    if (!Array.isArray(catalogue) || catalogue.length === 0) return;
    tailleMaxSelect.innerHTML = '';
    const sorted = sortFourreauxForDisplay(catalogue);
    let maxOd = sorted[0] ? sorted[0].od : 0;
    sorted.forEach((f) => {
      const opt = document.createElement('option');
      opt.value = String(f.od);
      opt.textContent = fourreauLabel(f);
      tailleMaxSelect.appendChild(opt);
      if (f.od > maxOd) maxOd = f.od;
    });
    // Par défaut : le plus grand Ø disponible (aucune restriction implicite).
    tailleMaxSelect.value = String(maxOd);
  }

  // ── Rendu MAÎTRE : une liaison par <li> (nom + nb câbles + suppression) ──
  function renderMaster() {
    if (!masterListEl) return;
    masterListEl.innerHTML = '';
    liaisons.forEach((liaison, i) => {
      const li = document.createElement('li');
      li.className = 'bb-liaison-item' + (i === selectedIndex ? ' active' : '') + (liaison.reserve ? ' is-reserve' : '');
      li.dataset.idx = String(i);

      const name = document.createElement('span');
      name.className = 'bb-liaison-name';
      name.textContent = (liaison.reserve ? '📦 ' : '') + liaison.nom;

      const count = document.createElement('span');
      count.className = 'bb-liaison-count';
      count.textContent = countLabel(liaison);

      const renameBtn = document.createElement('button');
      renameBtn.type = 'button';
      renameBtn.className = 'bb-liaison-rename';
      renameBtn.title = 'Renommer la liaison';
      renameBtn.setAttribute('aria-label', 'Renommer la liaison ' + liaison.nom);
      renameBtn.textContent = '✏';

      const dupBtn = document.createElement('button');
      dupBtn.type = 'button';
      dupBtn.className = 'bb-liaison-dup';
      dupBtn.title = 'Dupliquer la liaison';
      dupBtn.setAttribute('aria-label', 'Dupliquer la liaison ' + liaison.nom);
      dupBtn.textContent = '⧉';

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'bb-liaison-del';
      delBtn.title = 'Supprimer la liaison';
      delBtn.setAttribute('aria-label', 'Supprimer la liaison ' + liaison.nom);
      delBtn.textContent = '🗑';

      li.appendChild(name);
      li.appendChild(count);
      li.appendChild(renameBtn);
      li.appendChild(dupBtn);
      li.appendChild(delBtn);
      masterListEl.appendChild(li);
    });
  }

  function updateMasterName(idx) {
    if (!masterListEl) return;
    const li = masterListEl.children[idx];
    if (!li) return;
    const nameEl = li.querySelector('.bb-liaison-name');
    const liaison = liaisons[idx];
    if (nameEl && liaison) nameEl.textContent = (liaison.reserve ? '📦 ' : '') + liaison.nom;
  }

  function updateMasterCount(idx) {
    if (!masterListEl) return;
    const li = masterListEl.children[idx];
    if (!li) return;
    const countEl = li.querySelector('.bb-liaison-count');
    if (countEl && liaisons[idx]) countEl.textContent = countLabel(liaisons[idx]);
  }

  // ── Petits constructeurs DOM pour le bloc circuit ──
  function buildCircuitRow(labelText, fieldEls) {
    const row = document.createElement('div');
    row.className = 'bb-circuit-row';
    const label = document.createElement('span');
    label.className = 'bb-circuit-label';
    label.textContent = labelText;
    const fields = document.createElement('div');
    fields.className = 'bb-circuit-fields';
    fieldEls.forEach((el) => fields.appendChild(el));
    row.appendChild(label);
    row.appendChild(fields);
    return row;
  }

  // Sélecteur « Taille imposée » : fige le fourreau de CETTE liaison (type +
  // code exact du catalogue), en ignorant tailleMaxFourreauOd/typesAutorises
  // (window.CableAssign, voir cable-assign.js). "Auto" (valeur vide) = pas
  // d'imposition, comportement normal. Même format d'affichage que
  // populateTailleMax (le sélecteur global des paramètres).
  function buildTailleImposeeRow(liaison) {
    const sel = document.createElement('select');
    sel.className = 'bb-detail-taille-imposee';
    sel.setAttribute('aria-label', 'Taille de fourreau imposée pour cette liaison');

    const autoOpt = document.createElement('option');
    autoOpt.value = '';
    autoOpt.textContent = 'Auto (choix automatique)';
    sel.appendChild(autoOpt);

    const selected = liaison.tailleImposee;
    appendFourreauOptions(sel, getFourreauCatalogue(), selected ? selected.type : null, selected ? selected.code : null);

    const row = buildCircuitRow('Taille imposée', [sel]);
    row.classList.add('bb-taille-imposee-row');
    return row;
  }

  function buildCodeSelect(className, ariaLabel, codes, selectedCode) {
    const sel = document.createElement('select');
    sel.className = className;
    sel.setAttribute('aria-label', ariaLabel);
    codes.forEach((code) => {
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = code;
      if (code === selectedCode) opt.selected = true;
      sel.appendChild(opt);
    });
    return sel;
  }

  // ── Rendu DÉTAIL : nom de la liaison + bloc circuit (phases/neutre/PE) ──
  function renderDetail() {
    if (!detailEl) return;
    const liaison = liaisons[selectedIndex];
    if (!liaison) {
      detailEl.innerHTML = '<div class="bb-detail-empty">Sélectionne ou crée une liaison.</div>';
      return;
    }
    detailEl.innerHTML = '';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'bb-detail-name';
    nameInput.value = liaison.nom;
    nameInput.setAttribute('aria-label', 'Nom de la liaison');
    detailEl.appendChild(nameInput);

    // Réserve : détail entièrement différent (type de fourreau + quantité,
    // aucun champ circuit) — rendu à part, sortie immédiate.
    if (liaison.reserve) {
      detailEl.appendChild(buildReserveDetail(liaison));
      return;
    }

    detailEl.appendChild(buildTailleImposeeRow(liaison));

    const circuit = liaison.circuit;
    const families = getFamilies();
    const isMulti = circuit.mode === 'multi';
    const codes = getCodesForMode(circuit.fam, circuit.mode);

    // Garde : le code stocké doit appartenir à la liste du mode courant. Sinon
    // le select afficherait codes[0] pendant que l'état garde l'ancienne valeur
    // — et c'est l'état, pas le select, qui alimente la génération.
    if (codes.length) {
      const inList = (code) => (codes.indexOf(code) < 0 ? codes[0] : code);
      if (isMulti) {
        circuit.codeMulti = inList(circuit.codeMulti);
      } else {
        circuit.codePhase = inList(circuit.codePhase);
        circuit.codeNeutre = inList(circuit.codeNeutre);
        circuit.codePE = inList(circuit.codePE);
      }
    }

    const grid = document.createElement('div');
    grid.className = 'bb-circuit-grid';

    // Câblage : mono (un câble par conducteur) ou multi (un seul câble)
    const modeFields = document.createElement('span');
    modeFields.className = 'bb-circuit-modes';
    modeFields.setAttribute('role', 'radiogroup');
    modeFields.setAttribute('aria-label', 'Nature du câblage');
    [
      { value: 'mono', label: 'Mono', title: 'Un câble par conducteur (3 phases + N + PE)' },
      { value: 'multi', label: 'Multi', title: 'Un seul câble multiconducteur (3G, 5G, 4x…)' },
    ].forEach((opt) => {
      const wrap = document.createElement('label');
      wrap.className = 'bb-circuit-mode-opt';
      wrap.title = opt.title;
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.className = 'bb-circuit-mode';
      radio.name = 'bb-circuit-mode';
      radio.value = opt.value;
      radio.checked = (opt.value === (isMulti ? 'multi' : 'mono'));
      wrap.appendChild(radio);
      wrap.appendChild(document.createTextNode(' ' + opt.label));
      modeFields.appendChild(wrap);
    });
    grid.appendChild(buildCircuitRow('Câblage', [modeFields]));

    // Famille
    const famSelect = document.createElement('select');
    famSelect.className = 'bb-circuit-fam';
    famSelect.setAttribute('aria-label', 'Famille de câble du circuit');
    families.forEach((fam) => {
      const opt = document.createElement('option');
      opt.value = fam;
      opt.textContent = fam;
      if (fam === circuit.fam) opt.selected = true;
      famSelect.appendChild(opt);
    });
    grid.appendChild(buildCircuitRow('Famille', [famSelect]));

    if (isMulti) {
      // Un seul câble : son code porte tous les conducteurs.
      const codeMultiSelect = buildCodeSelect('bb-circuit-codemulti', 'Câble multiconducteur', codes, circuit.codeMulti);
      grid.appendChild(buildCircuitRow('Câble', [codeMultiSelect]));
    } else {
      // Phases : nombre × section
      const nbPhasesInput = document.createElement('input');
      nbPhasesInput.type = 'number';
      nbPhasesInput.className = 'bb-circuit-nbphases';
      nbPhasesInput.min = '0';
      nbPhasesInput.max = '6';
      nbPhasesInput.step = '1';
      nbPhasesInput.value = String(circuit.nbPhases != null ? circuit.nbPhases : 0);
      nbPhasesInput.setAttribute('aria-label', 'Nombre de phases');

      const timesSpan = document.createElement('span');
      timesSpan.className = 'bb-circuit-times';
      timesSpan.textContent = '×';

      const codePhaseSelect = buildCodeSelect('bb-circuit-codephase', 'Section des phases', codes, circuit.codePhase);

      grid.appendChild(buildCircuitRow('Phases', [nbPhasesInput, timesSpan, codePhaseSelect]));

      // Neutre : présence + section
      const neutreCheck = document.createElement('input');
      neutreCheck.type = 'checkbox';
      neutreCheck.className = 'bb-circuit-neutre';
      neutreCheck.checked = !!circuit.neutre;
      neutreCheck.setAttribute('aria-label', 'Présence d’un neutre');

      const codeNeutreSelect = buildCodeSelect('bb-circuit-codeneutre', 'Section du neutre', codes, circuit.codeNeutre);
      codeNeutreSelect.disabled = !circuit.neutre;

      grid.appendChild(buildCircuitRow('Neutre', [neutreCheck, codeNeutreSelect]));

      // PE : présence + section
      const peCheck = document.createElement('input');
      peCheck.type = 'checkbox';
      peCheck.className = 'bb-circuit-pe';
      peCheck.checked = !!circuit.pe;
      peCheck.setAttribute('aria-label', 'Présence d’un PE');

      const codePESelect = buildCodeSelect('bb-circuit-codepe', 'Section du PE', codes, circuit.codePE);
      codePESelect.disabled = !circuit.pe;

      grid.appendChild(buildCircuitRow('PE', [peCheck, codePESelect]));
    }

    // Circuits en parallèle
    const paralleleInput = document.createElement('input');
    paralleleInput.type = 'number';
    paralleleInput.className = 'bb-circuit-parallele';
    paralleleInput.min = '1';
    paralleleInput.step = '1';
    paralleleInput.value = String(circuit.parallele != null ? circuit.parallele : 1);
    paralleleInput.setAttribute('aria-label', 'Nombre de circuits en parallèle');

    // Même champ dans les deux modes : N circuits identiques.
    grid.appendChild(buildCircuitRow(isMulti ? 'Quantité' : 'Circuits en parallèle', [paralleleInput]));

    detailEl.appendChild(grid);

    // Récapitulatif live
    const recap = document.createElement('div');
    recap.className = 'bb-circuit-recap';
    recap.textContent = recapText(circuit);
    detailEl.appendChild(recap);
  }

  function updateRecap() {
    const liaison = liaisons[selectedIndex];
    if (!liaison || !detailEl) return;
    const recapEl = detailEl.querySelector('.bb-circuit-recap');
    if (recapEl) recapEl.textContent = recapText(liaison.circuit);
    updateMasterCount(selectedIndex);
  }

  // ── Détail RÉSERVE : type de fourreau + quantité (pas de circuit) ──
  function reserveRecapText(reserve) {
    const qty = Math.max(0, Math.floor(Number(reserve.qty) || 0));
    if (!reserve.type || !reserve.code || qty <= 0) return 'Aucun fourreau — choisis un type et une quantité.';
    return `${qty} fourreau(x) ${reserve.type} ${reserve.code} vide(s)`;
  }

  function buildReserveDetail(liaison) {
    const wrap = document.createElement('div');
    wrap.className = 'bb-circuit-grid';

    const typeSelect = document.createElement('select');
    typeSelect.className = 'bb-reserve-type';
    typeSelect.setAttribute('aria-label', 'Type de fourreau de réserve');
    appendFourreauOptions(typeSelect, getFourreauCatalogue(), liaison.reserve.type, liaison.reserve.code);
    wrap.appendChild(buildCircuitRow('Type de fourreau', [typeSelect]));

    const qtyInput = document.createElement('input');
    qtyInput.type = 'number';
    qtyInput.className = 'bb-reserve-qty';
    qtyInput.min = '1';
    qtyInput.step = '1';
    qtyInput.value = String(liaison.reserve.qty != null ? liaison.reserve.qty : 1);
    qtyInput.setAttribute('aria-label', 'Quantité de fourreaux de réserve');
    wrap.appendChild(buildCircuitRow('Quantité', [qtyInput]));

    const recap = document.createElement('div');
    recap.className = 'bb-circuit-recap';
    recap.textContent = reserveRecapText(liaison.reserve);
    wrap.appendChild(recap);

    return wrap;
  }

  function updateReserveRecap() {
    const liaison = liaisons[selectedIndex];
    if (!liaison || !liaison.reserve || !detailEl) return;
    const recapEl = detailEl.querySelector('.bb-circuit-recap');
    if (recapEl) recapEl.textContent = reserveRecapText(liaison.reserve);
    updateMasterCount(selectedIndex);
  }

  // Circuit par défaut d'une nouvelle liaison — inerte tant que non complété
  // par resetCodes() (addLiaison) ou jamais lu (addReserve, voir plus bas).
  function makeDefaultCircuit() {
    return {
      mode: 'mono', fam: getFamilies()[0] || '',
      nbPhases: 3, codePhase: '', neutre: true, codeNeutre: '', pe: true, codePE: '',
      codeMulti: '', parallele: 1,
    };
  }

  // ── Actions maître ──
  function addLiaison() {
    seq += 1;
    const circuit = makeDefaultCircuit();
    resetCodes(circuit);
    liaisons.push({ id: 'L' + seq, nom: 'Liaison ' + seq, circuit, tailleImposee: null, reserve: null });
    selectedIndex = liaisons.length - 1;
    renderMaster();
    renderDetail();
  }

  // Fourreau de réserve : pas de circuit, juste un type de fourreau + une
  // quantité — généré vide (voir window.BigBrain.buildReserveFourreaux).
  // `circuit` reste rempli d'une valeur par défaut inerte (jamais lu tant que
  // `reserve` est renseigné) pour garder une forme de liaison uniforme.
  function addReserve() {
    seq += 1;
    const first = sortFourreauxForDisplay(getFourreauCatalogue())[0];
    liaisons.push({
      id: 'L' + seq, nom: 'Réserve ' + seq, circuit: makeDefaultCircuit(), tailleImposee: null,
      reserve: { type: first ? first.type : '', code: first ? first.code : '', qty: 1 },
    });
    selectedIndex = liaisons.length - 1;
    renderMaster();
    renderDetail();
  }

  function selectLiaison(idx) {
    selectedIndex = idx;
    renderMaster();
    renderDetail();
  }

  function deleteLiaison(idx) {
    const liaison = liaisons[idx];
    if (!liaison) return;
    if (!confirm(`Supprimer la liaison « ${liaison.nom} » ?`)) return;
    liaisons.splice(idx, 1);
    if (selectedIndex === idx) selectedIndex = -1;
    else if (selectedIndex > idx) selectedIndex -= 1;
    renderMaster();
    renderDetail();
  }

  // Dupliquer : copie profonde du circuit (éditer la copie ne doit jamais
  // affecter l'originale), insérée juste après la source, puis sélectionnée.
  function duplicateLiaison(idx) {
    const liaison = liaisons[idx];
    if (!liaison) return;
    seq += 1;
    const copie = {
      id: 'L' + seq,
      nom: liaison.nom + ' (copie)',
      circuit: JSON.parse(JSON.stringify(liaison.circuit)),
      tailleImposee: liaison.tailleImposee ? { ...liaison.tailleImposee } : null,
      reserve: liaison.reserve ? { ...liaison.reserve } : null,
    };
    liaisons.splice(idx + 1, 0, copie);
    selectedIndex = idx + 1;
    renderMaster();
    renderDetail();
  }

  // Renommer : sélectionne la liaison (si besoin) puis donne le focus + la
  // sélection au champ nom du panneau détail, prêt à taper — pas de prompt(),
  // réutilise le champ d'édition live déjà câblé dans renderDetail().
  function renameLiaison(idx) {
    if (!liaisons[idx]) return;
    if (selectedIndex !== idx) selectLiaison(idx);
    const nameInput = detailEl && detailEl.querySelector('.bb-detail-name');
    if (nameInput) {
      nameInput.focus();
      nameInput.select();
    }
  }

  // ── Import Caneco : carnet de câbles (.xls/.xlsx) → liaisons BIG BRAIN ──
  // Parsing pur délégué à window.CanecoImport (caneco-import.js) ; lecture du
  // fichier (FileReader + SheetJS) et rendu du panneau de sélection restent
  // ici, façon reste du contrôleur DOM. drafts[i] = { rowIndex, nom,
  // selectable, warning, liaison } — voir caneco-import.js pour le détail.
  let canecoModalEl, canecoFileInputEl, canecoPickFileBtn, canecoFileErrorEl;
  let canecoStepFileEl, canecoStepPickEl, canecoPickListEl, canecoPickSummaryEl;
  let canecoImportConfirmBtn, canecoSelectAllBtn, canecoSelectNoneBtn;
  let canecoDrafts = [];

  // Même format de circuit que le reste du panneau (voir circuitToCables) :
  // recapText() est directement réutilisable pour le récapitulatif des lignes.
  function canecoSummary(circuit) {
    const famTxt = circuit.fam || '⚠ famille à choisir';
    return famTxt + ' · ' + recapText(circuit);
  }

  // SheetJS (xlsx.full.min.js, ~864 Ko) n'est PAS chargé par index.html —
  // Caneco est une fonctionnalité rare, pas la peine d'alourdir le démarrage
  // de l'appli pour tout le monde. Injecté à la demande, mis en cache (un
  // seul <script>, même si le modal est rouvert plusieurs fois).
  let xlsxLoadPromise = null;
  function loadXlsxLib() {
    if (window.XLSX) return Promise.resolve();
    if (!xlsxLoadPromise) {
      xlsxLoadPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'xlsx.full.min.js';
        script.onload = () => resolve();
        script.onerror = () => { xlsxLoadPromise = null; reject(new Error('xlsx.full.min.js introuvable')); };
        document.head.appendChild(script);
      });
    }
    return xlsxLoadPromise;
  }

  function openCanecoModal() {
    if (!canecoModalEl) return;
    canecoDrafts = [];
    if (canecoFileInputEl) canecoFileInputEl.value = '';
    if (canecoFileErrorEl) canecoFileErrorEl.textContent = '';
    if (canecoStepFileEl) canecoStepFileEl.classList.remove('hidden');
    if (canecoStepPickEl) canecoStepPickEl.classList.add('hidden');
    if (canecoImportConfirmBtn) canecoImportConfirmBtn.classList.add('hidden');
    canecoModalEl.style.display = 'flex';
    // Démarre le chargement dès l'ouverture (avant même le choix du fichier)
    // pour qu'il ait des chances d'être déjà prêt une fois le fichier choisi
    // — l'échec réel (fichier manquant) est de toute façon re-signalé par
    // handleCanecoFile() au moment où il compte vraiment.
    loadXlsxLib().catch(() => {});
  }

  function closeCanecoModal() {
    if (canecoModalEl) canecoModalEl.style.display = 'none';
  }

  function renderCanecoPickList() {
    if (!canecoPickListEl) return;
    canecoPickListEl.innerHTML = '';
    let selectableCount = 0;
    let reserveCount = 0;
    canecoDrafts.forEach((d, i) => {
      if (!d.selectable) { reserveCount += 1; return; }
      selectableCount += 1;

      const li = document.createElement('li');
      li.className = 'caneco-pick-item' + (d.warning ? ' has-warning' : '');
      li.dataset.idx = String(i);

      const label = document.createElement('label');
      const check = document.createElement('input');
      check.type = 'checkbox';
      check.className = 'caneco-pick-check';
      check.checked = true;
      label.appendChild(check);

      const name = document.createElement('span');
      name.className = 'caneco-pick-name';
      name.textContent = d.nom;
      label.appendChild(name);

      const summary = document.createElement('span');
      summary.className = 'caneco-pick-summary-text';
      summary.textContent = canecoSummary(d.liaison.circuit);
      label.appendChild(summary);

      li.appendChild(label);

      if (d.warning) {
        const warn = document.createElement('span');
        warn.className = 'caneco-pick-warning';
        warn.title = d.warning;
        warn.textContent = '⚠️';
        li.appendChild(warn);
      }

      canecoPickListEl.appendChild(li);
    });

    if (canecoPickSummaryEl) {
      canecoPickSummaryEl.textContent = selectableCount + ' liaison(s) détectée(s)' +
        (reserveCount ? ' · ' + reserveCount + ' réserve(s) ignorée(s)' : '');
    }
    if (canecoImportConfirmBtn) canecoImportConfirmBtn.classList.toggle('hidden', selectableCount === 0);
  }

  async function handleCanecoFile(file) {
    if (!file) return;
    if (canecoFileErrorEl) canecoFileErrorEl.textContent = '';
    try {
      await loadXlsxLib();
    } catch (err) {
      if (canecoFileErrorEl) canecoFileErrorEl.textContent = 'Lecteur de fichier Excel indisponible — rechargez l\'application (Ctrl+R).';
      return;
    }
    if (!window.CanecoImport || typeof window.CanecoImport.parseWorkbook !== 'function') {
      if (canecoFileErrorEl) canecoFileErrorEl.textContent = 'Module d\'import Caneco indisponible — rechargez l\'application (Ctrl+R).';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const wb = window.XLSX.read(reader.result, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
        canecoDrafts = window.CanecoImport.parseWorkbook(rows, window.CABLES);

        if (!canecoDrafts.some((d) => d.selectable)) {
          if (canecoFileErrorEl) canecoFileErrorEl.textContent = 'Aucune liaison exploitable trouvée dans ce fichier.';
          return;
        }

        if (canecoStepFileEl) canecoStepFileEl.classList.add('hidden');
        if (canecoStepPickEl) canecoStepPickEl.classList.remove('hidden');
        renderCanecoPickList();
      } catch (err) {
        console.error('[Caneco] échec de lecture du fichier', err);
        if (canecoFileErrorEl) canecoFileErrorEl.textContent = 'Fichier illisible — vérifiez qu\'il s\'agit bien d\'un export Caneco (.xls/.xlsx).';
      }
    };
    reader.onerror = () => {
      if (canecoFileErrorEl) canecoFileErrorEl.textContent = 'Échec de lecture du fichier.';
    };
    reader.readAsArrayBuffer(file);
  }

  // Chaque liaison importée devient une entrée normale de `liaisons[]` — même
  // schéma id/nom/circuit/tailleImposee que addLiaison(), donc immédiatement
  // éditable dans le panneau détail comme n'importe quelle liaison créée à la main.
  function confirmCanecoImport() {
    if (!canecoPickListEl) return;
    const checked = new Set(
      Array.from(canecoPickListEl.querySelectorAll('.caneco-pick-check:checked'))
        .map((cb) => Number(cb.closest('.caneco-pick-item').dataset.idx))
    );
    let importedCount = 0;
    canecoDrafts.forEach((d, i) => {
      if (!d.selectable || !checked.has(i)) return;
      seq += 1;
      liaisons.push({ id: 'L' + seq, nom: d.liaison.nom, circuit: d.liaison.circuit, tailleImposee: null, reserve: null });
      importedCount += 1;
    });

    closeCanecoModal();
    if (importedCount) {
      selectedIndex = liaisons.length - 1;
      renderMaster();
      renderDetail();
      if (typeof window.showToast === 'function') {
        window.showToast(`✅ ${importedCount} liaison(s) importée(s) depuis Caneco`, 'success');
      }
    }
  }

  // ── Point d'entrée de rafraîchissement ──
  // window.FOURREAUX peut ne pas être encore chargé à l'init (DOMContentLoaded).
  // script.js appelle ce point d'entrée quand l'onglet BIG BRAIN devient actif,
  // pour re-peupler la taille max et re-rendre liste + détail à coup sûr.
  window.bigBrainPanelRefresh = () => {
    populateTailleMax();
    renderMaster();
    renderDetail();
  };

  // ── Debug console : visibilité sur l'affectation câbles → fourreaux ──
  // Toujours actif (coût négligeable) : un regroupement qui semble illogique
  // (ex. beaucoup de fourreaux à 1 seul câble) se diagnostique en ouvrant la
  // console (Ctrl+Shift+I) plutôt qu'en relisant cable-assign.js.
  function logGeneration(built, opts, result) {
    const totalUnites = built.reduce((s, l) => s + l.cables.reduce((s2, c) => s2 + (c.qty || 0), 0), 0);
    console.groupCollapsed(`[BIG BRAIN] génération — ${built.length} liaison(s), ${totalUnites} câble(s) → ${result.fourreaux.length} fourreau(x)`);
    console.log('[BIG BRAIN] options', opts);
    // Texte brut (pas un tableau d'objets) : reste lisible tel quel dans un
    // copier-coller de la console, sans avoir à déplier chaque ligne.
    console.log('[BIG BRAIN] liaisons\n' + built.map((l) =>
      `  #${l.id} "${l.nom}": ${l.cables.map((c) => `${c.qty}×${c.code}(Ø${c.od}, ${c.fonction || 'aucune'})`).join(' + ') || '(vide)'}`
    ).join('\n'));
    console.table(result.fourreaux.map((f, i) => ({
      '#': i, type: f.type, code: f.code,
      cables: f.cables.length,
      'Ø int (mm)': f.id,
      'taux (%)': (f.tauxOccupation * 100).toFixed(1),
    })));
    if (result.nonPlaces && result.nonPlaces.length) {
      console.warn('[BIG BRAIN] non placés', result.nonPlaces.map((n) => `${n.fam} ${n.code} (Ø${n.od})`));
    }
    // Repère visuel pour l'anomalie déjà rencontrée : beaucoup de fourreaux
    // à 1 seul câble alors qu'il y avait plusieurs liaisons à regrouper.
    const single = result.fourreaux.filter((f) => f.cables.length === 1).length;
    if (result.fourreaux.length >= 3 && single === result.fourreaux.length && totalUnites > result.fourreaux.length) {
      console.warn('[BIG BRAIN] suspect : tous les fourreaux ne contiennent qu’un seul câble — regroupement peut-être manqué.');
    }
    console.groupEnd();
  }

  // Formate un résultat { ok, errors:[{index,message}] } (validateLiaisons ou
  // validateReserves) en messages "<nom de la liaison> : <message>" — par NOM
  // plutôt que par position, car circuits et réserves sont validés dans deux
  // listes filtrées séparées où un simple « Liaison N » désignerait la
  // mauvaise entrée dès qu'elles sont entremêlées dans la liste maître.
  function formatErrors(list, validation, fallbackLabel) {
    if (validation.ok) return [];
    return validation.errors.map((e) => `${(list[e.index] || {}).nom || fallbackLabel} : ${e.message}`);
  }

  // ── Générer : validation → affectation → création (déléguées) ──
  function generate() {
    if (!window.BigBrain || !window.CableAssign || !window.Circuit || typeof window.bigBrainGenerate !== 'function') {
      setFootMsg('BIG BRAIN n\'a pas pu démarrer — rechargez l\'application (Ctrl+R).', true);
      return;
    }
    if (liaisons.length === 0) {
      setFootMsg('Aucune liaison définie', true);
      return;
    }

    // Deux natures de liaison, jamais mélangées dans un même moteur : les
    // circuits (câbles → cable-assign.js, empaquetage) et les réserves
    // (fourreaux vides, type+taille déjà choisis — window.BigBrain.buildReserveFourreaux).
    const circuitLiaisons = liaisons.filter((l) => !l.reserve);
    const reserveLiaisons = liaisons.filter((l) => l.reserve);

    // Chaque liaison circuit porte un circuit électrique (phases/neutre/PE)
    // traduit en câbles par le module pur circuit.js — format inchangé pour
    // les moteurs (validateLiaisons, assignCablesToFourreaux).
    const resolveOdFn = (fam, code) => resolveOd(fam, code);
    const built = circuitLiaisons.map((l) => ({
      id: l.id,
      nom: l.nom,
      cables: window.Circuit.circuitToCables(l.circuit, resolveOdFn),
      tailleImposee: l.tailleImposee || null,
    }));

    const errors = [
      ...(built.length ? formatErrors(built, window.BigBrain.validateLiaisons(built), 'Liaison') : []),
      ...formatErrors(reserveLiaisons, window.BigBrain.validateReserves(reserveLiaisons, window.FOURREAUX), 'Réserve'),
    ];
    if (errors.length) {
      setFootMsg(errors.join(' · '), true);
      return;
    }
    // Validation passée : efface un message d'erreur laissé par une
    // tentative précédente (ex. quantité invalide corrigée puis regénérée) —
    // sinon il reste affiché indéfiniment après un succès.
    setFootMsg('', false);

    const typesAutorises = Array.from(document.querySelectorAll('.bb-type:checked')).map((cb) => cb.value);
    const opts = {
      tauxMax: (Number(tauxInput.value) || 33) / 100,
      tailleMaxFourreauOd: Number(tailleMaxSelect.value) || null,
      typesAutorises,
      harmonie: !!(harmonieCheckbox && harmonieCheckbox.checked),
    };

    // Réserves : jamais empaquetées (type+taille déjà fixés par l'utilisateur,
    // rien à optimiser) — simplement concaténées au résultat de l'empaquetage
    // des circuits (window.BigBrain.buildGenerationResult).
    const cableResult = window.CableAssign.assignCablesToFourreaux(built, window.FOURREAUX, opts);
    const result = window.BigBrain.buildGenerationResult(cableResult, reserveLiaisons, window.FOURREAUX);
    logGeneration(built, opts, result);

    // Rien à générer (ex. câbles trop gros pour la taille max fourreau, ou
    // taux d'occupation trop bas) : ne pas proposer Remplacer/Ajouter — un
    // "Remplacer" sur un résultat vide viderait le plan existant sans rien
    // recréer. Le panneau reste affiché pour ajuster les paramètres.
    if (!result.fourreaux || result.fourreaux.length === 0) {
      const nonPlaces = result.nonPlaces || [];
      const msg = `Aucun fourreau ne convient : ${nonPlaces.length} câble(s) non plaçable(s) — augmente la taille max de fourreau ou le taux d'occupation.`;
      setFootMsg(msg, true);
      if (typeof window.showToast === 'function') {
        window.showToast(`⚠️ ${msg}`, 'warning', 7000);
      }
      return;
    }

    const replace = (typeof window.confirmReplaceOrAdd === 'function')
      ? window.confirmReplaceOrAdd('la génération BIG BRAIN')
      : confirm('Remplacer le plan actuel par la génération BIG BRAIN ?\n\nOK = Remplacer le plan\nAnnuler = Ajouter au plan existant');

    const liaisonsById = Object.fromEntries(built.map((l) => [l.id, l.nom]));
    const summary = window.bigBrainGenerate(result, liaisonsById, replace, built);

    const nonPlaces = result.nonPlaces || [];
    if (nonPlaces.length) {
      const detail = nonPlaces.map((n) => `${n.fam} ${n.code} (Ø${n.od})`).join(', ');
      // Le moteur calcule déjà une raison précise par câble non placé (voir
      // cable-assign.js) — l'afficher répond directement au « pourquoi »,
      // au lieu de forcer un détour par la console pour le savoir.
      const raisons = [...new Set(nonPlaces.map((n) => n.raison).filter(Boolean))];
      const raisonTxt = raisons.length === 1 ? ` (${raisons[0]})` : (raisons.length > 1 ? ' (raisons multiples, voir console)' : '');
      if (typeof window.showToast === 'function') {
        window.showToast(`⚠️ ${nonPlaces.length} câble(s) non placé(s)${raisonTxt} : ${detail}`, 'warning', 7000);
      }
    } else if (typeof window.showToast === 'function') {
      window.showToast(`✅ BIG BRAIN : ${summary.created} fourreau(x) généré(s)`, 'success');
    }
  }

  // ── Initialisation ──
  document.addEventListener('DOMContentLoaded', () => {
    paneEl = document.getElementById('paneBIGBRAIN');
    generateBtn = document.getElementById('bigBrainGenerateBtn');
    tauxInput = document.getElementById('bbTaux');
    tailleMaxSelect = document.getElementById('bbTailleMax');
    harmonieCheckbox = document.getElementById('bbHarmonie');
    addLiaisonBtn = document.getElementById('bbAddLiaison');
    addReserveBtn = document.getElementById('bbAddReserve');
    masterListEl = document.getElementById('bbLiaisonList');
    detailEl = document.getElementById('bbDetail');
    footMsgEl = document.getElementById('bbFootMsg');

    canecoModalEl = document.getElementById('canecoImportModal');
    canecoFileInputEl = document.getElementById('canecoFileInput');
    canecoPickFileBtn = document.getElementById('canecoPickFileBtn');
    canecoFileErrorEl = document.getElementById('canecoFileError');
    canecoStepFileEl = document.getElementById('canecoStepFile');
    canecoStepPickEl = document.getElementById('canecoStepPick');
    canecoPickListEl = document.getElementById('canecoPickList');
    canecoPickSummaryEl = document.getElementById('canecoPickSummary');
    canecoImportConfirmBtn = document.getElementById('canecoImportConfirm');
    canecoSelectAllBtn = document.getElementById('canecoSelectAll');
    canecoSelectNoneBtn = document.getElementById('canecoSelectNone');

    if (!paneEl) return; // markup absent → rien à câbler

    // Le panneau vit en permanence dans la sidebar : pas d'ouverture/fermeture,
    // juste masqué/affiché par la bascule d'onglets (setTab, script.js). On
    // initialise l'état une fois ici (garde défensive si FOURREAUX/CABLES sont
    // déjà chargés) ; script.js rappelle window.bigBrainPanelRefresh à chaque
    // activation de l'onglet pour couvrir le cas où ils ne l'étaient pas encore.
    populateTailleMax();
    setFootMsg('', false);
    renderMaster();
    renderDetail();

    if (addLiaisonBtn) addLiaisonBtn.addEventListener('click', addLiaison);
    if (addReserveBtn) addReserveBtn.addEventListener('click', addReserve);
    if (generateBtn) generateBtn.addEventListener('click', generate);

    // ── Import Caneco ──
    const canecoImportBtn = document.getElementById('bbImportCaneco');
    if (canecoImportBtn) canecoImportBtn.addEventListener('click', openCanecoModal);

    if (canecoModalEl) {
      const canecoCloseBtn = document.getElementById('canecoImportClose');
      const canecoCancelBtn = document.getElementById('canecoImportCancel');
      if (canecoCloseBtn) canecoCloseBtn.addEventListener('click', closeCanecoModal);
      if (canecoCancelBtn) canecoCancelBtn.addEventListener('click', closeCanecoModal);
      canecoModalEl.addEventListener('click', (e) => {
        if (e.target === canecoModalEl) closeCanecoModal();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && canecoModalEl.style.display === 'flex') closeCanecoModal();
      });
    }
    if (canecoPickFileBtn) {
      canecoPickFileBtn.addEventListener('click', () => canecoFileInputEl && canecoFileInputEl.click());
    }
    if (canecoFileInputEl) {
      canecoFileInputEl.addEventListener('change', (e) => {
        handleCanecoFile(e.target.files && e.target.files[0]);
      });
    }
    if (canecoImportConfirmBtn) canecoImportConfirmBtn.addEventListener('click', confirmCanecoImport);
    if (canecoSelectAllBtn) {
      canecoSelectAllBtn.addEventListener('click', () => {
        canecoPickListEl.querySelectorAll('.caneco-pick-check').forEach((cb) => { cb.checked = true; });
      });
    }
    if (canecoSelectNoneBtn) {
      canecoSelectNoneBtn.addEventListener('click', () => {
        canecoPickListEl.querySelectorAll('.caneco-pick-check').forEach((cb) => { cb.checked = false; });
      });
    }

    if (masterListEl) {
      masterListEl.addEventListener('click', (e) => {
        const li = e.target.closest('.bb-liaison-item');
        if (!li) return;
        const idx = Number(li.dataset.idx);
        if (e.target.closest('.bb-liaison-del')) {
          e.stopPropagation();
          deleteLiaison(idx);
          return;
        }
        if (e.target.closest('.bb-liaison-dup')) {
          e.stopPropagation();
          duplicateLiaison(idx);
          return;
        }
        if (e.target.closest('.bb-liaison-rename')) {
          e.stopPropagation();
          renameLiaison(idx);
          return;
        }
        selectLiaison(idx);
      });
    }

    if (detailEl) {
      // Saisie live (nom, nombre de phases, parallèle) : mise à jour d'état
      // sans re-rendu complet pour ne pas faire perdre le focus/curseur
      // pendant la frappe — seul le récapitulatif est rafraîchi.
      detailEl.addEventListener('input', (e) => {
        const target = e.target;
        const liaison = liaisons[selectedIndex];
        if (!liaison) return;
        if (target.classList.contains('bb-detail-name')) {
          liaison.nom = target.value;
          updateMasterName(selectedIndex);
          return;
        }
        if (target.classList.contains('bb-reserve-qty')) {
          if (liaison.reserve) liaison.reserve.qty = target.value;
          updateReserveRecap();
          return;
        }
        const circuit = liaison.circuit;
        if (target.classList.contains('bb-circuit-nbphases')) {
          circuit.nbPhases = target.value;
          updateRecap();
        } else if (target.classList.contains('bb-circuit-parallele')) {
          circuit.parallele = target.value;
          updateRecap();
        }
      });

      // Changement de select/case à cocher : structure dépendante (famille →
      // codes disponibles, neutre/PE → select activé/désactivé) → re-rendu
      // détail complet. Les selects de code seuls n'affectent pas la
      // structure : récapitulatif seul rafraîchi.
      detailEl.addEventListener('change', (e) => {
        const target = e.target;
        const liaison = liaisons[selectedIndex];
        if (!liaison) return;
        const circuit = liaison.circuit;
        if (target.classList.contains('bb-circuit-mode')) {
          circuit.mode = (target.value === 'multi') ? 'multi' : 'mono';
          ensureCodeForMode(circuit);
          renderDetail();
          // renderDetail() détruit les radios : rendre le focus au mode coché
          // pour ne pas casser la navigation au clavier dans le groupe.
          const modeRadio = detailEl.querySelector('.bb-circuit-mode:checked');
          if (modeRadio) modeRadio.focus();
        } else if (target.classList.contains('bb-circuit-fam')) {
          circuit.fam = target.value;
          resetCodes(circuit);
          renderDetail();
        } else if (target.classList.contains('bb-circuit-codemulti')) {
          circuit.codeMulti = target.value;
          updateRecap();
        } else if (target.classList.contains('bb-circuit-neutre')) {
          circuit.neutre = target.checked;
          renderDetail();
        } else if (target.classList.contains('bb-circuit-pe')) {
          circuit.pe = target.checked;
          renderDetail();
        } else if (target.classList.contains('bb-circuit-codephase')) {
          circuit.codePhase = target.value;
          updateRecap();
        } else if (target.classList.contains('bb-circuit-codeneutre')) {
          circuit.codeNeutre = target.value;
          updateRecap();
        } else if (target.classList.contains('bb-circuit-codepe')) {
          circuit.codePE = target.value;
          updateRecap();
        } else if (target.classList.contains('bb-detail-taille-imposee')) {
          if (!target.value) {
            liaison.tailleImposee = null;
          } else {
            const [type, code] = target.value.split('|');
            liaison.tailleImposee = { type, code };
          }
        } else if (target.classList.contains('bb-reserve-type')) {
          if (liaison.reserve) {
            const [type, code] = target.value.split('|');
            liaison.reserve.type = type;
            liaison.reserve.code = code;
          }
          updateReserveRecap();
        } else {
          return;
        }
        updateMasterCount(selectedIndex);
      });
    }
  });
})();
