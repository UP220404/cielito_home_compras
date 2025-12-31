// ============================================================
//   MEJORAS VISUALES PRO - Diciembre 2025
// ============================================================

// ============================================================
// A. SKELETON LOADERS
// ============================================================

const SkeletonLoader = {
  // Mostrar skeleton en un contenedor
  show(container, type = 'card', count = 3) {
    if (typeof container === 'string') {
      container = document.querySelector(container);
    }
    if (!container) return;

    const skeletons = {
      card: `
        <div class="skeleton-card">
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-text" style="width: 80%"></div>
          <div class="skeleton skeleton-text" style="width: 60%"></div>
        </div>
      `,
      table: `
        <div class="skeleton-card">
          ${Array(5).fill('').map(() => `
            <div class="d-flex gap-2 mb-2">
              <div class="skeleton skeleton-text" style="flex: 1"></div>
              <div class="skeleton skeleton-text" style="flex: 1"></div>
              <div class="skeleton skeleton-text" style="flex: 1"></div>
            </div>
          `).join('')}
        </div>
      `,
      list: `
        <div class="skeleton-card">
          ${Array(4).fill('').map(() => `
            <div class="d-flex align-items-center gap-3 mb-3">
              <div class="skeleton rounded-circle" style="width: 48px; height: 48px;"></div>
              <div style="flex: 1;">
                <div class="skeleton skeleton-text" style="width: 60%; margin-bottom: 8px;"></div>
                <div class="skeleton skeleton-text" style="width: 40%;"></div>
              </div>
            </div>
          `).join('')}
        </div>
      `
    };

    const html = Array(count).fill(skeletons[type] || skeletons.card).join('');
    container.innerHTML = html;
    container.classList.add('skeleton-container');
  },

  // Ocultar skeleton
  hide(container) {
    if (typeof container === 'string') {
      container = document.querySelector(container);
    }
    if (!container) return;

    container.classList.remove('skeleton-container');
  }
};

// ============================================================
// B. CONFETTI ANIMATIONS
// ============================================================

const Confetti = {
  // Lanzar confetti (requiere canvas-confetti library)
  launch(options = {}) {
    // Verificar si la librería está disponible
    if (typeof confetti === 'undefined') {
      console.warn('canvas-confetti library not loaded');
      return;
    }

    const defaults = {
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    };

    confetti({ ...defaults, ...options });
  },

  // Confetti de éxito (verde)
  success() {
    if (typeof confetti === 'undefined') return;

    const colors = ['#198754', '#20c997', '#0dcaf0'];

    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: colors
    });
  },

  // Confetti de autorización (dorado)
  authorized() {
    if (typeof confetti === 'undefined') return;

    const end = Date.now() + 2 * 1000;
    const colors = ['#FFD700', '#FFA500', '#FF8C00'];

    (function frame() {
      confetti({
        particleCount: 2,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: colors
      });
      confetti({
        particleCount: 2,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: colors
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    }());
  },

  // Confetti de rechazo (rojo suave)
  rejected() {
    if (typeof confetti === 'undefined') return;

    confetti({
      particleCount: 50,
      spread: 50,
      origin: { y: 0.6 },
      colors: ['#dc3545', '#f8d7da', '#842029']
    });
  }
};

// ============================================================
// C. MICRO-INTERACCIONES
// ============================================================

const MicroInteractions = {
  // Pulse animation
  pulse(element) {
    if (typeof element === 'string') {
      element = document.querySelector(element);
    }
    if (!element) return;

    element.classList.add('pulse-animation');
    setTimeout(() => {
      element.classList.remove('pulse-animation');
    }, 600);
  },

  // Bounce animation
  bounce(element) {
    if (typeof element === 'string') {
      element = document.querySelector(element);
    }
    if (!element) return;

    element.classList.add('bounce-animation');
    setTimeout(() => {
      element.classList.remove('bounce-animation');
    }, 1000);
  },

  // Shake animation (para errores)
  shake(element) {
    if (typeof element === 'string') {
      element = document.querySelector(element);
    }
    if (!element) return;

    element.classList.add('shake-animation');
    setTimeout(() => {
      element.classList.remove('shake-animation');
    }, 500);
  },

  // Success checkmark animation
  showCheckmark(element) {
    if (typeof element === 'string') {
      element = document.querySelector(element);
    }
    if (!element) return;

    const checkmark = document.createElement('div');
    checkmark.className = 'success-checkmark';
    checkmark.innerHTML = `
      <svg class="checkmark-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
        <circle class="checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
        <path class="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
      </svg>
    `;

    element.appendChild(checkmark);

    setTimeout(() => {
      checkmark.remove();
    }, 2000);
  }
};

// ============================================================
// D. PROGRESS BARS ANIMADOS
// ============================================================

const AnimatedProgress = {
  // Crear progress bar con animación
  create(container, percentage, options = {}) {
    if (typeof container === 'string') {
      container = document.querySelector(container);
    }
    if (!container) return;

    const {
      color = 'primary',
      height = '8px',
      animated = true,
      striped = false,
      label = false
    } = options;

    const progressHtml = `
      <div class="progress" style="height: ${height};">
        <div class="progress-bar ${striped ? 'progress-bar-striped' : ''} ${animated ? 'progress-bar-animated' : ''} bg-${color}"
             role="progressbar"
             style="width: 0%"
             aria-valuenow="0"
             aria-valuemin="0"
             aria-valuemax="100">
          ${label ? `${percentage}%` : ''}
        </div>
      </div>
    `;

    container.innerHTML = progressHtml;

    // Animar al porcentaje objetivo
    setTimeout(() => {
      const bar = container.querySelector('.progress-bar');
      bar.style.width = `${percentage}%`;
      bar.setAttribute('aria-valuenow', percentage);
    }, 100);
  },

  // Actualizar progress bar existente
  update(progressBar, percentage) {
    if (typeof progressBar === 'string') {
      progressBar = document.querySelector(progressBar);
    }
    if (!progressBar) return;

    progressBar.style.width = `${percentage}%`;
    progressBar.setAttribute('aria-valuenow', percentage);

    if (progressBar.textContent.includes('%')) {
      progressBar.textContent = `${percentage}%`;
    }
  }
};

// ============================================================
// E. TOOLTIPS MEJORADOS
// ============================================================

const EnhancedTooltips = {
  // Inicializar tooltips mejorados
  init() {
    // Si Bootstrap tooltips está disponible
    if (typeof bootstrap !== 'undefined' && bootstrap.Tooltip) {
      const tooltipTriggerList = [].slice.call(
        document.querySelectorAll('[data-bs-toggle="tooltip"]')
      );

      tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl, {
          animation: true,
          delay: { show: 300, hide: 100 },
          html: true
        });
      });
    }
  },

  // Agregar tooltip a elemento
  add(element, text) {
    if (typeof element === 'string') {
      element = document.querySelector(element);
    }
    if (!element) return;

    element.setAttribute('data-bs-toggle', 'tooltip');
    element.setAttribute('title', text);

    if (typeof bootstrap !== 'undefined' && bootstrap.Tooltip) {
      new bootstrap.Tooltip(element);
    }
  }
};

// ============================================================
// F. SMOOTH SCROLLING Y SCROLL ANIMATIONS
// ============================================================

const ScrollAnimations = {
  // Scroll suave a elemento
  scrollTo(element, offset = 0) {
    if (typeof element === 'string') {
      element = document.querySelector(element);
    }
    if (!element) return;

    const elementPosition = element.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - offset;

    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth'
    });
  },

  // Reveal on scroll
  initRevealOnScroll() {
    const revealElements = document.querySelectorAll('.reveal-on-scroll');

    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          revealObserver.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -100px 0px'
    });

    revealElements.forEach(el => revealObserver.observe(el));
  },

  // Scroll to top button
  initScrollToTop() {
    const scrollBtn = document.createElement('button');
    scrollBtn.className = 'scroll-to-top-btn';
    scrollBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
    scrollBtn.setAttribute('aria-label', 'Scroll to top');

    document.body.appendChild(scrollBtn);

    window.addEventListener('scroll', () => {
      if (window.pageYOffset > 300) {
        scrollBtn.classList.add('visible');
      } else {
        scrollBtn.classList.remove('visible');
      }
    });

    scrollBtn.addEventListener('click', () => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }
};

// ============================================================
// G. SEARCH Y FILTROS EN TIEMPO REAL
// ============================================================

const RealTimeSearch = {
  // Inicializar búsqueda en tabla
  initTableSearch(searchInput, table) {
    if (typeof searchInput === 'string') {
      searchInput = document.querySelector(searchInput);
    }
    if (typeof table === 'string') {
      table = document.querySelector(table);
    }
    if (!searchInput || !table) return;

    let debounceTimer;

    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);

      debounceTimer = setTimeout(() => {
        const searchTerm = e.target.value.toLowerCase().trim();
        const rows = table.querySelectorAll('tbody tr');

        let visibleCount = 0;

        rows.forEach(row => {
          const text = row.textContent.toLowerCase();
          const shouldShow = text.includes(searchTerm);

          if (shouldShow) {
            row.style.display = '';
            row.classList.add('fade-in-row');
            visibleCount++;
          } else {
            row.style.display = 'none';
          }
        });

        // Mostrar mensaje si no hay resultados
        const existingMsg = table.querySelector('.no-results-message');
        if (existingMsg) existingMsg.remove();

        if (visibleCount === 0 && searchTerm !== '') {
          const noResults = document.createElement('tr');
          noResults.className = 'no-results-message';
          noResults.innerHTML = `
            <td colspan="100" class="text-center py-5">
              <i class="fas fa-search fa-3x text-muted mb-3"></i>
              <p class="text-muted">No se encontraron resultados para "${searchTerm}"</p>
            </td>
          `;
          table.querySelector('tbody').appendChild(noResults);
        }
      }, 300);
    });
  }
};

// ============================================================
// H. DRAG & DROP PARA REORDENAR
// ============================================================

const DragAndDrop = {
  // Hacer lista ordenable
  makeListSortable(listElement, onReorder) {
    if (typeof listElement === 'string') {
      listElement = document.querySelector(listElement);
    }
    if (!listElement) return;

    let draggedElement = null;

    listElement.querySelectorAll('.draggable-item').forEach(item => {
      item.setAttribute('draggable', 'true');

      item.addEventListener('dragstart', (e) => {
        draggedElement = item;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });

      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        draggedElement = null;

        if (onReorder) {
          const newOrder = Array.from(listElement.children).map((el, index) => ({
            element: el,
            index: index
          }));
          onReorder(newOrder);
        }
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(listElement, e.clientY);
        if (afterElement == null) {
          listElement.appendChild(draggedElement);
        } else {
          listElement.insertBefore(draggedElement, afterElement);
        }
      });
    });

    function getDragAfterElement(container, y) {
      const draggableElements = [...container.querySelectorAll('.draggable-item:not(.dragging)')];

      return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;

        if (offset < 0 && offset > closest.offset) {
          return { offset: offset, element: child };
        } else {
          return closest;
        }
      }, { offset: Number.NEGATIVE_INFINITY }).element;
    }
  }
};

// ============================================================
// I. AUTO-COMPLETE
// ============================================================

const AutoComplete = {
  // Crear autocomplete en input
  create(input, dataSource, onSelect) {
    if (typeof input === 'string') {
      input = document.querySelector(input);
    }
    if (!input) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'autocomplete-wrapper';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    const dropdown = document.createElement('div');
    dropdown.className = 'autocomplete-dropdown';
    wrapper.appendChild(dropdown);

    let debounceTimer;

    input.addEventListener('input', async (e) => {
      clearTimeout(debounceTimer);
      const value = e.target.value.trim();

      if (value.length < 2) {
        dropdown.innerHTML = '';
        dropdown.classList.remove('show');
        return;
      }

      debounceTimer = setTimeout(async () => {
        // Obtener datos (puede ser array o función async)
        let results = [];
        if (typeof dataSource === 'function') {
          results = await dataSource(value);
        } else {
          results = dataSource.filter(item =>
            item.toLowerCase().includes(value.toLowerCase())
          );
        }

        if (results.length === 0) {
          dropdown.innerHTML = '<div class="autocomplete-item text-muted">No se encontraron resultados</div>';
        } else {
          dropdown.innerHTML = results.map(item =>
            `<div class="autocomplete-item" data-value="${item}">${item}</div>`
          ).join('');
        }

        dropdown.classList.add('show');

        // Eventos de click en items
        dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
          item.addEventListener('click', () => {
            const selectedValue = item.getAttribute('data-value');
            input.value = selectedValue;
            dropdown.classList.remove('show');
            if (onSelect) onSelect(selectedValue);
          });
        });
      }, 300);
    });

    // Cerrar dropdown al hacer click fuera
    document.addEventListener('click', (e) => {
      if (!wrapper.contains(e.target)) {
        dropdown.classList.remove('show');
      }
    });
  }
};

// ============================================================
// INICIALIZACIÓN GLOBAL
// ============================================================

// Auto-inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initProEnhancements);
} else {
  initProEnhancements();
}

function initProEnhancements() {
  console.log('🎨 Inicializando mejoras PRO...');

  // Tooltips mejorados
  EnhancedTooltips.init();

  // Scroll animations
  ScrollAnimations.initRevealOnScroll();

  // Scroll to top button
  ScrollAnimations.initScrollToTop();

  console.log('✅ Mejoras PRO cargadas');
}

// Hacer disponibles globalmente
window.SkeletonLoader = SkeletonLoader;
window.Confetti = Confetti;
window.MicroInteractions = MicroInteractions;
window.AnimatedProgress = AnimatedProgress;
window.EnhancedTooltips = EnhancedTooltips;
window.ScrollAnimations = ScrollAnimations;
window.RealTimeSearch = RealTimeSearch;
window.DragAndDrop = DragAndDrop;
window.AutoComplete = AutoComplete;
