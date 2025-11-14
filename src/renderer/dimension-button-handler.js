/**
 * Gestionnaire pour les boutons "Appliquer dimensions"
 * Affiche et fait clignoter le bouton quand les dimensions changent
 */
(function initDimensionButtonHandler() {
    'use strict';

    // Structure gardée pour compatibilité - non utilisée depuis la v1.0.3
    let initialValues = {
        boxW: null,
        boxH: null,
        boxD: null
    };

    // Références aux éléments
    const elements = {
        boxW: null,
        boxH: null,
        boxD: null,
        applyRect: null,
        applyCirc: null,
        shape: null
    };

    // Timers pour gérer les animations
    let blinkTimers = {
        rect: null,
        circ: null
    };

    // Fonction de nettoyage
    function cleanup() {
        Object.values(blinkTimers).forEach(timer => {
            if (timer) clearTimeout(timer);
        });
        blinkTimers = { rect: null, circ: null };
    }

    /**
     * Initialise les références aux éléments DOM
     */
    function initElements() {
        elements.boxW = document.getElementById('boxW');
        elements.boxH = document.getElementById('boxH');
        elements.boxD = document.getElementById('boxD');
        elements.applyRect = document.getElementById('apply');
        elements.applyCirc = document.getElementById('applyCirc');
        elements.shape = document.getElementById('shape');

        // Initialisation gardée pour compatibilité - non utilisée depuis la v1.0.3
        initialValues.boxW = window.WORLD_W_MM || 1000;
        initialValues.boxH = window.WORLD_H_MM || 1000;
        initialValues.boxD = window.WORLD_D_MM || 1000;
    }

    /**
     * Vérifie si les valeurs rectangulaires ont changé
     */
    function hasRectValuesChanged() {
        if (!elements.boxW || !elements.boxH || !elements.shape) return false;

        const currentW = Math.max(0, parseFloat(elements.boxW.value) || 0);
        const currentH = Math.max(0, parseFloat(elements.boxH.value) || 0);
        const currentShape = elements.shape.value;

        // Comparer avec les valeurs actuelles du monde, pas avec les valeurs initiales
        const worldW = window.WORLD_W_MM || 1000;
        const worldH = window.WORLD_H_MM || 1000;
        const worldShape = window.SHAPE || 'rect';

        // Vérifier si on est en mode rectangulaire et si les valeurs ou la forme ont changé
        const isRectMode = (currentShape === 'rect' || currentShape === 'chemin_de_cable');
        const wasRectMode = (worldShape === 'rect' || worldShape === 'chemin_de_cable');
        const shapeChanged = isRectMode && !wasRectMode;

        // Si on vient de changer de forme (de circulaire vers rectangulaire),
        // on considère toujours qu'il y a un changement, même si les valeurs numériques sont identiques
        const valuesChanged = currentW !== worldW || currentH !== worldH;

        return isRectMode && (valuesChanged || shapeChanged);
    }

    /**
     * Vérifie si la valeur circulaire a changé
     */
    function hasCircValueChanged() {
        if (!elements.boxD || !elements.shape) return false;

        const currentD = Math.max(0, parseFloat(elements.boxD.value) || 0);
        const currentShape = elements.shape.value;

        // Comparer avec la valeur actuelle du monde, pas avec la valeur initiale
        const worldD = window.WORLD_D_MM || 1000;
        const worldShape = window.SHAPE || 'rect';

        // Vérifier si on est en mode circulaire et si la valeur ou la forme a changé
        const isCircMode = currentShape === 'circ';
        const wasCircMode = worldShape === 'circ';
        const shapeChanged = isCircMode && !wasCircMode;
        const valueChanged = currentD !== worldD;

        return isCircMode && (valueChanged || shapeChanged);
    }

    /**
     * Affiche le bouton (pulse automatique via CSS)
     */
    function showButton(button, timerKey) {
        if (!button) return;

        // Arrêter le timer précédent s'il existe
        if (blinkTimers[timerKey]) {
            clearTimeout(blinkTimers[timerKey]);
        }

        // Afficher le bouton avec animation
        button.classList.remove('hidden', 'hide');
        button.classList.add('show');

        // Le pulse se fait automatiquement via CSS :not(.hidden):not(.success)
    }

    /**
     * Cache un bouton avec animation
     */
    function hideButton(button, timerKey) {
        if (!button) return;

        // Arrêter le clignotement
        if (blinkTimers[timerKey]) {
            clearTimeout(blinkTimers[timerKey]);
            blinkTimers[timerKey] = null;
        }

        button.classList.remove('blink', 'show');
        button.classList.add('hide');

        // Cacher complètement après l'animation
        setTimeout(() => {
            button.classList.add('hidden');
            button.classList.remove('hide');
        }, 200);
    }

    /**
     * Met à jour l'affichage du bouton rectangulaire
     */
    function updateRectButton() {
        const hasChanged = hasRectValuesChanged();

        if (hasChanged) {
            showButton(elements.applyRect, 'rect');
        } else {
            hideButton(elements.applyRect, 'rect');
        }
    }

    /**
     * Met à jour l'affichage du bouton circulaire
     */
    function updateCircButton() {
        const hasChanged = hasCircValueChanged();

        if (hasChanged) {
            showButton(elements.applyCirc, 'circ');
        } else {
            hideButton(elements.applyCirc, 'circ');
        }
    }

    /**
     * Fonction gardée pour compatibilité - ne fait plus rien depuis v1.0.3
     */
    function updateInitialValues() {
        // Comparaison directe avec les valeurs du monde maintenant
    }

    /**
     * Gestionnaire pour les clics sur les boutons d'application
     */
    function handleApplyClick(button, timerKey, updateCallback) {
        return function(event) {
            // Nettoyer les timers si nécessaire
            if (blinkTimers[timerKey]) {
                clearTimeout(blinkTimers[timerKey]);
                blinkTimers[timerKey] = null;
            }

            // Animation de succès (arrête automatiquement le pulse via :not(.success))
            button.classList.add('success');

            // Mettre à jour les valeurs initiales
            updateInitialValues();

            // Appeler le callback original s'il existe
            if (updateCallback && typeof updateCallback === 'function') {
                updateCallback(event);
            }

            // Cacher le bouton après l'animation de succès
            setTimeout(() => {
                button.classList.remove('success');
                hideButton(button, timerKey);
            }, 400);
        };
    }

    /**
     * Gestionnaire pour la touche Entrée sur les inputs
     */
    function handleInputKeydown(event, buttonElement, timerKey, updateCallback) {
        if (event.key === 'Enter') {
            event.preventDefault();

            // Si le bouton est visible, l'activer
            if (buttonElement && !buttonElement.classList.contains('hidden')) {
                // Simuler un clic sur le bouton
                const clickEvent = new Event('click', { bubbles: true });
                buttonElement.dispatchEvent(clickEvent);
            }
        }
    }

    /**
     * Valide et corrige une valeur négative
     */
    function validatePositiveValue(input) {
        const value = parseFloat(input.value);
        if (value < 0) {
            input.value = 0;
        }
    }

    /**
     * Initialise les événements
     */
    function initEvents() {
        // Événements sur les inputs
        if (elements.boxW) {
            elements.boxW.addEventListener('input', () => {
                validatePositiveValue(elements.boxW);
                updateRectButton();
            });
            elements.boxW.addEventListener('change', () => {
                validatePositiveValue(elements.boxW);
                updateRectButton();
            });
            elements.boxW.addEventListener('keydown', (e) =>
                handleInputKeydown(e, elements.applyRect, 'rect')
            );
        }

        if (elements.boxH) {
            elements.boxH.addEventListener('input', () => {
                validatePositiveValue(elements.boxH);
                updateRectButton();
            });
            elements.boxH.addEventListener('change', () => {
                validatePositiveValue(elements.boxH);
                updateRectButton();
            });
            elements.boxH.addEventListener('keydown', (e) =>
                handleInputKeydown(e, elements.applyRect, 'rect')
            );
        }

        if (elements.boxD) {
            elements.boxD.addEventListener('input', () => {
                validatePositiveValue(elements.boxD);
                updateCircButton();
            });
            elements.boxD.addEventListener('change', () => {
                validatePositiveValue(elements.boxD);
                updateCircButton();
            });
            elements.boxD.addEventListener('keydown', (e) =>
                handleInputKeydown(e, elements.applyCirc, 'circ')
            );
        }

        // Événements sur les boutons d'application
        if (elements.applyRect) {
            // Sauvegarder l'ancien gestionnaire s'il existe
            const originalRectHandler = elements.applyRect.onclick;
            elements.applyRect.onclick = null;

            elements.applyRect.addEventListener('click',
                handleApplyClick(elements.applyRect, 'rect', originalRectHandler)
            );
        }

        if (elements.applyCirc) {
            // Sauvegarder l'ancien gestionnaire s'il existe
            const originalCircHandler = elements.applyCirc.onclick;
            elements.applyCirc.onclick = null;

            elements.applyCirc.addEventListener('click',
                handleApplyClick(elements.applyCirc, 'circ', originalCircHandler)
            );
        }

        // Événement sur le changement de forme
        if (elements.shape) {
            elements.shape.addEventListener('change', (e) => {

                // Cacher tous les boutons lors du changement de forme
                hideButton(elements.applyRect, 'rect');
                hideButton(elements.applyCirc, 'circ');

                // Vérification immédiate avec la nouvelle forme
                setTimeout(() => {
                    updateInitialValues();
                    // Affichage du bouton approprié selon la nouvelle forme
                    const newShape = e.target.value;
                    if (newShape === 'rect' || newShape === 'chemin_de_cable') {
                        // On passe en mode rectangulaire, forcer la vérification
                        showButton(elements.applyRect, 'rect');
                    } else if (newShape === 'circ') {
                        // On passe en mode circulaire, forcer la vérification
                        showButton(elements.applyCirc, 'circ');
                    }
                }, 50); // Réduit à 50ms pour plus de réactivité
            });
        }
    }

    /**
     * Fonction publique pour réinitialiser les valeurs
     * Peut être appelée depuis l'extérieur si nécessaire
     */
    function resetInitialValues() {
        updateInitialValues();
        hideButton(elements.applyRect, 'rect');
        hideButton(elements.applyCirc, 'circ');
    }

    /**
     * Initialisation principale
     */
    function init() {
        // Attendre que le DOM soit chargé
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
            return;
        }

        initElements();
        initEvents();

        // Exposer les fonctions utiles globalement
        window.resetDimensionButtons = resetInitialValues;
        window.cleanupDimensionButtons = cleanup;

    }

    // Démarrer l'initialisation
    init();
})();
