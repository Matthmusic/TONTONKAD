/**
 * Gestionnaire pour les boutons "Appliquer dimensions"
 * Affiche et fait clignoter le bouton quand les dimensions changent
 */
(function initDimensionButtonHandler() {
    'use strict';
    
    // Valeurs initiales pour détecter les changements
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
        
        // Debug : vérifier que les éléments sont trouvés
        console.log('🔍 Éléments trouvés:', {
            boxW: !!elements.boxW,
            boxH: !!elements.boxH,
            boxD: !!elements.boxD,
            applyRect: !!elements.applyRect,
            applyCirc: !!elements.applyCirc,
            shape: !!elements.shape
        });
        
        // Stocker les valeurs initiales
        if (elements.boxW) initialValues.boxW = parseFloat(elements.boxW.value) || 1000;
        if (elements.boxH) initialValues.boxH = parseFloat(elements.boxH.value) || 1000;
        if (elements.boxD) initialValues.boxD = parseFloat(elements.boxD.value) || 1000;
        
        console.log('📊 Valeurs initiales:', initialValues);
    }
    
    /**
     * Vérifie si les valeurs rectangulaires ont changé
     */
    function hasRectValuesChanged() {
        if (!elements.boxW || !elements.boxH) return false;
        
        const currentW = parseFloat(elements.boxW.value) || 0;
        const currentH = parseFloat(elements.boxH.value) || 0;
        
        return currentW !== initialValues.boxW || currentH !== initialValues.boxH;
    }
    
    /**
     * Vérifie si la valeur circulaire a changé
     */
    function hasCircValueChanged() {
        if (!elements.boxD) return false;
        
        const currentD = parseFloat(elements.boxD.value) || 0;
        return currentD !== initialValues.boxD;
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
        console.log('🔄 updateRectButton - hasChanged:', hasChanged);
        
        if (hasChanged) {
            console.log('✅ Affichage bouton rect');
            showButton(elements.applyRect, 'rect');
        } else {
            console.log('❌ Masquage bouton rect');
            hideButton(elements.applyRect, 'rect');
        }
    }
    
    /**
     * Met à jour l'affichage du bouton circulaire
     */
    function updateCircButton() {
        const hasChanged = hasCircValueChanged();
        console.log('🔄 updateCircButton - hasChanged:', hasChanged);
        
        if (hasChanged) {
            console.log('✅ Affichage bouton circ');
            showButton(elements.applyCirc, 'circ');
        } else {
            console.log('❌ Masquage bouton circ');
            hideButton(elements.applyCirc, 'circ');
        }
    }
    
    /**
     * Remet à jour les valeurs initiales après application
     */
    function updateInitialValues() {
        if (elements.boxW) initialValues.boxW = parseFloat(elements.boxW.value) || 1000;
        if (elements.boxH) initialValues.boxH = parseFloat(elements.boxH.value) || 1000;
        if (elements.boxD) initialValues.boxD = parseFloat(elements.boxD.value) || 1000;
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
     * Initialise les événements
     */
    function initEvents() {
        // Événements sur les inputs
        if (elements.boxW) {
            elements.boxW.addEventListener('input', updateRectButton);
            elements.boxW.addEventListener('change', updateRectButton);
            elements.boxW.addEventListener('keydown', (e) => 
                handleInputKeydown(e, elements.applyRect, 'rect')
            );
        }
        
        if (elements.boxH) {
            elements.boxH.addEventListener('input', updateRectButton);
            elements.boxH.addEventListener('change', updateRectButton);
            elements.boxH.addEventListener('keydown', (e) => 
                handleInputKeydown(e, elements.applyRect, 'rect')
            );
        }
        
        if (elements.boxD) {
            elements.boxD.addEventListener('input', updateCircButton);
            elements.boxD.addEventListener('change', updateCircButton);
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
                console.log('🔄 Changement de forme:', e.target.value);
                
                // Cacher tous les boutons lors du changement de forme
                hideButton(elements.applyRect, 'rect');
                hideButton(elements.applyCirc, 'circ');
                
                // Mettre à jour les valeurs initiales et vérifier les boutons
                setTimeout(() => {
                    console.log('⏰ Timeout après changement de forme');
                    updateInitialValues();
                    // Vérifier immédiatement si les boutons doivent être affichés
                    updateRectButton();
                    updateCircButton();
                }, 150); // Augmenté à 150ms pour laisser le temps au DOM de se mettre à jour
            });
        } else {
            console.log('⚠️ Élément shape non trouvé !');
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
        
        // Exposer la fonction de reset globalement si nécessaire
        window.resetDimensionButtons = resetInitialValues;
        
        console.log('✅ Gestionnaire des boutons de dimensions initialisé');
    }
    
    // Démarrer l'initialisation
    init();
})();