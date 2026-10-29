/**
 * Implementación del fallback progresivo y sincronización ARIA de `modern-web-guidance`
 * (`validate-input-after-interaction`).
 */
export function initUserInvalidValidationSync(root: Document | HTMLElement = document): () => void {
  if (typeof window === 'undefined' || typeof CSS === 'undefined') {
    return () => {};
  }

  const supportsUserInvalid = CSS.supports('selector(:user-invalid)');
  const dirtyState = new WeakMap<
    HTMLInputElement,
    { hasInteracted: boolean; hasBlurred: boolean }
  >();

  const updateFallbackState = (input: HTMLInputElement) => {
    const isValid = input.checkValidity();
    input.classList.toggle('user-invalid-fallback', !isValid);
    input.classList.toggle('user-valid-fallback', isValid);
    if (!isValid) {
      input.setAttribute('aria-invalid', 'true');
    } else {
      input.removeAttribute('aria-invalid');
    }
  };

  const syncNativeAria = (target: EventTarget | null) => {
    if (!(target instanceof HTMLInputElement)) return;
    target.setAttribute('aria-invalid', target.matches(':user-invalid') ? 'true' : 'false');
  };

  const handleBlur = (event: Event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    if (supportsUserInvalid) {
      syncNativeAria(target);
      return;
    }

    const state = dirtyState.get(target) || { hasInteracted: false, hasBlurred: false };
    state.hasBlurred = true;
    dirtyState.set(target, state);
    if (state.hasInteracted) {
      updateFallbackState(target);
    }
  };

  const handleInputOrChange = (event: Event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    if (supportsUserInvalid) {
      if (target.hasAttribute('aria-invalid')) {
        syncNativeAria(target);
      }
      return;
    }

    const state = dirtyState.get(target) || { hasInteracted: false, hasBlurred: false };
    state.hasInteracted = true;
    dirtyState.set(target, state);
    if (state.hasBlurred) {
      updateFallbackState(target);
    }
  };

  root.addEventListener('blur', handleBlur, true);
  root.addEventListener('input', handleInputOrChange);
  root.addEventListener('change', handleInputOrChange);

  return () => {
    root.removeEventListener('blur', handleBlur, true);
    root.removeEventListener('input', handleInputOrChange);
    root.removeEventListener('change', handleInputOrChange);
  };
}
