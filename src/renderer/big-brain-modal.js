// BIG BRAIN — contrôleur DOM de la modale (disposition maître-détail).
// Façon settings-modal.js : IIFE + DOMContentLoaded, aucune logique métier ici.
// Validation → window.BigBrain.validateLiaisons
// Affectation → window.CableAssign.assignCablesToFourreaux
// Création + placement → window.bigBrainGenerate (script.js)

(function () {
  'use strict';

  // ── État en mémoire de session (conservé tant que l'app tourne) ──
  let liaisons = []; // [{ id, nom, cables: [{ fam, code, od, qty }] }]
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
      count.textContent = liaison.cables.length + ' câble(s)';

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'bb-liaison-del';
      delBtn.title = 'Supprimer la liaison';
      delBtn.setAttribute('aria-label', 'Supprimer la liaison ' + liaison.nom);
      delBtn.textContent = '🗑';

      li.appendChild(name);
      li.appendChild(count);
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

  // ── Rendu DÉTAIL : nom de la liaison sélectionnée + ses câbles ──
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

    const families = getFamilies();

    liaison.cables.forEach((cable, idx) => {
      const row = document.createElement('div');
      row.className = 'bb-cable-row';
      row.dataset.idx = String(idx);

      const famSelect = document.createElement('select');
      famSelect.className = 'bb-cable-fam';
      famSelect.setAttribute('aria-label', 'Famille de câble');
      families.forEach((fam) => {
        const opt = document.createElement('option');
        opt.value = fam;
        opt.textContent = fam;
        if (fam === cable.fam) opt.selected = true;
        famSelect.appendChild(opt);
      });

      const codeSelect = document.createElement('select');
      codeSelect.className = 'bb-cable-code';
      codeSelect.setAttribute('aria-label', 'Code de câble');
      getCodesForFam(cable.fam).forEach((code) => {
        const opt = document.createElement('option');
        opt.value = code;
        opt.textContent = code;
        if (code === cable.code) opt.selected = true;
        codeSelect.appendChild(opt);
      });

      const qtyInput = document.createElement('input');
      qtyInput.type = 'number';
      qtyInput.className = 'bb-cable-qty';
      qtyInput.min = '1';
      qtyInput.step = '1';
      qtyInput.value = String(cable.qty != null ? cable.qty : 1);
      qtyInput.setAttribute('aria-label', 'Quantité');

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'bb-cable-remove';
      removeBtn.title = 'Retirer ce câble';
      removeBtn.textContent = '–';

      row.appendChild(famSelect);
      row.appendChild(codeSelect);
      row.appendChild(qtyInput);
      row.appendChild(removeBtn);
      detailEl.appendChild(row);
    });

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'bb-add-cable';
    addBtn.textContent = '+ Ajouter un câble';
    detailEl.appendChild(addBtn);
  }

  // ── Actions maître ──
  function addLiaison() {
    seq += 1;
    liaisons.push({ id: 'L' + seq, nom: 'Liaison ' + seq, cables: [] });
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

  // ── Actions détail (câbles de la liaison sélectionnée) ──
  function addCableToSelected() {
    const liaison = liaisons[selectedIndex];
    if (!liaison) return;
    const fam = getFamilies()[0] || '';
    const code = getCodesForFam(fam)[0] || '';
    liaison.cables.push({ fam, code, od: resolveOd(fam, code), qty: 1 });
    renderDetail();
    renderMaster();
  }

  function removeCableFromSelected(idx) {
    const liaison = liaisons[selectedIndex];
    if (!liaison) return;
    liaison.cables.splice(idx, 1);
    renderDetail();
    renderMaster();
  }

  // ── Ouverture / fermeture ──
  function open() {
    populateTailleMax();
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
    if (!window.BigBrain || !window.CableAssign || typeof window.bigBrainGenerate !== 'function') {
      setFootMsg('BIG BRAIN indisponible (modules non chargés).', true);
      return;
    }

    // Construction des liaisons pour les modules purs : qty (chaîne d'un
    // <input>) convertie en nombre ici, avant tout appel métier.
    const built = liaisons.map((l) => ({
      id: l.id,
      nom: l.nom,
      cables: l.cables.map((c) => ({
        fam: c.fam,
        code: c.code,
        od: c.od,
        qty: parseInt(c.qty, 10),
      })),
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

    const replace = confirm(
      'Remplacer le plan actuel par la génération BIG BRAIN ?\n\nOK = Remplacer le plan\nAnnuler = Ajouter au plan existant'
    );

    const liaisonsById = Object.fromEntries(built.map((l) => [l.id, l.nom]));
    const summary = window.bigBrainGenerate(result, liaisonsById, replace);

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
    openBtn = document.getElementById('bigBrainBtn');
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

    openBtn.addEventListener('click', open);
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
          deleteLiaison(idx);
          return;
        }
        selectLiaison(idx);
      });
    }

    if (detailEl) {
      // Saisie live (nom, quantité) : mise à jour d'état sans re-rendu complet
      // pour ne pas faire perdre le focus/curseur pendant la frappe.
      detailEl.addEventListener('input', (e) => {
        const target = e.target;
        const liaison = liaisons[selectedIndex];
        if (!liaison) return;
        if (target.classList.contains('bb-detail-name')) {
          liaison.nom = target.value;
          updateMasterName(selectedIndex);
          return;
        }
        const row = target.closest('.bb-cable-row');
        if (!row) return;
        const idx = Number(row.dataset.idx);
        const cable = liaison.cables[idx];
        if (!cable) return;
        if (target.classList.contains('bb-cable-qty')) {
          cable.qty = target.value;
        }
      });

      // Changement de select (fam/code) : structure dépendante → re-rendu détail.
      detailEl.addEventListener('change', (e) => {
        const target = e.target;
        const liaison = liaisons[selectedIndex];
        if (!liaison) return;
        const row = target.closest('.bb-cable-row');
        if (!row) return;
        const idx = Number(row.dataset.idx);
        const cable = liaison.cables[idx];
        if (!cable) return;
        if (target.classList.contains('bb-cable-fam')) {
          cable.fam = target.value;
          cable.code = getCodesForFam(cable.fam)[0] || '';
          cable.od = resolveOd(cable.fam, cable.code);
          renderDetail();
        } else if (target.classList.contains('bb-cable-code')) {
          cable.code = target.value;
          cable.od = resolveOd(cable.fam, cable.code);
        }
      });

      detailEl.addEventListener('click', (e) => {
        if (e.target.closest('.bb-cable-remove')) {
          const row = e.target.closest('.bb-cable-row');
          if (row) removeCableFromSelected(Number(row.dataset.idx));
          return;
        }
        if (e.target.closest('.bb-add-cable')) {
          addCableToSelected();
        }
      });
    }
  });
})();
