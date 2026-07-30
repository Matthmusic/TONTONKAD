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
  //               codeNeutre, pe, codePE, codeMulti, parallele } }]
  let liaisons = [];
  let selectedIndex = -1;
  let seq = 0;

  // ── Éléments DOM (résolus au DOMContentLoaded) ──
  let paneEl, generateBtn;
  let tauxInput, tailleMaxSelect, addLiaisonBtn, masterListEl, detailEl, footMsgEl;

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

  // ── Sélecteur "Taille max fourreau" — peuplé depuis window.FOURREAUX ──
  function populateTailleMax() {
    if (!tailleMaxSelect) return;
    const catalogue = window.FOURREAUX;
    if (!Array.isArray(catalogue) || catalogue.length === 0) return;
    tailleMaxSelect.innerHTML = '';
    const sorted = [...catalogue].sort((a, b) => a.od - b.od);
    let maxOd = sorted[0] ? sorted[0].od : 0;
    sorted.forEach((f) => {
      const opt = document.createElement('option');
      opt.value = String(f.od);
      opt.textContent = `${f.type} ${f.code} (${f.od} mm)`;
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
      li.className = 'bb-liaison-item' + (i === selectedIndex ? ' active' : '');
      li.dataset.idx = String(i);

      const name = document.createElement('span');
      name.className = 'bb-liaison-name';
      name.textContent = liaison.nom;

      const count = document.createElement('span');
      count.className = 'bb-liaison-count';
      count.textContent = countCables(liaison.circuit) + ' câble(s)';

      const renameBtn = document.createElement('button');
      renameBtn.type = 'button';
      renameBtn.className = 'bb-liaison-rename';
      renameBtn.title = 'Renommer la liaison';
      renameBtn.setAttribute('aria-label', 'Renommer la liaison ' + liaison.nom);
      renameBtn.textContent = '✏';

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'bb-liaison-del';
      delBtn.title = 'Supprimer la liaison';
      delBtn.setAttribute('aria-label', 'Supprimer la liaison ' + liaison.nom);
      delBtn.textContent = '🗑';

      li.appendChild(name);
      li.appendChild(count);
      li.appendChild(renameBtn);
      li.appendChild(delBtn);
      masterListEl.appendChild(li);
    });
  }

  function updateMasterName(idx) {
    if (!masterListEl) return;
    const li = masterListEl.children[idx];
    if (!li) return;
    const nameEl = li.querySelector('.bb-liaison-name');
    if (nameEl && liaisons[idx]) nameEl.textContent = liaisons[idx].nom;
  }

  function updateMasterCount(idx) {
    if (!masterListEl) return;
    const li = masterListEl.children[idx];
    if (!li) return;
    const countEl = li.querySelector('.bb-liaison-count');
    if (countEl && liaisons[idx]) countEl.textContent = countCables(liaisons[idx].circuit) + ' câble(s)';
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

  // ── Actions maître ──
  function addLiaison() {
    seq += 1;
    const circuit = {
      mode: 'mono', fam: getFamilies()[0] || '',
      nbPhases: 3, codePhase: '', neutre: true, codeNeutre: '', pe: true, codePE: '',
      codeMulti: '', parallele: 1,
    };
    resetCodes(circuit);
    liaisons.push({ id: 'L' + seq, nom: 'Liaison ' + seq, circuit });
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
    console.log('[BIG BRAIN] liaisons', built.map((l) => ({
      id: l.id, nom: l.nom,
      cables: l.cables.map((c) => `${c.qty}×${c.code}(Ø${c.od})`).join(' + ') || '(vide)',
    })));
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

  // ── Générer : validation → affectation → création (déléguées) ──
  function generate() {
    if (!window.BigBrain || !window.CableAssign || !window.Circuit || typeof window.bigBrainGenerate !== 'function') {
      setFootMsg('BIG BRAIN indisponible (modules non chargés).', true);
      return;
    }

    // Chaque liaison porte un circuit électrique (phases/neutre/PE) traduit
    // en câbles par le module pur circuit.js — format inchangé pour les
    // moteurs (validateLiaisons, assignCablesToFourreaux).
    const resolveOdFn = (fam, code) => resolveOd(fam, code);
    const built = liaisons.map((l) => ({
      id: l.id,
      nom: l.nom,
      cables: window.Circuit.circuitToCables(l.circuit, resolveOdFn),
    }));

    const validation = window.BigBrain.validateLiaisons(built);
    if (!validation.ok) {
      const msg = validation.errors
        .map((e) => (e.index >= 0 ? `Liaison ${e.index + 1} : ${e.message}` : e.message))
        .join(' · ');
      setFootMsg(msg, true);
      return;
    }

    const typesAutorises = Array.from(document.querySelectorAll('.bb-type:checked')).map((cb) => cb.value);
    const opts = {
      tauxMax: (Number(tauxInput.value) || 33) / 100,
      tailleMaxFourreauOd: Number(tailleMaxSelect.value) || null,
      typesAutorises,
    };

    const result = window.CableAssign.assignCablesToFourreaux(built, window.FOURREAUX, opts);
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

    const replace = confirm(
      'Remplacer le plan actuel par la génération BIG BRAIN ?\n\nOK = Remplacer le plan\nAnnuler = Ajouter au plan existant'
    );

    const liaisonsById = Object.fromEntries(built.map((l) => [l.id, l.nom]));
    const summary = window.bigBrainGenerate(result, liaisonsById, replace, built);

    const nonPlaces = result.nonPlaces || [];
    if (nonPlaces.length) {
      const detail = nonPlaces.map((n) => `${n.fam} ${n.code} (Ø${n.od})`).join(', ');
      if (typeof window.showToast === 'function') {
        window.showToast(`⚠️ ${nonPlaces.length} câble(s) non placé(s) : ${detail}`, 'warning', 7000);
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
    addLiaisonBtn = document.getElementById('bbAddLiaison');
    masterListEl = document.getElementById('bbLiaisonList');
    detailEl = document.getElementById('bbDetail');
    footMsgEl = document.getElementById('bbFootMsg');

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
    if (generateBtn) generateBtn.addEventListener('click', generate);

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
        } else {
          return;
        }
        updateMasterCount(selectedIndex);
      });
    }
  });
})();
