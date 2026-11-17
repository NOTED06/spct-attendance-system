

document.addEventListener('DOMContentLoaded', () => {
  const CORRECT_PASSCODE = '2001';
  const STORAGE_KEY = 'clark_portfolio_live_edits_v3';
  const IMG_STORAGE_KEY = 'clark_portfolio_custom_images_v1';
  const AUTH_SESSION_KEY = 'clark_portfolio_auth_status';

  
  const mobileToggle = document.getElementById('mobileToggle');
  const navMenu = document.querySelector('.nav-menu');

  if (mobileToggle && navMenu) {
    mobileToggle.addEventListener('click', () => {
      navMenu.classList.toggle('open');
    });

    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        if (e.target.hasAttribute('contenteditable')) return;
        navMenu.classList.remove('open');
      });
    });
  }

  
  const sections = document.querySelectorAll('section, header');
  const navLinks = document.querySelectorAll('.nav-link');

  const updateActiveNav = () => {
    let currentId = 'home';
    const scrollPos = window.scrollY + 140;

    sections.forEach(section => {
      const top = section.offsetTop;
      const height = section.offsetHeight;
      if (scrollPos >= top && scrollPos < top + height) {
        currentId = section.getAttribute('id') || currentId;
      }
    });

    navLinks.forEach(link => {
      link.classList.remove('active');
      const href = link.getAttribute('href');
      if (href && href.replace('#', '') === currentId) {
        link.classList.add('active');
      }
    });
  };

  window.addEventListener('scroll', updateActiveNav);
  updateActiveNav();

  
  const lightbox = document.getElementById('imageLightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxCaption = document.getElementById('lightboxCaption');
  const lightboxClose = document.getElementById('lightboxClose');
  const lightboxBackdrop = document.getElementById('lightboxBackdrop');

  const openLightbox = (src, title) => {
    if (!lightbox || !lightboxImg) return;
    lightboxImg.src = src;
    lightboxCaption.textContent = title || '';
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
  };

  const closeLightbox = () => {
    if (!lightbox) return;
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
  };

  if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
  if (lightboxBackdrop) lightboxBackdrop.addEventListener('click', closeLightbox);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (lightbox && lightbox.classList.contains('active')) closeLightbox();
      if (passwordModal && passwordModal.classList.contains('active')) closePasswordModal();
    }
  });

  
  const savePdfBtn = document.getElementById('savePdfBtn');
  if (savePdfBtn) {
    savePdfBtn.addEventListener('click', () => {
      window.print();
    });
  }

  
  const imageFileInput = document.getElementById('imageFileInput');
  let currentImageTarget = null;

  
  const loadCustomImages = () => {
    try {
      const savedImgs = localStorage.getItem(IMG_STORAGE_KEY);
      if (savedImgs) {
        const imgMap = JSON.parse(savedImgs);
        Object.keys(imgMap).forEach(key => {
          const container = document.querySelector(`[data-editable-img="${key}"]`);
          if (container && imgMap[key]) {
            let img = container.querySelector('img');
            if (!img) {
              
              const svg = container.querySelector('svg');
              if (svg) svg.style.display = 'none';
              img = document.createElement('img');
              img.className = 'project-image-preview';
              img.loading = 'lazy';
              container.insertBefore(img, container.firstChild);
            }
            img.src = imgMap[key];
            container.setAttribute('data-img-src', imgMap[key]);
          }
        });
      }
    } catch (err) {
      console.warn('Could not load custom images:', err);
    }
  };

  loadCustomImages();

  
  const saveCustomImage = (key, dataUrl) => {
    try {
      const savedImgs = JSON.parse(localStorage.getItem(IMG_STORAGE_KEY) || '{}');
      savedImgs[key] = dataUrl;
      localStorage.setItem(IMG_STORAGE_KEY, JSON.stringify(savedImgs));
    } catch (err) {
      console.warn('Could not save custom image:', err);
    }
  };

  
  document.querySelectorAll('[data-editable-img]').forEach(container => {
    container.addEventListener('click', (e) => {
      
      if (e.target.hasAttribute('contenteditable')) return;

      if (isUnlocked) {
        
        currentImageTarget = container;
        if (imageFileInput) {
          imageFileInput.value = '';
          imageFileInput.click();
        }
      } else {
        
        if (container.classList.contains('hero-photo-card')) {
          const img = container.querySelector('img');
          if (img) openLightbox(img.src, 'Clark R. Carceller - Profile Photo');
          return;
        }

        const src = container.getAttribute('data-img-src') || (container.querySelector('img') ? container.querySelector('img').src : null);
        const title = container.getAttribute('data-img-title');
        if (src) openLightbox(src, title);
      }
    });
  });

  
  if (imageFileInput) {
    imageFileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file || !currentImageTarget) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target.result;
        const key = currentImageTarget.getAttribute('data-editable-img');

        let img = currentImageTarget.querySelector('img');
        if (!img) {
          const svg = currentImageTarget.querySelector('svg');
          if (svg) svg.style.display = 'none';
          img = document.createElement('img');
          img.className = 'project-image-preview';
          img.loading = 'lazy';
          currentImageTarget.insertBefore(img, currentImageTarget.firstChild);
        }

        img.src = dataUrl;
        currentImageTarget.setAttribute('data-img-src', dataUrl);

        if (key) {
          saveCustomImage(key, dataUrl);
        }

        if (statusText) {
          statusText.textContent = 'Image updated successfully!';
          setTimeout(() => {
            if (isUnlocked) statusText.textContent = 'Editing Mode Active';
          }, 2500);
        }
      };
      reader.readAsDataURL(file);
    });
  }

  
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const unlockEditBtn = document.getElementById('unlockEditBtn');
  const lockEditBtn = document.getElementById('lockEditBtn');
  const saveExportBtn = document.getElementById('saveExportBtn');
  const resetEditsBtn = document.getElementById('resetEditsBtn');
  const addSkillBtn = document.getElementById('addSkillBtn');

  const passwordModal = document.getElementById('passwordModal');
  const authBackdrop = document.getElementById('authBackdrop');
  const authClose = document.getElementById('authClose');
  const authCancelBtn = document.getElementById('authCancelBtn');
  const passwordForm = document.getElementById('passwordForm');
  const passwordInput = document.getElementById('passwordInput');
  const authErrorMsg = document.getElementById('authErrorMsg');
  const authDialog = document.querySelector('.auth-dialog');

  let isUnlocked = false;

  
  const loadSavedEdits = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        document.querySelectorAll('[data-editable]').forEach(el => {
          const key = el.getAttribute('data-editable');
          if (key && data[key] !== undefined) {
            el.innerHTML = data[key];
          }
        });
      }
    } catch (err) {
      console.warn('Could not load from localStorage:', err);
    }
  };

  loadSavedEdits();

  
  const saveEdits = () => {
    if (!isUnlocked) return;
    try {
      const data = {};
      document.querySelectorAll('[data-editable]').forEach(el => {
        const key = el.getAttribute('data-editable');
        if (key) {
          data[key] = el.innerHTML;
        }
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

      if (statusText) {
        statusText.textContent = 'Changes auto-saved!';
        clearTimeout(window._statusTimeout);
        window._statusTimeout = setTimeout(() => {
          if (isUnlocked) statusText.textContent = 'Editing Mode Active';
        }, 2000);
      }
    } catch (err) {
      console.warn('Could not save to localStorage:', err);
    }
  };

  
  const attachEditableListeners = (container = document) => {
    container.querySelectorAll('[data-editable]').forEach(el => {
      el.addEventListener('input', saveEdits);

      el.addEventListener('click', (e) => {
        if (isUnlocked) {
          const parentLink = el.closest('a');
          if (parentLink) e.stopPropagation();
        }
      });

      if (el.tagName.match(/^H[1-6]$/i) || el.classList.contains('skill-pill') || el.classList.contains('brand-name')) {
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            el.blur();
          }
        });
      }
    });
  };

  attachEditableListeners();

  
  const applyLockState = (unlocked) => {
    isUnlocked = unlocked;
    document.body.classList.toggle('unlocked-mode', unlocked);

    document.querySelectorAll('[data-editable]').forEach(el => {
      if (unlocked) {
        el.setAttribute('contenteditable', 'true');
        el.setAttribute('spellcheck', 'false');
      } else {
        el.removeAttribute('contenteditable');
        el.removeAttribute('spellcheck');
      }
    });

    if (unlocked) {
      if (statusDot) statusDot.classList.remove('locked');
      if (statusText) statusText.textContent = 'Editing Mode Active';
      if (unlockEditBtn) unlockEditBtn.style.display = 'none';
      if (lockEditBtn) lockEditBtn.style.display = 'inline-flex';
      if (saveExportBtn) saveExportBtn.style.display = 'inline-flex';
      if (resetEditsBtn) resetEditsBtn.style.display = 'inline-flex';
      if (addSkillBtn) addSkillBtn.style.display = 'inline-flex';
      sessionStorage.setItem(AUTH_SESSION_KEY, 'unlocked');
    } else {
      if (statusDot) statusDot.classList.add('locked');
      if (statusText) statusText.textContent = 'Portfolio Mode (Read-Only)';
      if (unlockEditBtn) unlockEditBtn.style.display = 'inline-flex';
      if (lockEditBtn) lockEditBtn.style.display = 'none';
      if (saveExportBtn) saveExportBtn.style.display = 'none';
      if (resetEditsBtn) resetEditsBtn.style.display = 'none';
      if (addSkillBtn) addSkillBtn.style.display = 'none';
      sessionStorage.removeItem(AUTH_SESSION_KEY);
    }
  };

  
  const openPasswordModal = () => {
    if (!passwordModal) return;
    passwordInput.value = '';
    authErrorMsg.style.display = 'none';
    passwordModal.classList.add('active');
    setTimeout(() => passwordInput.focus(), 100);
  };

  const closePasswordModal = () => {
    if (!passwordModal) return;
    passwordModal.classList.remove('active');
  };

  if (unlockEditBtn) unlockEditBtn.addEventListener('click', openPasswordModal);
  if (authClose) authClose.addEventListener('click', closePasswordModal);
  if (authCancelBtn) authCancelBtn.addEventListener('click', closePasswordModal);
  if (authBackdrop) authBackdrop.addEventListener('click', closePasswordModal);

  
  if (passwordForm) {
    passwordForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const entered = passwordInput.value.trim();

      if (entered === CORRECT_PASSCODE) {
        closePasswordModal();
        applyLockState(true);
      } else {
        authErrorMsg.style.display = 'block';
        if (authDialog) {
          authDialog.classList.add('shake');
          setTimeout(() => authDialog.classList.remove('shake'), 450);
        }
        passwordInput.value = '';
        passwordInput.focus();
      }
    });
  }

  
  if (lockEditBtn) {
    lockEditBtn.addEventListener('click', () => {
      applyLockState(false);
    });
  }

  
  const savedAuth = sessionStorage.getItem(AUTH_SESSION_KEY);
  if (savedAuth === 'unlocked') {
    applyLockState(true);
  } else {
    applyLockState(false);
  }

  
  const skillsList = document.getElementById('skillsList');
  if (addSkillBtn && skillsList) {
    addSkillBtn.addEventListener('click', () => {
      if (!isUnlocked) return;
      const skillCount = skillsList.querySelectorAll('.skill-pill').length + 1;
      const newPill = document.createElement('span');
      newPill.className = 'skill-pill';
      newPill.setAttribute('contenteditable', 'true');
      newPill.setAttribute('spellcheck', 'false');
      newPill.setAttribute('data-editable', `skill-${skillCount}`);
      newPill.textContent = 'New Skill';

      skillsList.insertBefore(newPill, addSkillBtn);
      attachEditableListeners(newPill);

      newPill.focus();
      const range = document.createRange();
      range.selectNodeContents(newPill);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      saveEdits();
    });
  }

  
  if (resetEditsBtn) {
    resetEditsBtn.addEventListener('click', () => {
      if (confirm('Reset all edited text and images back to original defaults?')) {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(IMG_STORAGE_KEY);
        window.location.reload();
      }
    });
  }

  
  if (saveExportBtn) {
    saveExportBtn.addEventListener('click', () => {
      const docClone = document.documentElement.cloneNode(true);

      
      docClone.querySelectorAll('[contenteditable]').forEach(el => {
        el.removeAttribute('contenteditable');
        el.removeAttribute('spellcheck');
      });

      
      const bodyClone = docClone.querySelector('body');
      if (bodyClone) {
        bodyClone.classList.remove('unlocked-mode');
      }

      const fullHtml = '<!DOCTYPE html>\n' + docClone.outerHTML;

      const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
      const downloadUrl = URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');
      downloadLink.href = downloadUrl;
      downloadLink.download = 'index.html';
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(downloadUrl);

      if (statusText) {
        statusText.textContent = '🎉 Downloaded updated index.html!';
        setTimeout(() => {
          if (isUnlocked) statusText.textContent = 'Editing Mode Active';
        }, 3500);
      }
    });
  }
});
