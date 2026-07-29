// BIG BRAIN — contrôleur DOM de la modale (disposition maître-détail).
// Façon settings-modal.js : IIFE + DOMContentLoaded, aucune logique métier ici.
// Validation → window.BigBrain.validateLiaisons
// Traduction circuit → câbles → window.Circuit.circuitToCables
// Affectation → window.CableAssign.assignCablesToFourreaux
// Création + placement → window.bigBrainGenerate (script.js)

(function () {
  'use strict';

  // ── État en mémoire de session (conservé tant que l'app tourne) ──
  // liaisons : [{ id, nom, circuit: { fam, nbPhases, codePhase, neutre,
  //               codeNeutre, pe, codePE, parallele } }]
  let liaisons = [];
  let selectedIndex = -1;
  let seq = 0;

  // ── Éléments DOM (résolus au DOMContentLoaded) ──
  let openBtn, modalEl, closeBtn, cancelBtn, generateBtn;
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
    if (cables.length === 0) return 'Aucun câble — renseigne au moins les phases.';
    const suffixe = { neutre: ' (N)', PE: ' (PE)' };
    const parts = cables.map((c) => `${c.qty}×${c.code}${suffixe[c.fonction] || ''}`);
    const total = cables.reduce((s, c) => s + c.qty, 0);
    return `${parts.join(' + ')} → ${total} câble(s)`;
  }

  // ── Pied de modale : message de statut / erreurs ──
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
    const codes = getCodesForFam(circuit.fam);

    const grid = document.createElement('div');
    grid.className = 'bb-circuit-grid';

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

    // Circuits en parallèle
    const paralleleInput = document.createElement('input');
    paralleleInput.type = 'number';
    paralleleInput.className = 'bb-circuit-parallele';
    paralleleInput.min = '1';
    paralleleInput.step = '1';
    paralleleInput.value = String(circuit.parallele != null ? circuit.parallele : 1);
    paralleleInput.setAttribute('aria-label', 'Nombre de circuits en parallèle');

    grid.appendChild(buildCircuitRow('Circuits en parallèle', [paralleleInput]));

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
    const fam = getFamilies()[0] || '';
    const firstCode = getCodesForFam(fam)[0] || '';
    liaisons.push({
      id: 'L' + seq,
      nom: 'Liaison ' + seq,
      circuit: {
        fam, nbPhases: 3, codePhase: firstCode,
        neutre: true, codeNeutre: firstCode, pe: true, codePE: firstCode,
        parallele: 1,
      },
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

  // ── Ouverture / fermeture ──
  function open() {
    populateTailleMax();
    // Déplacer la modale en fin de <body> : un conteneur parent avec overflow ou
    // transform casse le centrage d'un élément position:fixed (même remède que
    // la modale d'export PDF).
    if (modalEl.parentElement !== document.body) document.body.appendChild(modalEl);
    modalEl.style.display = 'flex';
    setFootMsg('', false);
    renderMaster();
    renderDetail();
  }

  function close() {
    modalEl.style.display = 'none';
    // `liaisons` reste en mémoire de session : réouverture = même contenu.
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

    // Rien à générer (ex. câbles trop gros pour la taille max fourreau, ou
    // taux d'occupation trop bas) : ne pas proposer Remplacer/Ajouter — un
    // "Remplacer" sur un résultat vide viderait le plan existant sans rien
    // recréer. La modale reste ouverte pour ajuster les paramètres.
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

    close();
  }

  // ── Initialisation ──
  document.addEventListener('DOMContentLoaded', () => {
    openBtn = document.getElementById('tabBIGBRAIN');
    modalEl = document.getElementById('bigBrainModal');
    closeBtn = document.getElementById('bigBrainClose');
    cancelBtn = document.getElementById('bigBrainCancel');
    generateBtn = document.getElementById('bigBrainGenerateBtn');
    tauxInput = document.getElementById('bbTaux');
    tailleMaxSelect = document.getElementById('bbTailleMax');
    addLiaisonBtn = document.getElementById('bbAddLiaison');
    masterListEl = document.getElementById('bbLiaisonList');
    detailEl = document.getElementById('bbDetail');
    footMsgEl = document.getElementById('bbFootMsg');

    if (!openBtn || !modalEl) return; // markup absent → rien à câbler

    // L'onglet BIG BRAIN ouvre la modale ; il ne bascule pas de panneau (pas
    // de setTab — la logique d'onglets FOURREAU/CÂBLE reste dans script.js).
    openBtn.addEventListener('click', open);
    // Fallback défensif : si l'ancien bouton de la barre du bas existe encore, le câbler aussi.
    const legacyOpenBtn = document.getElementById('bigBrainBtn');
    if (legacyOpenBtn) legacyOpenBtn.addEventListener('click', open);
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (cancelBtn) cancelBtn.addEventListener('click', close);
    modalEl.addEventListener('click', (e) => {
      if (e.target === modalEl) close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modalEl.style.display === 'flex') close();
    });

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
        if (target.classList.contains('bb-circuit-fam')) {
          circuit.fam = target.value;
          const firstCode = getCodesForFam(circuit.fam)[0] || '';
          circuit.codePhase = firstCode;
          circuit.codeNeutre = firstCode;
          circuit.codePE = firstCode;
          renderDetail();
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
