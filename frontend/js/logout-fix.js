// Fix para asegurar que el logout siempre funcione
// Este script se debe cargar DESPUÉS de auth.js

(function() {
    'use strict';

    // Función para configurar logout
    function setupLogout() {
        const logoutButtons = document.querySelectorAll('.logout-btn');

        logoutButtons.forEach(btn => {
            // Remover event listeners anteriores
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);

            // Agregar nuevo event listener
            newBtn.addEventListener('click', async function(e) {
                e.preventDefault();
                e.stopPropagation();

                console.log('Logout clicked');

                if (confirm('¿Seguro que deseas cerrar sesión?')) {
                    try {
                        // Limpiar localStorage
                        localStorage.removeItem('token');
                        localStorage.removeItem('user');

                        // Mostrar mensaje
                        alert('Sesión cerrada exitosamente');

                        // Redirigir al login
                        window.location.href = 'login.html';
                    } catch (error) {
                        console.error('Error al cerrar sesión:', error);
                        // Aún así intentar redirigir
                        window.location.href = 'login.html';
                    }
                }
            });
        });

        console.log(`Logout configurado para ${logoutButtons.length} botones`);
    }

    // Ejecutar cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupLogout);
    } else {
        setupLogout();
    }

    // También ejecutar después de 1 segundo por si los componentes se cargan después
    setTimeout(setupLogout, 1000);

    // Y después de 3 segundos para asegurarse
    setTimeout(setupLogout, 3000);
})();
